#!/usr/bin/env node
// Sends the two daily push reminders — a class whose attendance is still not
// marked, and leave still waiting for a decision — across every active tenant.
//
//   node scripts/send-push-reminders.mjs
//
// The same pass `startPushReminderWorker` runs in-process, but that worker only
// starts when BACKGROUND_WORKERS_ENABLED is on, and that switch also starts the
// billing worker, which is kept off in production. So, like the selfie purge,
// the reminders run from cron instead. Cron owns the timing here (fire it once a
// day at the hour you want), so PUSH_REMINDER_HOUR is not consulted — the pass
// runs whenever this script is invoked. It is a no-op when push is unconfigured,
// on Sundays, and on declared holidays. Needs the same env as the API.
import "dotenv/config";
import { runReminderPass } from "../dist/modules/push/push.worker.js";
import { disconnectDatabase } from "../dist/core/prisma.js";
import { disconnectTenantClients } from "../dist/tenant/prismaManager.js";
import { masterPrisma } from "../dist/master-db/masterPrisma.js";

async function main() {
  await runReminderPass();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // Release every pool the pass opened so the process can exit.
    await Promise.allSettled([
      disconnectDatabase(),
      disconnectTenantClients(),
      masterPrisma.$disconnect()
    ]);
  });
