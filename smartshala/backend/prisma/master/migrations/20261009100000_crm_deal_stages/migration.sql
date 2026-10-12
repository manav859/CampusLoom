-- The sales team's own deal stages, plus stages a sales admin adds. "Contacted"
-- goes away: those deals go back to NEW (now shown as "Inbound").

UPDATE "leads" SET "stage" = 'NEW' WHERE "stage" = 'CONTACTED';

-- Postgres cannot drop an enum value, so the type is rebuilt.
ALTER TYPE "LeadStage" RENAME TO "LeadStage_old";
CREATE TYPE "LeadStage" AS ENUM (
  'NEW',
  'CALL_NOT_CONNECTED',
  'CALLBACK_REQUESTED',
  'DEMO_ARRANGED',
  'DEMO_SHOWN',
  'CUSTOM',
  'PROFORMA_SENT',
  'PAID',
  'ONBOARDED',
  'COLD',
  'IRRELEVANT',
  'LOST'
);
ALTER TABLE "leads" ALTER COLUMN "stage" DROP DEFAULT;
ALTER TABLE "leads" ALTER COLUMN "stage" TYPE "LeadStage" USING ("stage"::text::"LeadStage");
ALTER TABLE "leads" ALTER COLUMN "stage" SET DEFAULT 'NEW';
DROP TYPE "LeadStage_old";

CREATE TABLE "crm_stages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "crm_stages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_stages_name_key" ON "crm_stages"("name");

ALTER TABLE "leads" ADD COLUMN "customStageId" UUID;

CREATE INDEX "leads_customStageId_idx" ON "leads"("customStageId");

ALTER TABLE "leads" ADD CONSTRAINT "leads_customStageId_fkey"
  FOREIGN KEY ("customStageId") REFERENCES "crm_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
