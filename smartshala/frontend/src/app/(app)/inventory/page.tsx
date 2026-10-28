"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatDateShort, formatDateTimeShort, formatINR } from "@/lib/formatters";
import {
  inventoryApi,
  type InventoryCategory,
  type InventoryItem,
  type InventoryItemDetail,
  type InventoryItemType,
  type InventoryOverview,
  type InventoryReport,
  type InventoryTransaction,
  type InventoryTxnType,
  type InventoryVendor
} from "@/lib/api";

type Tab = "items" | "vendors" | "history" | "report";

const fieldClass =
  "min-h-11 w-full rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-[14px] font-medium text-[#031526] outline-none transition focus:border-[#2456E6] focus:ring-2 focus:ring-[#2456E6]/10";
const primaryButton = "min-h-10 rounded-[6px] bg-[#2456E6] px-4 text-[13px] font-semibold text-white hover:bg-[#1B45BD] disabled:opacity-50";
const secondaryButton = "min-h-10 rounded-[6px] border border-[#C2C9D4] bg-white px-4 text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB] disabled:opacity-50";
const smallButton = "min-h-9 shrink-0 rounded-[6px] border border-[#C2C9D4] bg-white px-3 text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB] disabled:opacity-50";

function errorText(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

const money = (value: number | null | undefined) => (value === null || value === undefined ? "—" : formatINR(value));

const txnTone: Record<InventoryTxnType, "good" | "danger" | "warn"> = {
  PURCHASE: "good",
  ISSUE: "danger",
  ADJUSTMENT: "warn"
};

const txnLabel: Record<InventoryTxnType, string> = {
  PURCHASE: "Stock in",
  ISSUE: "Stock out",
  ADJUSTMENT: "Adjustment"
};

function TypeBadge({ type }: { type: InventoryItemType }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${
        type === "ASSET" ? "bg-[#EEE7FF] text-[#6B3FD4]" : "bg-[#E2F0FB] text-[#1B5FB0]"
      }`}
    >
      {type === "ASSET" ? "Asset" : "Consumable"}
    </span>
  );
}

function StockCell({ item }: { item: InventoryItem }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-[14px] font-semibold text-[#0F1419] [font-variant-numeric:tabular-nums]">
        {item.quantity} <span className="text-[12px] font-medium text-[#6F7480]">{item.unit}</span>
      </span>
      {item.quantity === 0 ? (
        <StatusPill label="Out of stock" tone="danger" />
      ) : item.lowStock ? (
        <StatusPill label="Low stock" tone="warn" />
      ) : null}
    </div>
  );
}

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("items");
  const [overview, setOverview] = useState<InventoryOverview | null>(null);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [vendors, setVendors] = useState<InventoryVendor[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadShared = useCallback(async () => {
    try {
      const [ov, cats, vends] = await Promise.all([inventoryApi.overview(), inventoryApi.categories(), inventoryApi.vendors()]);
      setOverview(ov);
      setCategories(cats);
      setVendors(vends);
    } catch (err) {
      setError(errorText(err, "Unable to load inventory"));
    }
  }, []);

  useEffect(() => {
    loadShared();
  }, [loadShared]);

  const refresh = useCallback(
    async (message?: string) => {
      if (message) setNotice(message);
      await loadShared();
    },
    [loadShared]
  );

  const summary = overview?.summary;
  const tiles = [
    { label: "Items", value: summary ? String(summary.items) : "—", bg: "bg-[#E5F7FF]" },
    { label: "Low / out of stock", value: summary ? String(summary.lowStock + summary.outOfStock) : "—", bg: "bg-[#FFF0E8]" },
    { label: "Stock value", value: summary ? formatINR(summary.stockValue) : "—", bg: "bg-[#EAF9EB]" },
    { label: "Vendors", value: summary ? String(summary.vendors) : "—", bg: "bg-[#F1E4FF]" }
  ];

  const [itemDraftOpen, setItemDraftOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const tabs: { key: Tab; label: string }[] = [
    { key: "items", label: "Items" },
    { key: "vendors", label: "Vendors" },
    { key: "history", label: "History" },
    { key: "report", label: "Report" }
  ];

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">School Management</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-[#1d1d1f]">Inventory Management</h1>
          <p className="mt-1 text-[13px] text-[#5A6573]">Track consumables and assets, record purchases and issues, and keep a running stock value.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={secondaryButton} onClick={() => setCategoriesOpen(true)} type="button">Manage Categories</button>
          <button
            className={primaryButton}
            onClick={() => {
              setEditItem(null);
              setItemDraftOpen(true);
            }}
            type="button"
          >
            Add Item
          </button>
        </div>
      </div>

      {error ? <div className="rounded-[8px] bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C]">{error}</div> : null}
      {notice ? (
        <div className="flex items-center justify-between rounded-[8px] bg-[#E1F5EA] px-4 py-3 text-[13px] font-semibold text-[#0F8A4A]">
          <span>{notice}</span>
          <button className="underline-offset-2 hover:underline" onClick={() => setNotice("")} type="button">Dismiss</button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {tiles.map((tile) => (
          <div className={`rounded-[8px] px-5 py-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] ${tile.bg}`} key={tile.label}>
            <p className="truncate text-[14px] font-medium text-[#6F7480]">{tile.label}</p>
            <p className="mt-1.5 truncate text-[22px] font-bold text-[#111827] [font-variant-numeric:tabular-nums] sm:text-[26px]">{tile.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-[8px] border border-[#DCE1E8] bg-white p-1">
        {tabs.map((entry) => (
          <button
            className={`min-h-9 shrink-0 rounded-[6px] px-4 text-[13px] font-semibold transition ${
              tab === entry.key ? "bg-[#2456E6] text-white" : "text-[#2A3340] hover:bg-[#F2F5FA]"
            }`}
            key={entry.key}
            onClick={() => setTab(entry.key)}
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "items" ? (
        <ItemsTab
          categories={categories}
          onEdit={(item) => {
            setEditItem(item);
            setItemDraftOpen(true);
          }}
          onError={setError}
          onNotice={refresh}
          vendors={vendors}
        />
      ) : null}
      {tab === "vendors" ? <VendorsTab onError={setError} onNotice={refresh} vendors={vendors} /> : null}
      {tab === "history" ? <HistoryTab onError={setError} /> : null}
      {tab === "report" ? <ReportTab onError={setError} /> : null}

      <ItemModal
        categories={categories}
        isOpen={itemDraftOpen}
        item={editItem}
        onClose={() => setItemDraftOpen(false)}
        onSaved={async (message) => {
          setItemDraftOpen(false);
          await refresh(message);
        }}
      />

      <CategoriesModal
        categories={categories}
        isOpen={categoriesOpen}
        onChanged={() => refresh()}
        onClose={() => setCategoriesOpen(false)}
      />
    </div>
  );
}

// =========================================================== Items tab

function ItemsTab({
  categories,
  vendors,
  onEdit,
  onError,
  onNotice
}: {
  categories: InventoryCategory[];
  vendors: InventoryVendor[];
  onEdit: (item: InventoryItem) => void;
  onError: (message: string) => void;
  onNotice: (message: string) => Promise<void>;
}) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);

  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [ledgerId, setLedgerId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(
        await inventoryApi.items({
          search: search.trim() || undefined,
          categoryId: categoryId || undefined,
          type: (type || undefined) as InventoryItemType | undefined,
          lowStock: lowStock || undefined,
          includeInactive: includeInactive || undefined
        })
      );
    } catch (err) {
      onError(errorText(err, "Unable to load items"));
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, type, lowStock, includeInactive, onError]);

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input
          className={`${fieldClass} sm:max-w-[240px]`}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name or SKU"
          value={search}
        />
        <CustomSelect
          ariaLabel="Category"
          className="h-11 text-[14px]"
          onChange={setCategoryId}
          options={[{ label: "All categories", value: "" }, ...categories.map((category) => ({ label: category.name, value: category.id }))]}
          value={categoryId}
          wrapperClassName="block w-full sm:w-[180px]"
        />
        <CustomSelect
          ariaLabel="Type"
          className="h-11 text-[14px]"
          onChange={setType}
          options={[
            { label: "All types", value: "" },
            { label: "Consumable", value: "CONSUMABLE" },
            { label: "Asset", value: "ASSET" }
          ]}
          value={type}
          wrapperClassName="block w-full sm:w-[150px]"
        />
        <label className="flex min-h-11 items-center gap-2 rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-[13px] font-semibold text-[#2A3340]">
          <input checked={lowStock} onChange={(event) => setLowStock(event.target.checked)} type="checkbox" /> Low stock only
        </label>
        <label className="flex min-h-11 items-center gap-2 rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-[13px] font-semibold text-[#2A3340]">
          <input checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} type="checkbox" /> Show archived
        </label>
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white">
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-14" key={index} />)}</div>
        ) : items.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] font-medium text-[#86868b]">No items match. Add an item to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#DCE1E8] bg-[#F7F8FB] text-[12px] font-semibold uppercase tracking-wide text-[#5A6573]">
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">In stock</th>
                  <th className="px-4 py-2.5 text-right">Reorder</th>
                  <th className="px-4 py-2.5 text-right">Value</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF1F5]">
                {items.map((item) => (
                  <tr className={item.isActive ? "" : "opacity-60"} key={item.id}>
                    <td className="px-4 py-3">
                      <button className="text-left" onClick={() => setLedgerId(item.id)} type="button">
                        <p className="text-[14px] font-semibold text-[#0F1419] hover:text-[#2456E6]">{item.name}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-[12px] text-[#5A6573]">
                          <TypeBadge type={item.type} />
                          {item.sku ? <span>SKU {item.sku}</span> : null}
                          {!item.isActive ? <span className="font-semibold text-[#B95A00]">Archived</span> : null}
                        </p>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[#2A3340]">{item.category?.name ?? "—"}</td>
                    <td className="px-4 py-3"><StockCell item={item} /></td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#2A3340] [font-variant-numeric:tabular-nums]">{item.reorderLevel || "—"}</td>
                    <td className="px-4 py-3 text-right text-[13px] font-semibold text-[#0F1419] [font-variant-numeric:tabular-nums]">{money(item.stockValue)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button className={smallButton} disabled={!item.isActive} onClick={() => setMovementItem(item)} type="button">Record</button>
                        <button className={smallButton} onClick={() => onEdit(item)} type="button">Edit</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {movementItem ? (
        <MovementModal
          isOpen={Boolean(movementItem)}
          item={movementItem}
          onClose={() => setMovementItem(null)}
          onSaved={async (message) => {
            setMovementItem(null);
            await onNotice(message);
            await load();
          }}
          vendors={vendors}
        />
      ) : null}

      <LedgerModal isOpen={Boolean(ledgerId)} itemId={ledgerId} onClose={() => setLedgerId(null)} />
    </div>
  );
}

// =========================================================== Vendors tab

function VendorsTab({
  vendors,
  onError,
  onNotice
}: {
  vendors: InventoryVendor[];
  onError: (message: string) => void;
  onNotice: (message: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<InventoryVendor | "new" | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className={primaryButton} onClick={() => setDraft("new")} type="button">Add Vendor</button>
      </div>
      <section className="overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white">
        {vendors.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] font-medium text-[#86868b]">No vendors yet. Add the suppliers you buy stock from.</p>
        ) : (
          <div className="divide-y divide-[#EEF1F5]">
            {vendors.map((vendor) => (
              <div className="flex items-center justify-between gap-3 px-4 py-3" key={vendor.id}>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-[#0F1419]">{vendor.name}</p>
                  <p className="truncate text-[12px] text-[#5A6573]">
                    {[vendor.phone, vendor.email, vendor.gstin ? `GSTIN ${vendor.gstin}` : null].filter(Boolean).join(" · ") || "No contact details"}
                    {" · "}
                    {vendor.purchaseCount} {vendor.purchaseCount === 1 ? "purchase" : "purchases"}
                  </p>
                </div>
                <button className={smallButton} onClick={() => setDraft(vendor)} type="button">Edit</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <VendorModal
        isOpen={Boolean(draft)}
        onClose={() => setDraft(null)}
        onError={onError}
        onSaved={async (message) => {
          setDraft(null);
          await onNotice(message);
        }}
        vendor={draft === "new" ? null : draft}
      />
    </div>
  );
}

// =========================================================== History tab

function HistoryTab({ onError }: { onError: (message: string) => void }) {
  const [rows, setRows] = useState<InventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(
        await inventoryApi.transactions({
          type: (type || undefined) as InventoryTxnType | undefined,
          from: from || undefined,
          to: to || undefined,
          limit: 200
        })
      );
    } catch (err) {
      onError(errorText(err, "Unable to load history"));
    } finally {
      setLoading(false);
    }
  }, [type, from, to, onError]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <CustomSelect
          ariaLabel="Movement type"
          className="h-11 text-[14px]"
          onChange={setType}
          options={[
            { label: "All movements", value: "" },
            { label: "Stock in (purchase)", value: "PURCHASE" },
            { label: "Stock out (issue)", value: "ISSUE" },
            { label: "Adjustment", value: "ADJUSTMENT" }
          ]}
          value={type}
          wrapperClassName="block w-full sm:w-[220px]"
        />
        <label className="flex items-center gap-2 text-[13px] font-semibold text-[#2A3340]">
          From <input className={`${fieldClass} sm:w-[160px]`} onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
        </label>
        <label className="flex items-center gap-2 text-[13px] font-semibold text-[#2A3340]">
          To <input className={`${fieldClass} sm:w-[160px]`} onChange={(event) => setTo(event.target.value)} type="date" value={to} />
        </label>
        {from || to || type ? (
          <button className={smallButton} onClick={() => { setType(""); setFrom(""); setTo(""); }} type="button">Clear</button>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white">
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-12" key={index} />)}</div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] font-medium text-[#86868b]">No stock movements recorded in this range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#DCE1E8] bg-[#F7F8FB] text-[12px] font-semibold uppercase tracking-wide text-[#5A6573]">
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-4 py-2.5">Movement</th>
                  <th className="px-4 py-2.5 text-right">Change</th>
                  <th className="px-4 py-2.5 text-right">Balance</th>
                  <th className="px-4 py-2.5 text-right">Value</th>
                  <th className="px-4 py-2.5">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF1F5]">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-[12px] text-[#5A6573]">{formatDateShort(row.occurredAt)}</td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-[#0F1419]">{row.item.name}</td>
                    <td className="px-4 py-3"><StatusPill label={txnLabel[row.type]} tone={txnTone[row.type]} /></td>
                    <td className={`px-4 py-3 text-right text-[13px] font-semibold [font-variant-numeric:tabular-nums] ${row.quantityDelta >= 0 ? "text-[#0F8A4A]" : "text-[#C8242C]"}`}>
                      {row.quantityDelta >= 0 ? "+" : ""}{row.quantityDelta} {row.item.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#2A3340] [font-variant-numeric:tabular-nums]">{row.balanceAfter}</td>
                    <td className="px-4 py-3 text-right text-[13px] text-[#2A3340] [font-variant-numeric:tabular-nums]">{money(row.totalCost)}</td>
                    <td className="px-4 py-3 text-[12px] text-[#5A6573]">
                      {[
                        row.vendor?.name,
                        row.invoiceNumber ? `Bill ${row.invoiceNumber}` : null,
                        row.issuedTo ? `To ${row.issuedTo}` : null,
                        row.reason,
                        row.note
                      ]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// =========================================================== Report tab

function ReportTab({ onError }: { onError: (message: string) => void }) {
  const [report, setReport] = useState<InventoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReport(await inventoryApi.report({ from: from || undefined, to: to || undefined }));
    } catch (err) {
      onError(errorText(err, "Unable to load the report"));
    } finally {
      setLoading(false);
    }
  }, [from, to, onError]);

  useEffect(() => {
    load();
  }, [load]);

  const cards = report
    ? [
        { label: "Stock value", value: formatINR(report.summary.stockValue) },
        { label: "Purchases", value: `${formatINR(report.summary.purchaseSpend)} · ${report.summary.purchaseCount}` },
        { label: "Units issued", value: `${report.summary.issuedUnits} · ${report.summary.issueCount} movements` },
        { label: "Low stock items", value: String(report.summary.lowStock) }
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-[8px] border border-[#DCE1E8] bg-white p-3 sm:flex-row sm:items-center">
        <p className="text-[13px] font-semibold text-[#2A3340]">Purchases &amp; issues between</p>
        <input className={`${fieldClass} sm:w-[160px]`} onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
        <span className="text-[13px] text-[#5A6573]">and</span>
        <input className={`${fieldClass} sm:w-[160px]`} onChange={(event) => setTo(event.target.value)} type="date" value={to} />
        {from || to ? <button className={smallButton} onClick={() => { setFrom(""); setTo(""); }} type="button">All time</button> : null}
      </div>

      {loading || !report ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, index) => <Skeleton className="h-28" key={index} />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {cards.map((card) => (
              <div className="rounded-[8px] border border-[#DCE1E8] bg-white px-4 py-3" key={card.label}>
                <p className="text-[12px] font-medium text-[#6F7480]">{card.label}</p>
                <p className="mt-1 text-[16px] font-bold text-[#111827]">{card.value}</p>
              </div>
            ))}
          </div>

          <ReportSection title="Stock value by category">
            {report.stockByCategory.length === 0 ? (
              <EmptyRow>No active stock.</EmptyRow>
            ) : (
              report.stockByCategory.map((row) => (
                <ReportRow
                  key={row.categoryId ?? "none"}
                  primary={row.name}
                  secondary={`${row.items} ${row.items === 1 ? "item" : "items"} · ${row.quantity} units`}
                  value={formatINR(row.stockValue)}
                />
              ))
            )}
          </ReportSection>

          <ReportSection title="Purchases by vendor">
            {report.purchasesByVendor.length === 0 ? (
              <EmptyRow>No purchases in this range.</EmptyRow>
            ) : (
              report.purchasesByVendor.map((row) => (
                <ReportRow
                  key={row.vendorId ?? "none"}
                  primary={row.name}
                  secondary={`${row.purchases} ${row.purchases === 1 ? "purchase" : "purchases"}`}
                  value={formatINR(row.spend)}
                />
              ))
            )}
          </ReportSection>

          <ReportSection title="Most issued items">
            {report.topIssuedItems.length === 0 ? (
              <EmptyRow>No items issued in this range.</EmptyRow>
            ) : (
              report.topIssuedItems.map((row) => (
                <ReportRow key={row.itemId} primary={row.name} secondary="" value={`${row.quantity} ${row.unit}`} />
              ))
            )}
          </ReportSection>

          {report.lowStockItems.length > 0 ? (
            <ReportSection title={`Low stock (${report.lowStockItems.length})`}>
              {report.lowStockItems.map((item) => (
                <ReportRow
                  key={item.id}
                  primary={item.name}
                  secondary={`Reorder at ${item.reorderLevel} ${item.unit}`}
                  value={`${item.quantity} ${item.unit}`}
                  valueTone="danger"
                />
              ))}
            </ReportSection>
          ) : null}
        </>
      )}
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white">
      <h2 className="border-b border-[#DCE1E8] px-4 py-3 text-[15px] font-semibold text-[#0F1419]">{title}</h2>
      <div className="divide-y divide-[#EEF1F5]">{children}</div>
    </section>
  );
}

function ReportRow({ primary, secondary, value, valueTone }: { primary: string; secondary: string; value: string; valueTone?: "danger" }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-[#0F1419]">{primary}</p>
        {secondary ? <p className="truncate text-[12px] text-[#5A6573]">{secondary}</p> : null}
      </div>
      <p className={`shrink-0 text-[14px] font-semibold [font-variant-numeric:tabular-nums] ${valueTone === "danger" ? "text-[#C8242C]" : "text-[#0F1419]"}`}>{value}</p>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-6 text-center text-[13px] text-[#86868b]">{children}</p>;
}

// =========================================================== Item modal

type ItemDraft = {
  name: string;
  categoryId: string;
  sku: string;
  type: InventoryItemType;
  unit: string;
  reorderLevel: string;
  location: string;
  notes: string;
  isActive: boolean;
  openingQuantity: string;
  openingUnitCost: string;
};

const emptyItemDraft: ItemDraft = {
  name: "",
  categoryId: "",
  sku: "",
  type: "CONSUMABLE",
  unit: "unit",
  reorderLevel: "0",
  location: "",
  notes: "",
  isActive: true,
  openingQuantity: "",
  openingUnitCost: ""
};

function ItemModal({
  categories,
  isOpen,
  item,
  onClose,
  onSaved
}: {
  categories: InventoryCategory[];
  isOpen: boolean;
  item: InventoryItem | null;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ItemDraft>(emptyItemDraft);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setFormError("");
    setDraft(
      item
        ? {
            name: item.name,
            categoryId: item.category?.id ?? "",
            sku: item.sku ?? "",
            type: item.type,
            unit: item.unit,
            reorderLevel: String(item.reorderLevel),
            location: item.location ?? "",
            notes: item.notes ?? "",
            isActive: item.isActive,
            openingQuantity: "",
            openingUnitCost: ""
          }
        : emptyItemDraft
    );
  }, [isOpen, item]);

  function save() {
    if (draft.name.trim().length < 2) return setFormError("Give the item a name.");
    if (draft.unit.trim().length < 1) return setFormError("Set a unit (e.g. pcs, litre, box).");
    const reorderLevel = Number(draft.reorderLevel || 0);
    if (!Number.isInteger(reorderLevel) || reorderLevel < 0) return setFormError("Reorder level is a whole number, zero or more.");

    const payload = {
      name: draft.name.trim(),
      categoryId: draft.categoryId || null,
      sku: draft.sku.trim() || null,
      type: draft.type,
      unit: draft.unit.trim(),
      reorderLevel,
      location: draft.location.trim() || null,
      notes: draft.notes.trim() || null,
      isActive: draft.isActive,
      ...(item
        ? {}
        : {
            openingQuantity: draft.openingQuantity ? Number(draft.openingQuantity) : undefined,
            openingUnitCost: draft.openingUnitCost ? Number(draft.openingUnitCost) : undefined
          })
    };
    if (!item && payload.openingQuantity !== undefined && (!Number.isInteger(payload.openingQuantity) || payload.openingQuantity < 0)) {
      return setFormError("Opening stock is a whole number, zero or more.");
    }

    setSaving(true);
    setFormError("");
    (async () => {
      try {
        if (item) await inventoryApi.updateItem(item.id, payload);
        else await inventoryApi.createItem(payload);
        await onSaved(item ? "Item saved." : "Item added.");
      } catch (err) {
        setFormError(errorText(err, "Unable to save the item"));
      } finally {
        setSaving(false);
      }
    })();
  }

  function remove() {
    if (!item) return;
    if (!window.confirm(`Delete ${item.name}? This is only possible before any stock has moved.`)) return;
    setSaving(true);
    setFormError("");
    (async () => {
      try {
        await inventoryApi.removeItem(item.id);
        await onSaved("Item deleted.");
      } catch (err) {
        setFormError(errorText(err, "Unable to delete the item"));
      } finally {
        setSaving(false);
      }
    })();
  }

  return (
    <Modal
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {item ? (
            <button className="min-h-10 rounded-[6px] px-4 text-[13px] font-semibold text-[#C8242C] hover:bg-[#FCE3E5] disabled:opacity-50" disabled={saving} onClick={remove} type="button">Delete item</button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button className={`${secondaryButton} flex-1 sm:flex-none`} onClick={onClose} type="button">Cancel</button>
            <button className={`${primaryButton} flex-1 sm:flex-none`} disabled={saving} onClick={save} type="button">{saving ? "Saving..." : "Save item"}</button>
          </div>
        </div>
      }
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={item ? "Edit Item" : "Add Item"}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-[13px] font-semibold text-[#0F1419]">Item name<span className="ml-1 text-[#C8242C]">*</span></span>
            <input className={`${fieldClass} mt-1.5`} maxLength={120} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="A4 paper ream" value={draft.name} />
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-[#0F1419]">Category</span>
            <CustomSelect
              ariaLabel="Category"
              className="h-11 w-full text-[14px]"
              onChange={(value) => setDraft({ ...draft, categoryId: value })}
              options={[{ label: "No category", value: "" }, ...categories.map((category) => ({ label: category.name, value: category.id }))]}
              value={draft.categoryId}
              wrapperClassName="mt-1.5 block w-full"
            />
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-[#0F1419]">Type</span>
            <CustomSelect
              ariaLabel="Type"
              className="h-11 w-full text-[14px]"
              onChange={(value) => setDraft({ ...draft, type: value as InventoryItemType })}
              options={[
                { label: "Consumable", value: "CONSUMABLE" },
                { label: "Asset", value: "ASSET" }
              ]}
              value={draft.type}
              wrapperClassName="mt-1.5 block w-full"
            />
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-[#0F1419]">Unit<span className="ml-1 text-[#C8242C]">*</span></span>
            <input className={`${fieldClass} mt-1.5`} maxLength={20} onChange={(event) => setDraft({ ...draft, unit: event.target.value })} placeholder="pcs, box, litre" value={draft.unit} />
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-[#0F1419]">Reorder level</span>
            <input className={`${fieldClass} mt-1.5`} inputMode="numeric" min="0" onChange={(event) => setDraft({ ...draft, reorderLevel: event.target.value.replace(/\D/g, "") })} placeholder="0" value={draft.reorderLevel} />
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-[#0F1419]">SKU / code</span>
            <input className={`${fieldClass} mt-1.5`} maxLength={40} onChange={(event) => setDraft({ ...draft, sku: event.target.value })} value={draft.sku} />
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-[#0F1419]">Location / store</span>
            <input className={`${fieldClass} mt-1.5`} maxLength={120} onChange={(event) => setDraft({ ...draft, location: event.target.value })} placeholder="Store room 1" value={draft.location} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[13px] font-semibold text-[#0F1419]">Notes</span>
            <textarea className={`${fieldClass} mt-1.5 min-h-[72px] py-2`} maxLength={500} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} value={draft.notes} />
          </label>
        </div>

        {item ? (
          <label className="flex items-center gap-2 rounded-[6px] bg-[#F7F8FB] px-3 py-2.5 text-[13px] font-semibold text-[#2A3340]">
            <input checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} type="checkbox" />
            Active (uncheck to archive without losing its history)
          </label>
        ) : (
          <div className="rounded-[6px] border border-dashed border-[#C9D3DE] p-3">
            <p className="text-[13px] font-semibold text-[#0F1419]">Opening stock (optional)</p>
            <p className="mt-0.5 text-[12px] text-[#5A6573]">Recorded as the item&apos;s first stock-in so it values straight away. Leave blank to start at zero.</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <input className={fieldClass} inputMode="numeric" onChange={(event) => setDraft({ ...draft, openingQuantity: event.target.value.replace(/\D/g, "") })} placeholder="Opening quantity" value={draft.openingQuantity} />
              <input className={fieldClass} inputMode="decimal" onChange={(event) => setDraft({ ...draft, openingUnitCost: event.target.value.replace(/[^\d.]/g, "") })} placeholder="Cost per unit (₹)" value={draft.openingUnitCost} />
            </div>
          </div>
        )}

        {formError ? <p className="rounded-[6px] bg-[#FCE3E5] px-3 py-2 text-[12px] font-semibold text-[#C8242C]">{formError}</p> : null}
      </div>
    </Modal>
  );
}

// =========================================================== Movement modal

function MovementModal({
  isOpen,
  item,
  vendors,
  onClose,
  onSaved
}: {
  isOpen: boolean;
  item: InventoryItem;
  vendors: InventoryVendor[];
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [type, setType] = useState<InventoryTxnType>("PURCHASE");
  const [quantity, setQuantity] = useState("");
  const [delta, setDelta] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issuedTo, setIssuedTo] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setType("PURCHASE");
    setQuantity("");
    setDelta("");
    setUnitCost("");
    setVendorId("");
    setInvoiceNumber("");
    setIssuedTo("");
    setReason("");
    setNote("");
    setOccurredAt("");
    setFormError("");
  }, [isOpen]);

  const signedDelta = type === "ADJUSTMENT" ? Number(delta || 0) : type === "ISSUE" ? -Number(quantity || 0) : Number(quantity || 0);
  const projectedBalance = item.quantity + (Number.isFinite(signedDelta) ? signedDelta : 0);

  function save() {
    const occurred = occurredAt ? new Date(`${occurredAt}T00:00:00`).toISOString() : undefined;

    if (type === "ADJUSTMENT") {
      const value = Number(delta);
      if (!Number.isInteger(value) || value === 0) return setFormError("Enter a non-zero whole number to add or remove.");
      if (!reason.trim()) return setFormError("Give a reason for the adjustment.");
      if (item.quantity + value < 0) return setFormError(`Only ${item.quantity} ${item.unit} in stock — cannot remove that many.`);
    } else {
      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty < 1) return setFormError("Enter a quantity of at least 1.");
      if (type === "ISSUE" && qty > item.quantity) return setFormError(`Only ${item.quantity} ${item.unit} in stock.`);
    }

    const payload = {
      type,
      ...(type === "ADJUSTMENT" ? { quantityDelta: Number(delta), reason: reason.trim() } : { quantity: Number(quantity) }),
      ...(type === "PURCHASE"
        ? {
            unitCost: unitCost ? Number(unitCost) : null,
            vendorId: vendorId || null,
            invoiceNumber: invoiceNumber.trim() || null
          }
        : {}),
      ...(type === "ISSUE" ? { issuedTo: issuedTo.trim() || null } : {}),
      note: note.trim() || null,
      occurredAt: occurred
    };

    setSaving(true);
    setFormError("");
    (async () => {
      try {
        await inventoryApi.recordTransaction(item.id, payload);
        await onSaved(`${txnLabel[type]} recorded for ${item.name}.`);
      } catch (err) {
        setFormError(errorText(err, "Unable to record the movement"));
      } finally {
        setSaving(false);
      }
    })();
  }

  const types: { key: InventoryTxnType; label: string }[] = [
    { key: "PURCHASE", label: "Stock in" },
    { key: "ISSUE", label: "Stock out" },
    { key: "ADJUSTMENT", label: "Adjust" }
  ];

  return (
    <Modal
      description={`In stock: ${item.quantity} ${item.unit}`}
      footer={
        <div className="flex w-full justify-end gap-2">
          <button className={secondaryButton} onClick={onClose} type="button">Cancel</button>
          <button className={primaryButton} disabled={saving} onClick={save} type="button">{saving ? "Saving..." : "Record movement"}</button>
        </div>
      }
      isOpen={isOpen}
      onClose={onClose}
      title={`Record movement · ${item.name}`}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-1 rounded-[6px] bg-[#F2F5FA] p-1">
          {types.map((entry) => (
            <button
              className={`min-h-9 rounded-[6px] text-[13px] font-semibold transition ${type === entry.key ? "bg-white text-[#2456E6] shadow-sm" : "text-[#5A6573] hover:text-[#2A3340]"}`}
              key={entry.key}
              onClick={() => { setType(entry.key); setFormError(""); }}
              type="button"
            >
              {entry.label}
            </button>
          ))}
        </div>

        {type === "ADJUSTMENT" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[13px] font-semibold text-[#0F1419]">Adjust by (+ add / − remove)<span className="ml-1 text-[#C8242C]">*</span></span>
              <input className={`${fieldClass} mt-1.5`} onChange={(event) => setDelta(event.target.value.replace(/[^\d-]/g, ""))} placeholder="-2 or 5" value={delta} />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-[#0F1419]">Reason<span className="ml-1 text-[#C8242C]">*</span></span>
              <input className={`${fieldClass} mt-1.5`} maxLength={200} onChange={(event) => setReason(event.target.value)} placeholder="Stock-take, damage, write-off" value={reason} />
            </label>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[13px] font-semibold text-[#0F1419]">Quantity<span className="ml-1 text-[#C8242C]">*</span></span>
              <input className={`${fieldClass} mt-1.5`} inputMode="numeric" onChange={(event) => setQuantity(event.target.value.replace(/\D/g, ""))} placeholder={`In ${item.unit}`} value={quantity} />
            </label>
            {type === "PURCHASE" ? (
              <label className="block">
                <span className="text-[13px] font-semibold text-[#0F1419]">Cost per unit (₹)</span>
                <input className={`${fieldClass} mt-1.5`} inputMode="decimal" onChange={(event) => setUnitCost(event.target.value.replace(/[^\d.]/g, ""))} placeholder="Optional" value={unitCost} />
              </label>
            ) : (
              <label className="block">
                <span className="text-[13px] font-semibold text-[#0F1419]">Issued to</span>
                <input className={`${fieldClass} mt-1.5`} maxLength={120} onChange={(event) => setIssuedTo(event.target.value)} placeholder="Dept / person" value={issuedTo} />
              </label>
            )}
          </div>
        )}

        {type === "PURCHASE" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[13px] font-semibold text-[#0F1419]">Vendor</span>
              <CustomSelect
                ariaLabel="Vendor"
                className="h-11 w-full text-[14px]"
                onChange={setVendorId}
                options={[{ label: "No vendor", value: "" }, ...vendors.map((vendor) => ({ label: vendor.name, value: vendor.id }))]}
                value={vendorId}
                wrapperClassName="mt-1.5 block w-full"
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-[#0F1419]">Bill / invoice no.</span>
              <input className={`${fieldClass} mt-1.5`} maxLength={60} onChange={(event) => setInvoiceNumber(event.target.value)} value={invoiceNumber} />
            </label>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[13px] font-semibold text-[#0F1419]">Date</span>
            <input className={`${fieldClass} mt-1.5`} onChange={(event) => setOccurredAt(event.target.value)} type="date" value={occurredAt} />
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-[#0F1419]">Note</span>
            <input className={`${fieldClass} mt-1.5`} maxLength={500} onChange={(event) => setNote(event.target.value)} value={note} />
          </label>
        </div>

        <div className={`rounded-[6px] px-3 py-2 text-[13px] font-semibold ${projectedBalance < 0 ? "bg-[#FCE3E5] text-[#C8242C]" : "bg-[#F2F5FA] text-[#2A3340]"}`}>
          New balance: {projectedBalance} {item.unit}
        </div>

        {formError ? <p className="rounded-[6px] bg-[#FCE3E5] px-3 py-2 text-[12px] font-semibold text-[#C8242C]">{formError}</p> : null}
      </div>
    </Modal>
  );
}

// =========================================================== Vendor modal

function VendorModal({
  isOpen,
  vendor,
  onClose,
  onError,
  onSaved
}: {
  isOpen: boolean;
  vendor: InventoryVendor | null;
  onClose: () => void;
  onError: (message: string) => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState({ name: "", phone: "", email: "", gstin: "", address: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setFormError("");
    setDraft({
      name: vendor?.name ?? "",
      phone: vendor?.phone ?? "",
      email: vendor?.email ?? "",
      gstin: vendor?.gstin ?? "",
      address: vendor?.address ?? "",
      notes: vendor?.notes ?? ""
    });
  }, [isOpen, vendor]);

  function save() {
    if (draft.name.trim().length < 2) return setFormError("Give the vendor a name.");
    if (draft.phone && !/^\d{10}$/.test(draft.phone.trim())) return setFormError("Use a 10-digit phone number, or leave it blank.");

    const payload = {
      name: draft.name.trim(),
      phone: draft.phone.trim() || null,
      email: draft.email.trim() || null,
      gstin: draft.gstin.trim() || null,
      address: draft.address.trim() || null,
      notes: draft.notes.trim() || null
    };
    setSaving(true);
    setFormError("");
    (async () => {
      try {
        if (vendor) await inventoryApi.updateVendor(vendor.id, payload);
        else await inventoryApi.createVendor(payload);
        await onSaved(vendor ? "Vendor saved." : "Vendor added.");
      } catch (err) {
        setFormError(errorText(err, "Unable to save the vendor"));
      } finally {
        setSaving(false);
      }
    })();
  }

  function remove() {
    if (!vendor) return;
    if (!window.confirm(`Delete ${vendor.name}? Past purchases keep their records but lose the vendor link.`)) return;
    setSaving(true);
    (async () => {
      try {
        await inventoryApi.removeVendor(vendor.id);
        await onSaved("Vendor deleted.");
      } catch (err) {
        onError(errorText(err, "Unable to delete the vendor"));
      } finally {
        setSaving(false);
      }
    })();
  }

  return (
    <Modal
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          {vendor ? (
            <button className="min-h-10 rounded-[6px] px-4 text-[13px] font-semibold text-[#C8242C] hover:bg-[#FCE3E5] disabled:opacity-50" disabled={saving} onClick={remove} type="button">Delete vendor</button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button className={`${secondaryButton} flex-1 sm:flex-none`} onClick={onClose} type="button">Cancel</button>
            <button className={`${primaryButton} flex-1 sm:flex-none`} disabled={saving} onClick={save} type="button">{saving ? "Saving..." : "Save vendor"}</button>
          </div>
        </div>
      }
      isOpen={isOpen}
      onClose={onClose}
      title={vendor ? "Edit Vendor" : "Add Vendor"}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="text-[13px] font-semibold text-[#0F1419]">Vendor name<span className="ml-1 text-[#C8242C]">*</span></span>
            <input className={`${fieldClass} mt-1.5`} maxLength={120} onChange={(event) => setDraft({ ...draft, name: event.target.value })} value={draft.name} />
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-[#0F1419]">Phone</span>
            <input className={`${fieldClass} mt-1.5`} inputMode="numeric" maxLength={10} onChange={(event) => setDraft({ ...draft, phone: event.target.value.replace(/\D/g, "") })} placeholder="10 digits" value={draft.phone} />
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-[#0F1419]">Email</span>
            <input className={`${fieldClass} mt-1.5`} maxLength={120} onChange={(event) => setDraft({ ...draft, email: event.target.value })} value={draft.email} />
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-[#0F1419]">GSTIN</span>
            <input className={`${fieldClass} mt-1.5`} maxLength={20} onChange={(event) => setDraft({ ...draft, gstin: event.target.value.toUpperCase() })} value={draft.gstin} />
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-[#0F1419]">Address</span>
            <input className={`${fieldClass} mt-1.5`} maxLength={300} onChange={(event) => setDraft({ ...draft, address: event.target.value })} value={draft.address} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[13px] font-semibold text-[#0F1419]">Notes</span>
            <textarea className={`${fieldClass} mt-1.5 min-h-[64px] py-2`} maxLength={500} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} value={draft.notes} />
          </label>
        </div>
        {formError ? <p className="rounded-[6px] bg-[#FCE3E5] px-3 py-2 text-[12px] font-semibold text-[#C8242C]">{formError}</p> : null}
      </div>
    </Modal>
  );
}

// =========================================================== Categories modal

function CategoriesModal({
  categories,
  isOpen,
  onChanged,
  onClose
}: {
  categories: InventoryCategory[];
  isOpen: boolean;
  onChanged: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setNewName("");
    setEditingId(null);
    setEditingName("");
    setFormError("");
  }, [isOpen]);

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setFormError("");
    try {
      await action();
      await onChanged();
    } catch (err) {
      setFormError(errorText(err, fallback));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Categories">
      <div className="space-y-4">
        <div className="flex gap-2">
          <input className={fieldClass} maxLength={60} onChange={(event) => setNewName(event.target.value)} placeholder="New category name" value={newName} />
          <button
            className={primaryButton}
            disabled={busy || newName.trim().length < 2}
            onClick={() => run(async () => { await inventoryApi.createCategory({ name: newName.trim() }); setNewName(""); }, "Unable to add the category")}
            type="button"
          >
            Add
          </button>
        </div>

        <div className="divide-y divide-[#EEF1F5] rounded-[6px] border border-[#DCE1E8]">
          {categories.length === 0 ? (
            <p className="px-3 py-6 text-center text-[13px] text-[#86868b]">No categories yet.</p>
          ) : (
            categories.map((category) => (
              <div className="flex items-center gap-2 px-3 py-2" key={category.id}>
                {editingId === category.id ? (
                  <>
                    <input className={fieldClass} maxLength={60} onChange={(event) => setEditingName(event.target.value)} value={editingName} />
                    <button
                      className={smallButton}
                      disabled={busy || editingName.trim().length < 2}
                      onClick={() => run(async () => { await inventoryApi.updateCategory(category.id, { name: editingName.trim() }); setEditingId(null); }, "Unable to rename")}
                      type="button"
                    >
                      Save
                    </button>
                    <button className={smallButton} onClick={() => setEditingId(null)} type="button">Cancel</button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-[#0F1419]">{category.name}</p>
                      <p className="text-[12px] text-[#5A6573]">{category.itemCount} {category.itemCount === 1 ? "item" : "items"}</p>
                    </div>
                    <button className={smallButton} onClick={() => { setEditingId(category.id); setEditingName(category.name); }} type="button">Rename</button>
                    <button
                      className={smallButton}
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Delete category "${category.name}"? Its items stay but become uncategorised.`)) return;
                        run(async () => { await inventoryApi.removeCategory(category.id); }, "Unable to delete");
                      }}
                      type="button"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {formError ? <p className="rounded-[6px] bg-[#FCE3E5] px-3 py-2 text-[12px] font-semibold text-[#C8242C]">{formError}</p> : null}
      </div>
    </Modal>
  );
}

// =========================================================== Ledger modal

function LedgerModal({ isOpen, itemId, onClose }: { isOpen: boolean; itemId: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<InventoryItemDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !itemId) return;
    setLoading(true);
    setError("");
    setDetail(null);
    inventoryApi
      .item(itemId)
      .then(setDetail)
      .catch((err) => setError(errorText(err, "Unable to load the item")))
      .finally(() => setLoading(false));
  }, [isOpen, itemId]);

  const meta = useMemo(() => {
    if (!detail) return "";
    return [detail.category?.name, `${detail.quantity} ${detail.unit} in stock`, detail.stockValue !== null ? `${formatINR(detail.stockValue)} value` : null]
      .filter(Boolean)
      .join(" · ");
  }, [detail]);

  return (
    <Modal description={meta || undefined} isOpen={isOpen} onClose={onClose} size="lg" title={detail ? detail.name : "Item ledger"}>
      {loading ? (
        <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-40" /></div>
      ) : error ? (
        <p className="rounded-[6px] bg-[#FCE3E5] px-3 py-2 text-[13px] font-semibold text-[#C8242C]">{error}</p>
      ) : detail ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "In stock", value: `${detail.quantity} ${detail.unit}` },
              { label: "Reorder at", value: detail.reorderLevel ? `${detail.reorderLevel} ${detail.unit}` : "—" },
              { label: "Last cost", value: money(detail.lastUnitCost) },
              { label: "Value", value: money(detail.stockValue) }
            ].map((card) => (
              <div className="rounded-[6px] bg-[#F7F8FB] px-3 py-2" key={card.label}>
                <p className="text-[11px] font-medium text-[#6F7480]">{card.label}</p>
                <p className="mt-0.5 text-[14px] font-bold text-[#111827]">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-[6px] border border-[#DCE1E8]">
            {detail.transactions.length === 0 ? (
              <p className="px-3 py-8 text-center text-[13px] text-[#86868b]">No movements yet.</p>
            ) : (
              <div className="max-h-[360px] overflow-y-auto divide-y divide-[#EEF1F5]">
                {detail.transactions.map((txn) => (
                  <div className="flex items-start justify-between gap-3 px-3 py-2.5" key={txn.id}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusPill label={txnLabel[txn.type]} tone={txnTone[txn.type]} />
                        <span className="text-[12px] text-[#5A6573]">{formatDateTimeShort(txn.occurredAt)}</span>
                      </div>
                      <p className="mt-1 text-[12px] text-[#5A6573]">
                        {[
                          txn.vendor?.name,
                          txn.invoiceNumber ? `Bill ${txn.invoiceNumber}` : null,
                          txn.issuedTo ? `To ${txn.issuedTo}` : null,
                          txn.reason,
                          txn.note,
                          txn.recordedBy ? `by ${txn.recordedBy.fullName}` : null
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-[14px] font-semibold [font-variant-numeric:tabular-nums] ${txn.quantityDelta >= 0 ? "text-[#0F8A4A]" : "text-[#C8242C]"}`}>
                        {txn.quantityDelta >= 0 ? "+" : ""}{txn.quantityDelta} {detail.unit}
                      </p>
                      <p className="text-[12px] text-[#5A6573] [font-variant-numeric:tabular-nums]">bal {txn.balanceAfter}{txn.totalCost !== null ? ` · ${formatINR(txn.totalCost)}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
