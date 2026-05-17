import type { School } from "../generated/master-client/index.js";
import { masterPrisma } from "../master-db/masterPrisma.js";

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
