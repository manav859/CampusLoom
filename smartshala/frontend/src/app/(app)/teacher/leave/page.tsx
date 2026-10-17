"use client";

import { useCallback, useEffect, useState } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { TextArea } from "@/components/ui/FormControls";
import { LeaveRequestCard, leaveTypeLabel } from "@/features/leave/LeaveRequestCard";
import { leaveApi, leaveTypes, type LeavePage, type LeaveStatus, type LeaveSummary, type LeaveType } from "@/lib/api";

const pageSize = 20;
const maxAttachmentBytes = 5 * 1024 * 1024;
const allowedAttachmentTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const tabs: Array<{ label: string; status: LeaveStatus | null }> = [
  { label: "All", status: null },
  { label: "Pending", status: "PENDING" },
  { label: "Approved", status: "APPROVED" },
  { label: "Rejected", status: "REJECTED" }
];

const emptySummary: LeaveSummary = { total: 0, pending: 0, approved: 0, rejected: 0, cancelled: 0 };

/** The device's calendar day, which is how the server reads a leave date too. */
function dayValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shiftDay(delta: number) {
  const date = new Date();
  date.setDate(date.getDate() + delta);
  return dayValue(date);
}

/** Inclusive, so a single-day leave is 1 day — the same count the server stores. */
function dayCount(from: string, to: string) {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / millisecondsPerDay) + 1;
}

function readableSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/** My Leave — apply, track and withdraw, as the teacher app's Messages tab does. */
export default function MyLeavePage() {
  const [status, setStatus] = useState<LeaveStatus | null>(null);
  const [page, setPage] = useState<LeavePage | null>(null);
  const [summary, setSummary] = useState<LeaveSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [applyOpen, setApplyOpen] = useState(false);
  const [type, setType] = useState<LeaveType>("CASUAL");
  const [fromDate, setFromDate] = useState(() => dayValue(new Date()));
  const [toDate, setToDate] = useState(() => dayValue(new Date()));
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await leaveApi.myRequests({ status: status ?? undefined, limit: pageSize });
      setPage(result);
      setSummary(result.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load your leave requests");
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
      const next = await leaveApi.myRequests({ status: status ?? undefined, limit: pageSize, offset: page.items.length });
      setPage({ ...next, items: [...page.items, ...next.items] });
      setSummary(next.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load more requests");
    } finally {
      setLoadingMore(false);
    }
  }

  function openApply() {
    const today = dayValue(new Date());
    setType("CASUAL");
    setFromDate(today);
    setToDate(today);
    setReason("");
    setAttachment(null);
    setFormError("");
    setApplyOpen(true);
  }

  /**
   * Rejected here rather than after a 5 MB upload the server would turn down.
   * A rejected pick clears the input too, so it does not keep showing a file
   * that will not be sent.
   */
  function pickAttachment(input: HTMLInputElement) {
    const file = input.files?.[0] ?? null;
    if (!file) {
      setAttachment(null);
      return;
    }
    const problem = !allowedAttachmentTypes.includes(file.type)
      ? "Attach a PDF or an image (JPEG, PNG or WebP)."
      : file.size > maxAttachmentBytes
        ? `${file.name} is ${readableSize(file.size)}. The limit is 5 MB.`
        : null;
    if (problem) {
      input.value = "";
      setAttachment(null);
      setFormError(problem);
      return;
    }
    setFormError("");
    setAttachment(file);
  }

  async function submit() {
    if (reason.trim().length < 5) {
      setFormError("Give a reason of at least 5 characters.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await leaveApi.apply({ type, fromDate, toDate, reason: reason.trim(), attachment });
      setApplyOpen(false);
      setNotice("Leave request submitted for approval.");
      // Show the new request rather than leaving it hidden behind a filter;
      // changing the tab reloads on its own.
      if (status === null) await load();
      else setStatus(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Unable to submit the request");
    } finally {
      setSaving(false);
    }
  }

  async function withdraw(id: string) {
    setBusyId(id);
    setError("");
    try {
      await leaveApi.cancel(id);
      setNotice("Leave request withdrawn.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to withdraw the request");
    } finally {
      setBusyId(null);
    }
  }

  const tiles = [
    { label: "Total", value: summary.total, bg: "bg-[#E2EAFD]" },
    { label: "Pending", value: summary.pending, bg: "bg-[#FFF2DC]" },
    { label: "Approved", value: summary.approved, bg: "bg-[#E1F5EA]" },
    { label: "Rejected", value: summary.rejected, bg: "bg-[#FCE3E5]" }
  ];
  const counts: Record<string, number> = {
    All: summary.total,
    Pending: summary.pending,
    Approved: summary.approved,
    Rejected: summary.rejected
  };
  const items = page?.items ?? [];
  const days = dayCount(fromDate, toDate);

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        action={
          <button className="inline-flex min-h-10 items-center justify-center rounded-[6px] bg-[#2456E6] px-4 text-[13px] font-semibold text-white hover:bg-[#1C45BC]" onClick={openApply} type="button">
            Apply Leave
          </button>
        }
        breadcrumbs={[{ label: "My Leave" }]}
        title="My Leave"
      />

      <p className="-mt-2 text-[13px] text-[#5A6573]">
        Apply for leave and track what your principal has decided. A pending request can still be withdrawn.
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
              key={tab.label}
              onClick={() => setStatus(tab.status)}
              role="tab"
              type="button"
            >
              {tab.label}
              {!loading && counts[tab.label] > 0 ? (
                <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-white/20" : "bg-[#EEF1F5] text-[#5A6573]"}`}>{counts[tab.label]}</span>
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
          {status ? `No ${status.toLowerCase()} requests.` : "You have not applied for leave yet."}
        </p>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((request) => (
              <LeaveRequestCard busy={busyId === request.id} key={request.id} onWithdraw={() => withdraw(request.id)} request={request} />
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
        description="Your principal is notified as soon as you submit."
        footer={
          <>
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-[6px] border border-[#C2C9D4] bg-white px-4 text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]"
              onClick={() => setApplyOpen(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-[6px] bg-[#2456E6] px-4 text-[13px] font-semibold text-white hover:bg-[#1C45BC] disabled:opacity-50"
              disabled={saving}
              onClick={submit}
              type="button"
            >
              {saving ? "Submitting…" : "Submit Request"}
            </button>
          </>
        }
        isOpen={applyOpen}
        onClose={() => setApplyOpen(false)}
        title="Apply Leave"
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-[13px] font-semibold text-[#0F1419]">Leave type</span>
            <CustomSelect
              ariaLabel="Leave type"
              onChange={(value) => setType(value as LeaveType)}
              options={leaveTypes.map((item) => ({ label: leaveTypeLabel(item), value: item }))}
              value={type}
              wrapperClassName="mt-2"
            />
          </label>

          {/* Side by side: the two dates read as one range, not two unrelated fields. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[13px] font-semibold text-[#0F1419]">From</span>
              <div className="mt-2">
                <DatePicker
                  max={shiftDay(365)}
                  min={shiftDay(-30)}
                  onChange={(value) => {
                    if (!value) return;
                    setFromDate(value);
                    // Keep the range valid without making the teacher fix it by hand.
                    if (toDate < value) setToDate(value);
                  }}
                  value={fromDate}
                />
              </div>
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-[#0F1419]">To</span>
              <div className="mt-2">
                <DatePicker max={shiftDay(365)} min={fromDate} onChange={(value) => value && setToDate(value)} value={toDate} />
              </div>
            </label>
          </div>

          <p className="rounded-[6px] bg-[#E2EAFD] px-3 py-2.5 text-[13px] font-semibold text-[#1C45BC]">
            {days} {days === 1 ? "day" : "days"} of leave
          </p>

          <label className="block">
            <span className="text-[13px] font-semibold text-[#0F1419]">Reason</span>
            <TextArea
              className="mt-2"
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Why do you need this leave?"
              value={reason}
            />
          </label>

          <div>
            <span className="text-[13px] font-semibold text-[#0F1419]">Attachment (optional)</span>
            <p className="mt-0.5 text-[12px] text-[#86868b]">A PDF or image up to 5 MB — a medical certificate is the common case.</p>
            <input
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="mt-2 block w-full text-[13px] text-[#2A3340] file:mr-3 file:min-h-10 file:rounded-[6px] file:border file:border-[#C2C9D4] file:bg-white file:px-3 file:text-[13px] file:font-semibold file:text-[#2456E6] hover:file:bg-[#F7F8FB]"
              onChange={(event) => pickAttachment(event.target)}
              type="file"
            />
            {attachment ? (
              <p className="mt-2 text-[12px] font-semibold text-[#0F8A4A]">
                {attachment.name} · {readableSize(attachment.size)}
              </p>
            ) : null}
          </div>

          {formError ? <p className="text-[13px] font-semibold text-[#C8242C]">{formError}</p> : null}
        </div>
      </Modal>
    </div>
  );
}
