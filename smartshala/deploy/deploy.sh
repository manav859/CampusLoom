#!/usr/bin/env bash
#
# Deploy a tested commit or tag to the production VPS.
#
#   ./deploy/deploy.sh v1.4.0
#   ./deploy/deploy.sh 16002d0
#
# The VPS never auto-deploys from main: main is staging (Render + Vercel), and
# only a ref that already passed there is deployed here by hand.
#
# Migrations run in this script, not at boot. One bad migration at boot takes
# every school down and a rollback does not help, because Prisma records the
# failed row and refuses to start afterwards (P3009).
set -Eeuo pipefail

REF="${1:-}"
if [ -z "$REF" ]; then
  echo "usage: $0 <git-tag-or-commit>" >&2
  exit 64
fi

APP_DIR="${APP_DIR:-/srv/smartshala}"
ENV_DIR="${ENV_DIR:-/srv/smartshala-env}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:4000/health/db}"

# The checkout below rewrites this file. Bash reads a script incrementally, so
# a script that replaces itself mid-run can execute spliced garbage. Re-exec
# from a copy outside the work tree before touching git.
SELF="$(readlink -f "$0")"
if [ "${DEPLOY_DETACHED:-}" != "1" ] && case "$SELF" in "$(readlink -f "$APP_DIR")"/*) true;; *) false;; esac; then
  COPY="$(mktemp /tmp/smartshala-deploy.XXXXXX.sh)"
  cat "$SELF" > "$COPY"
  chmod +x "$COPY"
  DEPLOY_DETACHED=1 exec "$COPY" "$@"
fi

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[1;31m!!! %s\033[0m\n' "$*" >&2; exit 1; }

# The Prisma CLI loads backend/.env and those values beat the per-tenant
# DATABASE_URL that migrate-tenants.mjs passes inline, so a stray .env here
# would migrate the main database once per school instead of each tenant.
[ -f "$APP_DIR/backend/.env" ] && fail "$APP_DIR/backend/.env exists. Production env belongs in $ENV_DIR; remove it."
[ -f "$ENV_DIR/backend.env" ] || fail "missing $ENV_DIR/backend.env"
[ -f "$ENV_DIR/frontend.env" ] || fail "missing $ENV_DIR/frontend.env"

set -a
# shellcheck disable=SC1091
. "$ENV_DIR/backend.env"
# shellcheck disable=SC1091
. "$ENV_DIR/frontend.env"
set +a

: "${DATABASE_URL:?not set in backend.env}"
: "${MASTER_DATABASE_URL:?not set in backend.env}"
: "${NEXT_PUBLIC_API_URL:?not set in frontend.env}"

log "Snapshot reminder"
echo "    Take a Hostinger snapshot before a deploy that carries migrations."

log "Checking out $REF"
cd "$APP_DIR"
git fetch --all --tags --prune
git checkout --detach "$REF"
git --no-pager log -1 --oneline

log "Building backend"
cd "$APP_DIR/backend"
npm ci
npm run build

log "Building frontend (NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL is baked in here)"
cd "$APP_DIR/frontend"
npm ci
npm run build

log "Migrating master database"
cd "$APP_DIR/backend"
npx prisma migrate deploy --schema prisma/master/schema.prisma

log "Migrating main database"
npx prisma migrate deploy --schema prisma/schema.prisma

log "Migrating every tenant database"
node scripts/migrate-tenants.mjs

log "Reloading pm2"
# startOrReload, not reload: on the very first deploy nothing is running yet
# and plain `reload` fails. Afterwards this behaves exactly like reload, so
# the graceful cluster handover is preserved.
pm2 startOrReload "$APP_DIR/deploy/ecosystem.config.cjs" --update-env
pm2 save

log "Health check"
for attempt in $(seq 1 20); do
  if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null; then
    echo "    healthy after ${attempt}s"
    log "Deployed $REF"
    exit 0
  fi
  sleep 1
done

pm2 logs --nostream --lines 40 || true
fail "backend did not answer $HEALTH_URL within 20s"
