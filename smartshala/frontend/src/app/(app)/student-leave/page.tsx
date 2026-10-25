"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { TextArea } from "@/components/ui/FormControls";
import {
  studentLeaveApi,
  type LeaveStatus,
  type StudentLeavePage,
  type StudentLeaveRequest
} from "@/lib/api";

const pageSize = 20;

const tabs: Array<{ label: string; status: LeaveStatus }> = [
  { label: "Pending", status: "PENDING" },
  { label: "Approved", status: "APPROVED" },
  { label: "Rejected", status: "REJECTED" }
];

const emptySummary: Record<LeaveStatus, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 };

type Decision = { request: StudentLeaveRequest; approve: boolean };

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function range(from: string, to: string) {
  const start = dateFmt.format(new Date(from));
  return from === to ? start : `${start} – ${dateFmt.format(new Date(to))}`;
}

/** The office review of parent-raised child-leave requests from the Parent app. */
export default function StudentLeavePage() {
  const [status, setStatus] = useState<LeaveStatus>("PENDING");
  const [page, setPage] = useState<StudentLeavePage | null>(null);
  const [summary, setSummary] = useState<Record<LeaveStatus, number>>(emptySummary);
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
      const result = await studentLeaveApi.requests({ status, limit: pageSize });
      setPage(result);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load leave requests");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadMore() {
    if (!page?.hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await studentLeaveApi.requests({ status, limit: pageSize, offset: page.items.length });
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
      await studentLeaveApi.decide(decision.request.id, {
        status: decision.approve ? "APPROVED" : "REJECTED",
        note: note.trim() || undefined
      });
      setNotice(`${decision.request.student.fullName}'s leave ${decision.approve ? "approved" : "rejected"}.`);
      setDecision(null);
      setNote("");
      // Reload: the decided row leaves this tab and every tile count moves.
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to record the decision");
      setDecision(null);
    } finally {
      setDeciding(false);
    }
  }

  const tiles = [
    { label: "Pending", value: summary.PENDING, bg: "bg-[#FFF2DC]" },
    { label: "Approved", value: summary.APPROVED, bg: "bg-[#E1F5EA]" },
    { label: "Rejected", value: summary.REJECTED, bg: "bg-[#FCE3E5]" },
    { label: "Cancelled", value: summary.CANCELLED, bg: "bg-[#EEF1F5]" }
  ];
  const items = page?.items ?? [];

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader breadcrumbs={[{ label: "Student Leave" }]} title="Student Leave" />

      <p className="-mt-2 text-[13px] text-[#5A6573]">
        Leave requests parents have raised for their children, oldest pending first. Approving or rejecting one notifies the parent in the app.
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
              {!loading && summary[tab.status] > 0 ? (
                <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-white/20" : "bg-[#EEF1F5] text-[#5A6573]"}`}>{summary[tab.status]}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-40" key={index} />)}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-[8px] border border-[#DCE1E8] bg-white px-4 py-12 text-center text-[13px] font-medium text-[#86868b]">
          No {status.toLowerCase()} requests.
        </p>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((request) => (
              <div
                className="flex flex-col gap-3 rounded-[8px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)]"
                key={request.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-bold text-[#0F1419]">{request.student.fullName}</p>
                    <p className="truncate text-[12px] text-[#6F7480]">
                      {request.student.className ?? "—"} · Adm. {request.student.admissionNumber}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#EEF1F5] px-2.5 py-1 text-[11px] font-semibold text-[#5A6573]">
                    {request.days} {request.days === 1 ? "day" : "days"}
                  </span>
                </div>

                <div className="text-[13px] text-[#2A3340]">
                  <p className="font-semibold">{range(request.fromDate, request.toDate)}</p>
                  <p className="mt-1 whitespace-pre-wrap text-[#5A6573]">{request.reason}</p>
                </div>

                <p className="text-[12px] text-[#86868b]">
                  Raised by {request.requestedByName ?? "parent"} on {dateFmt.format(new Date(request.appliedOn))}
                </p>

                {request.status === "PENDING" ? (
                  <div className="flex gap-2">
                    <button
                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-[6px] bg-[#0F8A4A] px-4 text-[13px] font-semibold text-white hover:bg-[#0C7340]"
                      onClick={() => {
                        setNote("");
                        setDecision({ request, approve: true });
                      }}
                      type="button"
                    >
                      Approve
                    </button>
                    <button
                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-[6px] border border-[#C8242C] px-4 text-[13px] font-semibold text-[#C8242C] hover:bg-[#FCE3E5]"
                      onClick={() => {
                        setNote("");
                        setDecision({ request, approve: false });
                      }}
                      type="button"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <p className="text-[12px] font-semibold text-[#5A6573]">
                    {request.status === "APPROVED" ? "Approved" : request.status === "REJECTED" ? "Rejected" : "Cancelled"}
                    {request.decidedBy ? ` by ${request.decidedBy.fullName}` : ""}
                    {request.decisionNote ? ` — ${request.decisionNote}` : ""}
                  </p>
                )}
              </div>
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
            ? `${decision.request.student.fullName} · ${decision.request.days} ${decision.request.days === 1 ? "day" : "days"}`
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
            placeholder="Anything the parent should know"
            value={note}
          />
        </label>
      </Modal>
    </div>
  );
}
