import { Prisma, UserRole, type InventoryItemType, type InventoryTxnType } from "@prisma/client";
import { prisma } from "../../core/prisma.js";
import { AppError, notFound } from "../../core/errors.js";

const managerRoles = new Set<UserRole>([UserRole.PRINCIPAL, UserRole.ACCOUNTANT]);

function assertManager(user: Express.UserContext) {
  if (!managerRoles.has(user.role as UserRole)) {
    throw new AppError(403, "Only a Principal or Accountant can manage inventory.", "FORBIDDEN");
  }
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const num = (value: Prisma.Decimal | null) => (value === null ? null : Number(value));
const round2 = (value: number) => Math.round(value * 100) / 100;

// ------------------------------------------------------------------ shapes

const categorySelect = { id: true, name: true } satisfies Prisma.InventoryCategorySelect;

const itemSelect = {
  id: true,
  name: true,
  sku: true,
  type: true,
  unit: true,
  quantity: true,
  reorderLevel: true,
  lastUnitCost: true,
  location: true,
  notes: true,
  isActive: true,
  category: { select: categorySelect }
} satisfies Prisma.InventoryItemSelect;

type ItemRow = Prisma.InventoryItemGetPayload<{ select: typeof itemSelect }>;

function toItem(item: ItemRow) {
  const lastUnitCost = num(item.lastUnitCost);
  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    type: item.type,
    unit: item.unit,
    quantity: item.quantity,
    reorderLevel: item.reorderLevel,
    lastUnitCost,
    stockValue: lastUnitCost !== null ? round2(item.quantity * lastUnitCost) : null,
    // Only items with a reorder level set can be "low"; a level of 0 means untracked.
    lowStock: item.reorderLevel > 0 && item.quantity <= item.reorderLevel,
    location: item.location,
    notes: item.notes,
    isActive: item.isActive,
    category: item.category
  };
}

const txnSelect = {
  id: true,
  type: true,
  quantityDelta: true,
  balanceAfter: true,
  unitCost: true,
  totalCost: true,
  invoiceNumber: true,
  issuedTo: true,
  reason: true,
  note: true,
  occurredAt: true,
  vendor: { select: { id: true, name: true } },
  recordedBy: { select: { id: true, fullName: true, role: true } },
  item: { select: { id: true, name: true, unit: true } }
} satisfies Prisma.InventoryTransactionSelect;

type TxnRow = Prisma.InventoryTransactionGetPayload<{ select: typeof txnSelect }>;

function toTxn(txn: TxnRow) {
  return {
    id: txn.id,
    type: txn.type,
    quantityDelta: txn.quantityDelta,
    balanceAfter: txn.balanceAfter,
    unitCost: num(txn.unitCost),
    totalCost: num(txn.totalCost),
    invoiceNumber: txn.invoiceNumber,
    issuedTo: txn.issuedTo,
    reason: txn.reason,
    note: txn.note,
    occurredAt: txn.occurredAt,
    vendor: txn.vendor,
    recordedBy: txn.recordedBy,
    item: txn.item
  };
}

// --------------------------------------------------------------- categories

type CategoryInput = { name: string };

export async function listCategories(user: Express.UserContext) {
  assertManager(user);
  const rows = await prisma.inventoryCategory.findMany({
    where: { schoolId: user.schoolId },
    select: { id: true, name: true, _count: { select: { items: true } } },
    orderBy: { name: "asc" }
  });
  return rows.map(({ _count, ...category }) => ({ ...category, itemCount: _count.items }));
}

async function saveCategory(user: Express.UserContext, input: CategoryInput, id?: string) {
  assertManager(user);
  try {
    if (!id) {
      return await prisma.inventoryCategory.create({ data: { schoolId: user.schoolId, name: input.name }, select: categorySelect });
    }
    const existing = await prisma.inventoryCategory.findFirst({ where: { id, schoolId: user.schoolId }, select: { id: true } });
    if (!existing) throw notFound("Category");
    return await prisma.inventoryCategory.update({ where: { id }, data: { name: input.name }, select: categorySelect });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(409, `A category named "${input.name}" already exists.`, "CATEGORY_EXISTS");
    throw error;
  }
}

export const createCategory = (user: Express.UserContext, input: CategoryInput) => saveCategory(user, input);
export const updateCategory = (user: Express.UserContext, id: string, input: CategoryInput) => saveCategory(user, input, id);

/** Items in the category are kept; they simply become uncategorised. */
export async function deleteCategory(user: Express.UserContext, id: string) {
  assertManager(user);
  const { count } = await prisma.inventoryCategory.deleteMany({ where: { id, schoolId: user.schoolId } });
  if (count === 0) throw notFound("Category");
}

// ------------------------------------------------------------------ vendors

type VendorInput = {
  name: string;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  address?: string | null;
  notes?: string | null;
};

const vendorSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  gstin: true,
  address: true,
  notes: true,
  _count: { select: { transactions: true } }
} satisfies Prisma.InventoryVendorSelect;

function toVendor(vendor: Prisma.InventoryVendorGetPayload<{ select: typeof vendorSelect }>) {
  const { _count, ...rest } = vendor;
  return { ...rest, purchaseCount: _count.transactions };
}

export async function listVendors(user: Express.UserContext) {
  assertManager(user);
  const rows = await prisma.inventoryVendor.findMany({
    where: { schoolId: user.schoolId },
    select: vendorSelect,
    orderBy: { name: "asc" }
  });
  return rows.map(toVendor);
}

async function saveVendor(user: Express.UserContext, input: VendorInput, id?: string) {
  assertManager(user);
  const data = {
    name: input.name,
    phone: input.phone ?? null,
    email: input.email ?? null,
    gstin: input.gstin ?? null,
    address: input.address ?? null,
    notes: input.notes ?? null
  };
  try {
    if (!id) {
      return toVendor(await prisma.inventoryVendor.create({ data: { ...data, schoolId: user.schoolId }, select: vendorSelect }));
    }
    const existing = await prisma.inventoryVendor.findFirst({ where: { id, schoolId: user.schoolId }, select: { id: true } });
    if (!existing) throw notFound("Vendor");
    return toVendor(await prisma.inventoryVendor.update({ where: { id }, data, select: vendorSelect }));
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(409, `A vendor named "${input.name}" already exists.`, "VENDOR_EXISTS");
    throw error;
  }
}

export const createVendor = (user: Express.UserContext, input: VendorInput) => saveVendor(user, input);
export const updateVendor = (user: Express.UserContext, id: string, input: VendorInput) => saveVendor(user, input, id);

/** Purchases recorded against the vendor are kept; they lose the vendor link. */
export async function deleteVendor(user: Express.UserContext, id: string) {
  assertManager(user);
  const { count } = await prisma.inventoryVendor.deleteMany({ where: { id, schoolId: user.schoolId } });
  if (count === 0) throw notFound("Vendor");
}

// -------------------------------------------------------------------- items

type ItemInput = {
  name: string;
  categoryId?: string | null;
  sku?: string | null;
  type: InventoryItemType;
  unit: string;
  reorderLevel: number;
  location?: string | null;
  notes?: string | null;
  isActive?: boolean;
  openingQuantity?: number;
  openingUnitCost?: number | null;
};

type ItemFilters = {
  search?: string;
  categoryId?: string;
  type?: InventoryItemType;
  lowStock?: boolean;
  includeInactive?: boolean;
};

export async function listItems(user: Express.UserContext, filters: ItemFilters) {
  assertManager(user);
  const where: Prisma.InventoryItemWhereInput = { schoolId: user.schoolId };
  if (!filters.includeInactive) where.isActive = true;
  if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.type) where.type = filters.type;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { sku: { contains: filters.search, mode: "insensitive" } }
    ];
  }

  const rows = await prisma.inventoryItem.findMany({ where, select: itemSelect, orderBy: { name: "asc" } });
  const items = rows.map(toItem);
  // A column-to-column comparison (quantity <= reorderLevel) is awkward in
  // Prisma, so the low-stock filter is applied after mapping.
  return filters.lowStock ? items.filter((item) => item.lowStock) : items;
}

async function assertCategory(user: Express.UserContext, categoryId?: string | null) {
  if (!categoryId) return;
  const category = await prisma.inventoryCategory.findFirst({ where: { id: categoryId, schoolId: user.schoolId }, select: { id: true } });
  if (!category) throw notFound("Category");
}

export async function getItem(user: Express.UserContext, id: string) {
  assertManager(user);
  const item = await prisma.inventoryItem.findFirst({ where: { id, schoolId: user.schoolId }, select: itemSelect });
  if (!item) throw notFound("Item");

  const transactions = await prisma.inventoryTransaction.findMany({
    where: { schoolId: user.schoolId, itemId: id },
    select: txnSelect,
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
  });

  return { ...toItem(item), transactions: transactions.map(toTxn) };
}

async function saveItem(user: Express.UserContext, input: ItemInput, id?: string) {
  assertManager(user);
  await assertCategory(user, input.categoryId);

  const data = {
    name: input.name,
    categoryId: input.categoryId ?? null,
    sku: input.sku ?? null,
    type: input.type,
    unit: input.unit,
    reorderLevel: input.reorderLevel,
    location: input.location ?? null,
    notes: input.notes ?? null,
    ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
  };

  try {
    if (!id) {
      const created = await prisma.inventoryItem.create({ data: { ...data, schoolId: user.schoolId }, select: itemSelect });
      // Starting stock is recorded as the item's first purchase, so it shows in
      // the ledger and values the stock on hand straight away.
      if (input.openingQuantity && input.openingQuantity > 0) {
        const result = await recordTransaction(user, created.id, {
          type: "PURCHASE",
          quantity: input.openingQuantity,
          unitCost: input.openingUnitCost ?? null,
          note: "Opening stock"
        });
        return result.item;
      }
      return toItem(created);
    }
    const existing = await prisma.inventoryItem.findFirst({ where: { id, schoolId: user.schoolId }, select: { id: true } });
    if (!existing) throw notFound("Item");
    return toItem(await prisma.inventoryItem.update({ where: { id }, data, select: itemSelect }));
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(409, `An item named "${input.name}" already exists.`, "ITEM_EXISTS");
    throw error;
  }
}

export const createItem = (user: Express.UserContext, input: ItemInput) => saveItem(user, input);
export const updateItem = (user: Express.UserContext, id: string, input: ItemInput) => saveItem(user, input, id);

/** Allowed only before any stock has moved; otherwise archive to keep history. */
export async function deleteItem(user: Express.UserContext, id: string) {
  assertManager(user);
  const item = await prisma.inventoryItem.findFirst({
    where: { id, schoolId: user.schoolId },
    select: { id: true, _count: { select: { transactions: true } } }
  });
  if (!item) throw notFound("Item");
  if (item._count.transactions > 0) {
    throw new AppError(409, "This item has stock movements. Archive it instead of deleting.", "ITEM_HAS_HISTORY");
  }
  await prisma.inventoryItem.delete({ where: { id } });
}

// ------------------------------------------------------------- transactions

type TxnInput = {
  type: InventoryTxnType;
  quantity?: number;
  quantityDelta?: number;
  unitCost?: number | null;
  totalCost?: number | null;
  vendorId?: string | null;
  invoiceNumber?: string | null;
  issuedTo?: string | null;
  reason?: string | null;
  note?: string | null;
  occurredAt?: Date;
};

/**
 * Applies one movement to an item's stock and writes the ledger row. The item
 * quantity and the transaction are updated inside a single DB transaction so a
 * failure can never leave the running balance and the history disagreeing.
 */
export async function recordTransaction(user: Express.UserContext, itemId: string, input: TxnInput) {
  assertManager(user);

  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId, schoolId: user.schoolId },
    select: { id: true, quantity: true, isActive: true }
  });
  if (!item) throw notFound("Item");
  if (!item.isActive) throw new AppError(400, "This item is archived. Restore it before recording stock.", "ITEM_ARCHIVED");

  let delta: number;
  if (input.type === "ADJUSTMENT") {
    delta = input.quantityDelta ?? 0;
  } else if (input.type === "PURCHASE") {
    delta = input.quantity ?? 0;
  } else {
    delta = -(input.quantity ?? 0);
  }
  if (delta === 0) throw new AppError(400, "A stock movement cannot be zero.", "ZERO_MOVEMENT");

  const newQuantity = item.quantity + delta;
  if (newQuantity < 0) {
    throw new AppError(400, `Only ${item.quantity} in stock — cannot remove ${Math.abs(delta)}.`, "INSUFFICIENT_STOCK");
  }

  // A vendor and a bill belong to a purchase only.
  let vendorId: string | null = null;
  if (input.type === "PURCHASE" && input.vendorId) {
    const vendor = await prisma.inventoryVendor.findFirst({ where: { id: input.vendorId, schoolId: user.schoolId }, select: { id: true } });
    if (!vendor) throw notFound("Vendor");
    vendorId = vendor.id;
  }

  // Cost is a purchase concept. Derive whichever of unit/total was not given.
  let unitCost: number | null = null;
  let totalCost: number | null = null;
  if (input.type === "PURCHASE") {
    const qty = input.quantity ?? 0;
    if (input.unitCost != null) {
      unitCost = input.unitCost;
      totalCost = input.totalCost != null ? input.totalCost : round2(input.unitCost * qty);
    } else if (input.totalCost != null) {
      totalCost = input.totalCost;
      unitCost = qty > 0 ? round2(input.totalCost / qty) : null;
    }
  }

  const [updatedItem, txn] = await prisma.$transaction([
    prisma.inventoryItem.update({
      where: { id: item.id },
      data: {
        quantity: newQuantity,
        // A purchase price becomes the item's current valuation rate.
        ...(input.type === "PURCHASE" && unitCost != null ? { lastUnitCost: unitCost } : {})
      },
      select: itemSelect
    }),
    prisma.inventoryTransaction.create({
      data: {
        schoolId: user.schoolId,
        itemId: item.id,
        type: input.type,
        quantityDelta: delta,
        balanceAfter: newQuantity,
        unitCost,
        totalCost,
        vendorId,
        invoiceNumber: input.type === "PURCHASE" ? input.invoiceNumber ?? null : null,
        issuedTo: input.type === "ISSUE" ? input.issuedTo ?? null : null,
        reason: input.type === "ADJUSTMENT" ? input.reason ?? null : null,
        note: input.note ?? null,
        occurredAt: input.occurredAt ?? new Date(),
        recordedById: user.id
      },
      select: txnSelect
    })
  ]);

  return { item: toItem(updatedItem), transaction: toTxn(txn) };
}

type TxnFilters = {
  type?: InventoryTxnType;
  itemId?: string;
  vendorId?: string;
  from?: Date;
  to?: Date;
  limit: number;
};

export async function listTransactions(user: Express.UserContext, filters: TxnFilters) {
  assertManager(user);
  const where: Prisma.InventoryTransactionWhereInput = { schoolId: user.schoolId };
  if (filters.type) where.type = filters.type;
  if (filters.itemId) where.itemId = filters.itemId;
  if (filters.vendorId) where.vendorId = filters.vendorId;
  if (filters.from || filters.to) {
    where.occurredAt = {};
    if (filters.from) where.occurredAt.gte = filters.from;
    if (filters.to) where.occurredAt.lte = filters.to;
  }

  const rows = await prisma.inventoryTransaction.findMany({
    where,
    select: txnSelect,
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: filters.limit
  });
  return rows.map(toTxn);
}

// ------------------------------------------------------------------ overview

export async function overview(user: Express.UserContext) {
  assertManager(user);

  const [itemRows, vendorCount, recent] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { schoolId: user.schoolId, isActive: true }, select: itemSelect, orderBy: { name: "asc" } }),
    prisma.inventoryVendor.count({ where: { schoolId: user.schoolId } }),
    prisma.inventoryTransaction.findMany({
      where: { schoolId: user.schoolId },
      select: txnSelect,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 8
    })
  ]);

  const items = itemRows.map(toItem);
  const lowStockItems = items.filter((item) => item.lowStock);
  const stockValue = round2(items.reduce((sum, item) => sum + (item.stockValue ?? 0), 0));

  return {
    summary: {
      items: items.length,
      consumables: items.filter((item) => item.type === "CONSUMABLE").length,
      assets: items.filter((item) => item.type === "ASSET").length,
      lowStock: lowStockItems.length,
      outOfStock: items.filter((item) => item.quantity === 0).length,
      stockValue,
      vendors: vendorCount
    },
    lowStockItems,
    recentTransactions: recent.map(toTxn)
  };
}

// -------------------------------------------------------------------- report

type ReportQuery = { from?: Date; to?: Date };

/**
 * Stock on hand valued by category, plus purchases and issues over a period
 * (the whole history when no dates are given).
 */
export async function report(user: Express.UserContext, query: ReportQuery) {
  assertManager(user);

  const occurredAt: Prisma.DateTimeFilter = {};
  if (query.from) occurredAt.gte = query.from;
  if (query.to) occurredAt.lte = query.to;
  const hasRange = Boolean(query.from || query.to);

  const [itemRows, movements] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { schoolId: user.schoolId, isActive: true }, select: itemSelect, orderBy: { name: "asc" } }),
    prisma.inventoryTransaction.findMany({
      where: { schoolId: user.schoolId, ...(hasRange ? { occurredAt } : {}) },
      select: {
        type: true,
        quantityDelta: true,
        totalCost: true,
        vendor: { select: { id: true, name: true } },
        item: { select: { id: true, name: true, unit: true } }
      }
    })
  ]);

  const items = itemRows.map(toItem);

  const categoryMap = new Map<string, { categoryId: string | null; name: string; items: number; quantity: number; stockValue: number }>();
  for (const item of items) {
    const key = item.category?.id ?? "none";
    const entry =
      categoryMap.get(key) ?? { categoryId: item.category?.id ?? null, name: item.category?.name ?? "Uncategorised", items: 0, quantity: 0, stockValue: 0 };
    entry.items += 1;
    entry.quantity += item.quantity;
    entry.stockValue += item.stockValue ?? 0;
    categoryMap.set(key, entry);
  }

  const vendorMap = new Map<string, { vendorId: string | null; name: string; purchases: number; spend: number }>();
  const issueMap = new Map<string, { itemId: string; name: string; unit: string; quantity: number }>();
  let purchaseSpend = 0;
  let purchaseCount = 0;
  let issuedUnits = 0;
  let issueCount = 0;

  for (const movement of movements) {
    if (movement.type === "PURCHASE") {
      purchaseCount += 1;
      const spend = num(movement.totalCost) ?? 0;
      purchaseSpend += spend;
      const key = movement.vendor?.id ?? "none";
      const entry = vendorMap.get(key) ?? { vendorId: movement.vendor?.id ?? null, name: movement.vendor?.name ?? "No vendor", purchases: 0, spend: 0 };
      entry.purchases += 1;
      entry.spend += spend;
      vendorMap.set(key, entry);
    } else if (movement.type === "ISSUE") {
      issueCount += 1;
      const units = Math.abs(movement.quantityDelta);
      issuedUnits += units;
      const entry = issueMap.get(movement.item.id) ?? { itemId: movement.item.id, name: movement.item.name, unit: movement.item.unit, quantity: 0 };
      entry.quantity += units;
      issueMap.set(movement.item.id, entry);
    }
  }

  return {
    range: { from: query.from ?? null, to: query.to ?? null },
    summary: {
      items: items.length,
      stockValue: round2(items.reduce((sum, item) => sum + (item.stockValue ?? 0), 0)),
      lowStock: items.filter((item) => item.lowStock).length,
      purchaseCount,
      purchaseSpend: round2(purchaseSpend),
      issueCount,
      issuedUnits
    },
    stockByCategory: [...categoryMap.values()]
      .map((entry) => ({ ...entry, stockValue: round2(entry.stockValue) }))
      .sort((a, b) => b.stockValue - a.stockValue),
    purchasesByVendor: [...vendorMap.values()].map((entry) => ({ ...entry, spend: round2(entry.spend) })).sort((a, b) => b.spend - a.spend),
    topIssuedItems: [...issueMap.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10),
    lowStockItems: items.filter((item) => item.lowStock)
  };
}
