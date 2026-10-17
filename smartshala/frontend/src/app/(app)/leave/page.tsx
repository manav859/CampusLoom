"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { TextArea } from "@/components/ui/FormControls";
import { LeaveRequestCard } from "@/features/leave/LeaveRequestCard";
import { leaveApi, type LeaveRequest, type LeavePage, type LeaveStatus, type LeaveSummary } from "@/lib/api";

const pageSize = 20;

const tabs: Array<{ label: string; status: LeaveStatus }> = [
  { label: "Pending", status: "PENDING" },
  { label: "Approved", status: "APPROVED" },
  { label: "Rejected", status: "REJECTED" }
];

const emptySummary: LeaveSummary = { total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 };

type Decision = { request: LeaveRequest; approve: boolean };

/** Leave Approval — the mirror of the principal app's queue. */
export default function LeaveApprovalPage() {
  const [status, setStatus] = useState<LeaveStatus>("PENDING");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState<LeavePage | null>(null);
  const [summary, setSummary] = useState<LeaveSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await leaveApi.schoolRequests({ status, search, limit: pageSize });
      setPage(result);
      // The tiles describe the whole school and ride along with every response,
      // so they cannot drift out of step with the list.
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load leave requests");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    if (!page?.hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await leaveApi.schoolRequests({ status, search, limit: pageSize, offset: page.items.length });
      setPage({ ...next, items: [...page.items, ...next.items] });
      setSummary(next.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load more requests");
    } finally {
      setLoadingMore(false);
    }
  }

  async function confirmDecision() {
    if (!decision) return;
    setDeciding(true);
    setError("");
    try {
      await leaveApi.decide(decision.request.id, {
        status: decision.approve ? "APPROVED" : "REJECTED",
        note: note.trim() || undefined
      });
      setNotice(`${decision.request.applicant.fullName}'s leave ${decision.approve ? "approved" : "rejected"}.`);
      setDecision(null);
      setNote("");
      // Reload rather than patch in place: the decided row leaves this tab and
      // every tile count moves, so a fresh page is the honest answer.
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record the decision");
      setDecision(null);
    } finally {
      setDeciding(false);
    }
  }

  const tiles = [
    { label: "Total", value: summary.total, bg: "bg-[#E2EAFD]" },
    { label: "Pending", value: summary.pending, bg: "bg-[#FFF2DC]" },
    { label: "Approved", value: summary.approved, bg: "bg-[#E1F5EA]" },
    { label: "Rejected", value: summary.rejected, bg: "bg-[#FCE3E5]" }
  ];
  const counts: Record<LeaveStatus, number> = {
    PENDING: summary.pending,
    APPROVED: summary.approved,
    REJECTED: summary.rejected,
    CANCELLED: summary.cancelled
  };
  const items = page?.items ?? [];

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader breadcrumbs={[{ label: "Leave Approval" }]} title="Leave Approval" />

      <p className="-mt-2 text-[13px] text-[#5A6573]">
        Every leave request your staff has applied for, oldest pending first. Approving or rejecting one notifies the applicant.
      </p>

      {error ? <div className="rounded-[8px] bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C]">{error}</div> : null}
      {notice ? (
        <div className="flex items-center justify-between gap-3 rounded-[8px] bg-[#E1F5EA] px-4 py-3 text-[13px] font-semibold text-[#0F8A4A]">
          <span>{notice}</span>
          <button className="underline-offset-2 hover:underline" onClick={() => setNotice("")} type="button">
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {tiles.map((tile) => (
          <div className={`rounded-[8px] px-4 py-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:px-5 ${tile.bg}`} key={tile.label}>
            <p className="truncate text-[13px] font-medium text-[#6F7480] sm:text-[14px]">{tile.label}</p>
            <p className="mt-1.5 truncate text-[22px] font-bold text-[#111827] [font-variant-numeric:tabular-nums] sm:text-[26px]">
              {loading ? "—" : tile.value}
            </p>
          </div>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchInput.trim());
        }}
      >
        <input
          aria-label="Search by staff name"
          className="min-h-10 min-w-0 flex-1 rounded-[6px] border border-[#C2C9D4] bg-white px-3 text-[13px] text-[#0F1419] outline-none transition focus:border-[#2456E6] sm:max-w-[320px]"
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by staff name…"
          type="search"
          value={searchInput}
        />
        <button className="inline-flex min-h-10 items-center justify-center rounded-[6px] border border-[#C2C9D4] bg-white px-4 text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]" type="submit">
          Search
        </button>
      </form>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
        {tabs.map((tab) => {
          const active = status === tab.status;
          return (
            <button
              aria-selected={active}
              className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full px-4 text-[13px] font-semibold transition ${active ? "bg-[#2456E6] text-white" : "border border-[#DCE1E8] bg-white text-[#2A3340] hover:bg-[#F7F8FB]"}`}
              key={tab.status}
              onClick={() => setStatus(tab.status)}
              role="tab"
              type="button"
            >
              {tab.label}
              {!loading && counts[tab.status] > 0 ? (
                <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-white/20" : "bg-[#EEF1F5] text-[#5A6573]"}`}>{counts[tab.status]}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-44" key={index} />)}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-[8px] border border-[#DCE1E8] bg-white px-4 py-12 text-center text-[13px] font-medium text-[#86868b]">
          {search ? `No request matches "${search}".` : `No ${status.toLowerCase()} requests.`}
        </p>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((request) => (
              <LeaveRequestCard
                busy={deciding && decision?.request.id === request.id}
                key={request.id}
                onApprove={() => {
                  setNote("");
                  setDecision({ request, approve: true });
                }}
                onReject={() => {
                  setNote("");
                  setDecision({ request, approve: false });
                }}
                request={request}
                showApplicant
              />
            ))}
          </div>
          {page?.hasMore ? (
            <button
              className="inline-flex min-h-11 w-full items-center justify-center rounded-[6px] border border-[#2456E6] px-4 text-[13px] font-semibold text-[#2456E6] transition hover:bg-[#E2EAFD] disabled:opacity-50"
              disabled={loadingMore}
              onClick={loadMore}
              type="button"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          ) : null}
        </>
      )}

      <Modal
        description={
          decision
            ? `${decision.request.applicant.fullName} · ${decision.request.days} ${decision.request.days === 1 ? "day" : "days"}`
            : undefined
        }
        footer={
          <>
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-[6px] border border-[#C2C9D4] bg-white px-4 text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]"
              onClick={() => setDecision(null)}
              type="button"
            >
              Cancel
            </button>
            <button
              className={`inline-flex min-h-10 items-center justify-center rounded-[6px] px-4 text-[13px] font-semibold text-white disabled:opacity-50 ${decision?.approve ? "bg-[#0F8A4A] hover:bg-[#0C7340]" : "bg-[#C8242C] hover:bg-[#A51D24]"}`}
              disabled={deciding}
              onClick={confirmDecision}
              type="button"
            >
              {deciding ? "Saving…" : decision?.approve ? "Approve" : "Reject"}
            </button>
          </>
        }
        isOpen={decision !== null}
        onClose={() => setDecision(null)}
        title={decision?.approve ? "Approve leave?" : "Reject leave?"}
      >
        <label className="block">
          <span className="text-[13px] font-semibold text-[#0F1419]">Note (optional)</span>
          <TextArea
            className="mt-2"
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Anything the applicant should know"
            value={note}
          />
        </label>
      </Modal>
    </div>
  );
}
