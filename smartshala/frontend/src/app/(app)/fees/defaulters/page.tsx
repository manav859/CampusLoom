"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { feesApi, studentsApi, type FeeDefaulter, whatsappApi } from "@/lib/api";
import { formatINR } from "@/lib/formatters";
import { cachedFetch } from "@/lib/prefetchCache";

const fieldClass = "min-h-11 w-full rounded-[8px] border border-[#C2C9D4] bg-white px-3 text-[13px] font-medium text-[#1d1d1f] shadow-[0_1px_2px_rgba(15,20,25,0.03)] focus:border-[#2456E6]";
const selectClass = `${fieldClass} pr-9`;

export default function DefaultersPage() {
  const [rows, setRows] = useState<FeeDefaulter[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [overdueFilter, setOverdueFilter] = useState("");
  const [sortKey, setSortKey] = useState("overdue-desc");

  useEffect(() => {
    let active = true;
    cachedFetch("fees:defaulters", () => feesApi.defaulters())
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load defaulters");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function sendReminder(row: FeeDefaulter) {
    setSendingId(row.studentId);
    setError("");
    setNotice("");
    try {
      const student = await studentsApi.get(row.studentId);
      await whatsappApi.send({
        phone: student.parentPhone,
        message: `Dear Parent, fee balance of ${formatINR(row.balance, { compact: false })} for ${row.name} is pending. Please clear it at the earliest.`
      });
      setNotice(`WhatsApp reminder sent to ${row.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send reminder");
    } finally {
      setSendingId("");
    }
  }

  const classOptions = useMemo(() => {
    return [...new Set(rows.map((row) => row.class).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const matchesSearch =
        query.length === 0 ||
        row.name.toLowerCase().includes(query) ||
        row.class.toLowerCase().includes(query);
      const matchesClass = !classFilter || row.class === classFilter;
      const matchesStatus = !statusFilter || row.status === statusFilter;
      const matchesOverdue =
        !overdueFilter ||
        (overdueFilter === "current" && row.daysOverdue === 0) ||
        (overdueFilter === "1-7" && row.daysOverdue >= 1 && row.daysOverdue <= 7) ||
        (overdueFilter === "8-30" && row.daysOverdue >= 8 && row.daysOverdue <= 30) ||
        (overdueFilter === "30+" && row.daysOverdue > 30);

      return matchesSearch && matchesClass && matchesStatus && matchesOverdue;
    });

    return [...filtered].sort((left, right) => {
      if (sortKey === "name-asc") return left.name.localeCompare(right.name);
      if (sortKey === "balance-desc") return right.balance - left.balance;
      if (sortKey === "balance-asc") return left.balance - right.balance;
      if (sortKey === "overdue-asc") return left.daysOverdue - right.daysOverdue;
      return right.daysOverdue - left.daysOverdue || right.balance - left.balance;
    });
  }, [classFilter, overdueFilter, rows, search, sortKey, statusFilter]);

  const hasFilters = search || classFilter || statusFilter || overdueFilter || sortKey !== "overdue-desc";

  function clearFilters() {
    setSearch("");
    setClassFilter("");
    setStatusFilter("");
    setOverdueFilter("");
    setSortKey("overdue-desc");
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader hideBreadcrumbs title="Defaulter Follow-up Queue" action={<Link className="btn-secondary" href="/fees">Back to Fees</Link>} />

      {notice ? <div className="rounded-[8px] bg-[#E1F5EA] px-4 py-3 text-[13px] font-semibold text-[#0F8A4A]">{notice}</div> : null}
      {error ? <div className="rounded-[8px] bg-[#FCE3E5] px-4 py-3 text-[13px] font-medium text-[#C8242C]">{error}</div> : null}

      <div className="rounded-[8px] border border-[#DCE1E8] bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.1fr)_repeat(4,minmax(150px,1fr))_auto] lg:items-center">
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86868b]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" /></svg>
            <input
              className={`${fieldClass} pl-10`}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search student or class..."
              value={search}
            />
          </div>
          <select className={selectClass} onChange={(event) => setClassFilter(event.target.value)} value={classFilter}>
            <option value="">All Classes</option>
            {classOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className={selectClass} onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value="">All Fee Statuses</option>
            <option value="PENDING">Pending Fees</option>
            <option value="PARTIAL">Partial Fees</option>
            <option value="OVERDUE">Overdue Fees</option>
          </select>
          <select className={selectClass} onChange={(event) => setOverdueFilter(event.target.value)} value={overdueFilter}>
            <option value="">All Due Ages</option>
            <option value="current">Not Overdue</option>
            <option value="1-7">1-7 days</option>
            <option value="8-30">8-30 days</option>
            <option value="30+">30+ days</option>
          </select>
          <select className={selectClass} onChange={(event) => setSortKey(event.target.value)} value={sortKey}>
            <option value="overdue-desc">Longest Overdue</option>
            <option value="overdue-asc">Newest Due</option>
            <option value="balance-desc">Highest Balance</option>
            <option value="balance-asc">Lowest Balance</option>
            <option value="name-asc">Name A-Z</option>
          </select>
          {hasFilters ? (
            <button className="min-h-11 rounded-[8px] border border-[#C2C9D4] bg-white px-3 text-[13px] font-semibold text-[#2A3340] transition-colors hover:bg-[#F7F8FB]" onClick={clearFilters} type="button">
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {!loading ? (
        <p className="text-[13px] font-medium text-[#5A6573]">
          Showing {filteredRows.length} of {rows.length} pending active fee accounts.
        </p>
      ) : null}

      <div className="space-y-3 sm:hidden">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div className="h-[148px] animate-pulse rounded-[8px] border border-[#DCE1E8] bg-white" key={i} />
          ))
        ) : filteredRows.length === 0 ? (
          <div className="rounded-[8px] border border-[#DCE1E8] bg-white px-4 py-10 text-center text-[13px] text-[#86868b]">No defaulters match the selected filters.</div>
        ) : (
          filteredRows.map((row) => (
            <div className="rounded-[8px] border border-[#DCE1E8] bg-white p-4 shadow-[var(--shadow-card)]" key={`${row.studentId}-${row.feeStructureId ?? row.balance}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link className="block truncate text-[14px] font-semibold text-[#1d1d1f] hover:text-[#2456E6]" href={`/fees/${row.studentId}`}>{row.name}</Link>
                  <p className="mt-0.5 truncate whitespace-nowrap text-[12px] text-[#86868b]">{row.feeStructure ?? row.class}</p>
                </div>
                <StatusPill label={row.status} tone={row.status === "PARTIAL" ? "warn" : "danger"} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[6px] bg-[#F7F8FB] px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#86868b]">Class</p>
                  <p className="mt-1 truncate text-[14px] font-semibold text-[#0F1419]">{row.class}</p>
                </div>
                <div className="rounded-[6px] bg-[#FCE3E5] px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#C8242C]">Balance</p>
                  <p className="mt-1 truncate whitespace-nowrap text-[14px] font-semibold text-[#0F1419]">{formatINR(row.balance)}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <StatusPill label={`${row.daysOverdue} days`} tone={row.daysOverdue > 0 ? "danger" : "warn"} />
                <button
                  className="min-h-10 rounded-[6px] bg-[#2456E6] px-4 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={sendingId === row.studentId}
                  onClick={() => sendReminder(row)}
                  type="button"
                >
                  {sendingId === row.studentId ? "Sending..." : "Send WhatsApp"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white shadow-[var(--shadow-card)] sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] table-fixed text-left text-[13px]">
            <colgroup>
              {Array.from({ length: 6 }).map((_, index) => <col className="w-1/6" key={index} />)}
            </colgroup>
            <thead className="bg-[var(--brand-secondary)] text-white">
              <tr>{["Student", "Class", "Balance", "Days Overdue", "Status", "Action"].map((head) => <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} cols={6} />)
              ) : filteredRows.length === 0 ? (
                <tr><td className="px-5 py-12 text-center text-[#86868b]" colSpan={6}>No defaulters match the selected filters.</td></tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={`${row.studentId}-${row.feeStructureId ?? row.balance}`} className="table-row">
                    <td className="px-5 py-4">
                      <Link className="font-semibold text-[#1d1d1f] transition-colors duration-200 hover:text-[#0071e3]" href={`/fees/${row.studentId}`}>{row.name}</Link>
                      {row.feeStructure ? <p className="mt-0.5 truncate whitespace-nowrap text-[11px] text-[#86868b]" title={row.feeStructure}>{row.feeStructure}</p> : null}
                    </td>
                    <td className="px-5 py-4 text-[#6e6e73]">{row.class}</td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-[#1d1d1f]">{formatINR(row.balance)}</td>
                    <td className="px-5 py-4">
                      <StatusPill label={`${row.daysOverdue} days`} tone={row.daysOverdue > 0 ? "danger" : "warn"} />
                    </td>
                    <td className="px-5 py-4"><StatusPill label={row.status} tone={row.status === "PARTIAL" ? "warn" : "danger"} /></td>
                    <td className="px-5 py-4">
                      <button
                        className="btn-primary min-h-[36px] px-4 text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={sendingId === row.studentId}
                        onClick={() => sendReminder(row)}
                        type="button"
                      >
                        {sendingId === row.studentId ? "Sending..." : "Send WhatsApp"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
