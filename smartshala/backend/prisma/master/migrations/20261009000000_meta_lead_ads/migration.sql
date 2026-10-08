-- Meta (Facebook/Instagram) lead ads: the connected Page and the Meta leads
-- already pulled into the CRM.

ALTER TYPE "LeadSource" ADD VALUE 'META';

CREATE TABLE "meta_integrations" (
  "id" TEXT NOT NULL DEFAULT 'meta',
  "pageId" TEXT NOT NULL,
  "pageName" TEXT NOT NULL,
  "accessTokenEnc" TEXT NOT NULL,
  "formIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "lastAssignedUserId" UUID,
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncError" TEXT,
  "connectedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "meta_integrations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "meta_lead_imports" (
  "metaLeadId" TEXT NOT NULL,
  "formId" TEXT NOT NULL,
  "leadId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "meta_lead_imports_pkey" PRIMARY KEY ("metaLeadId")
);
