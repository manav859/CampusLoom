"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { feesApi, studentsApi, type FeeDefaulter, whatsappApi } from "@/lib/api";
import { formatINR } from "@/lib/formatters";
import { cachedFetch } from "@/lib/prefetchCache";

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

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Fees" title="Defaulter follow-up queue" action={<Link className="btn-secondary" href="/fees">← Back to fees</Link>} />

      {notice ? <div className="rounded-xl bg-[#34c759]/10 px-4 py-3 text-[13px] font-medium text-[#248a3d]">{notice}</div> : null}
      {error ? <div className="rounded-xl bg-[#ff3b30]/10 px-4 py-3 text-[13px] font-medium text-[#d70015]">{error}</div> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#86868b]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" /></svg>
          <input
            className="glass-input pl-10 sm:w-72"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search student or class..."
            value={search}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="glass-input sm:w-36 text-[13px]" onChange={(event) => setClassFilter(event.target.value)} value={classFilter}>
            <option value="">All classes</option>
            {classOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="glass-input sm:w-40 text-[13px]" onChange={(event) => setStatusFilter(event.target.value)} value={statusFilter}>
            <option value="">All fee statuses</option>
            <option value="PENDING">Pending fees</option>
            <option value="PARTIAL">Partial fees</option>
            <option value="OVERDUE">Overdue fees</option>
          </select>
          <select className="glass-input sm:w-40 text-[13px]" onChange={(event) => setOverdueFilter(event.target.value)} value={overdueFilter}>
            <option value="">All due ages</option>
            <option value="current">Not overdue</option>
            <option value="1-7">1-7 days</option>
            <option value="8-30">8-30 days</option>
            <option value="30+">30+ days</option>
          </select>
          <select className="glass-input sm:w-44 text-[13px]" onChange={(event) => setSortKey(event.target.value)} value={sortKey}>
            <option value="overdue-desc">Longest overdue</option>
            <option value="overdue-asc">Newest due</option>
            <option value="balance-desc">Highest balance</option>
            <option value="balance-asc">Lowest balance</option>
            <option value="name-asc">Name A-Z</option>
          </select>
          {(search || classFilter || statusFilter || overdueFilter || sortKey !== "overdue-desc") ? (
            <button className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 py-2 text-[13px] font-medium text-[#1d1d1f] transition-all hover:bg-[#f5f5f7]" onClick={() => {
              setSearch("");
              setClassFilter("");
              setStatusFilter("");
              setOverdueFilter("");
              setSortKey("overdue-desc");
            }} type="button">
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {!loading ? (
        <p className="text-[13px] font-medium text-[#5A6573]">
          Showing {filteredRows.length} of {rows.length} pending active fee accounts.
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] shadow-apple">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="table-head">
              <tr>{["Student", "Class", "Balance", "Days overdue", "Status", "Action"].map((head) => <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>)}</tr>
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
                      {row.feeStructure ? <p className="mt-0.5 text-[11px] text-[#86868b]">{row.feeStructure}</p> : null}
                    </td>
                    <td className="px-5 py-4 text-[#6e6e73]">{row.class}</td>
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{formatINR(row.balance)}</td>
                    <td className="px-5 py-4">
                      <StatusPill label={`${row.daysOverdue} days`} tone={row.daysOverdue > 0 ? "danger" : "warn"} />
                    </td>
                    <td className="px-5 py-4"><StatusPill label={row.status} tone={row.status === "PARTIAL" ? "warn" : "danger"} /></td>
                    <td className="px-5 py-4">
                      <button
                        className="btn-primary min-h-[36px] px-4 text-[12px] disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        disabled={sendingId === row.studentId}
                        onClick={() => sendReminder(row)}
                      >
                        {sendingId === row.studentId ? "Sending…" : "Send WhatsApp"}
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
