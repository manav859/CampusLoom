-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('CONSUMABLE', 'ASSET');

-- CreateEnum
CREATE TYPE "InventoryTxnType" AS ENUM ('PURCHASE', 'ISSUE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "inventory_categories" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_vendors" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "categoryId" UUID,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "type" "InventoryItemType" NOT NULL DEFAULT 'CONSUMABLE',
    "unit" TEXT NOT NULL DEFAULT 'unit',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 0,
    "lastUnitCost" DECIMAL(12,2),
    "location" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_transactions" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "type" "InventoryTxnType" NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2),
    "totalCost" DECIMAL(12,2),
    "vendorId" UUID,
    "invoiceNumber" TEXT,
    "issuedTo" TEXT,
    "reason" TEXT,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_categories_schoolId_name_key" ON "inventory_categories"("schoolId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_vendors_schoolId_name_key" ON "inventory_vendors"("schoolId", "name");

-- CreateIndex
CREATE INDEX "inventory_items_schoolId_categoryId_idx" ON "inventory_items"("schoolId", "categoryId");

-- CreateIndex
CREATE INDEX "inventory_items_schoolId_isActive_idx" ON "inventory_items"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_schoolId_name_key" ON "inventory_items"("schoolId", "name");

-- CreateIndex
CREATE INDEX "inventory_transactions_schoolId_itemId_occurredAt_idx" ON "inventory_transactions"("schoolId", "itemId", "occurredAt");

-- CreateIndex
CREATE INDEX "inventory_transactions_schoolId_occurredAt_idx" ON "inventory_transactions"("schoolId", "occurredAt");

-- CreateIndex
CREATE INDEX "inventory_transactions_schoolId_vendorId_idx" ON "inventory_transactions"("schoolId", "vendorId");

-- AddForeignKey
ALTER TABLE "inventory_categories" ADD CONSTRAINT "inventory_categories_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_vendors" ADD CONSTRAINT "inventory_vendors_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "inventory_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "inventory_vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
