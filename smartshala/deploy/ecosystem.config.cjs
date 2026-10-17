// pm2 process list for the production VPS.
//
// Environment is NOT read from backend/.env on purpose: the Prisma CLI loads
// that file and its values win over the per-tenant DATABASE_URL that
// migrate-tenants.mjs passes inline, which would point every tenant migration
// at the main database. deploy.sh sources /srv/smartshala-env/*.env and runs
// `pm2 reload --update-env` instead.
module.exports = {
  apps: [
    {
      name: "smartshala-api",
      cwd: "/srv/smartshala/backend",
      // dist/server.js, not `npm start` — the start script migrates on boot,
      // which is exactly what the deploy step replaces.
      script: "dist/server.js",
      // KVM 1 has 1 vCPU, so a second instance would only context-switch
      // against the first while doubling the tenant client cache. Still
      // cluster mode with one instance, because that is what makes
      // `pm2 reload` graceful; fork mode would drop requests on every deploy.
      //
      // Each instance caches up to MAX_CLIENTS (50) tenant Prisma clients of
      // TENANT_DB_CONNECTION_LIMIT each, so instances * 50 * limit is the
      // connection ceiling: 1 * 50 * 3 = 150 against a default
      // max_connections of 100. A handful of schools uses nowhere near that,
      // but raise max_connections to 150 before roughly 30 schools are warm,
      // or lower MAX_CLIENTS. Revisit both when the plan moves off KVM 1.
      instances: 1,
      exec_mode: "cluster",
      max_memory_restart: "900M",
      time: true,
      env: { NODE_ENV: "production", PORT: 4000 }
    },
    {
      name: "smartshala-web",
      cwd: "/srv/smartshala/frontend",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "900M",
      time: true,
      env: { NODE_ENV: "production", PORT: 3000 }
    }
  ]
};
