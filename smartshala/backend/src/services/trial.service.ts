import type { School } from "../../node_modules/@smartshala/master-client/index.js";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { masterPrisma } from "../master-db/masterPrisma.js";

const WORKER_INTERVAL_MS = 60 * 60 * 1000;

export function trialEndsFrom(start = new Date()) {
  return new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
}

export function isTrialExpired(school: Pick<School, "isTrial" | "trialEndsAt">) {
  return Boolean(school.isTrial && school.trialEndsAt && school.trialEndsAt <= new Date());
}

export async function expireTrials() {
  const now = new Date();
  const result = await masterPrisma.school.updateMany({
    where: {
      isTrial: true,
      trialEndsAt: { lte: now },
      isActive: true
    },
    data: {
      isActive: false
    }
  });

  return result.count;
}

export function startTrialExpiryWorker() {
  if (env.NODE_ENV === "test" || !env.MASTER_DATABASE_URL) return;

  void expireTrials()
    .then((count) => {
      if (count) logger.warn({ count }, "Expired trial schools revoked");
    })
    .catch((error) => logger.error({ err: error }, "Trial expiry worker failed"));

  const timer = setInterval(() => {
    void expireTrials()
      .then((count) => {
        if (count) logger.warn({ count }, "Expired trial schools revoked");
      })
      .catch((error) => logger.error({ err: error }, "Trial expiry worker failed"));
  }, WORKER_INTERVAL_MS);

  timer.unref?.();
}
