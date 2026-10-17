"use client";

import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { StatusPill } from "@/components/ui/StatusPill";
import { leaveApi, type LeaveRequest, type LeaveStatus, type LeaveType } from "@/lib/api";
import { humanizeConstant } from "@/lib/formatters";

/** "Casual Leave", "Sick Leave" … "Other", as both apps label them. */
export function leaveTypeLabel(type: LeaveType | string) {
  return type === "OTHER" ? "Other" : `${humanizeConstant(type)} Leave`;
}

export const leaveStatusTone: Record<LeaveStatus, "good" | "warn" | "danger" | "neutral"> = {
  PENDING: "warn",
  APPROVED: "good",
  REJECTED: "danger",
  CANCELLED: "neutral"
};

function dayLabel(value: string) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function appliedLabel(value: string) {
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

type Props = {
  busy?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
  onWithdraw?: () => void;
  request: LeaveRequest;
  /** The principal's queue names who applied; a teacher only ever sees their own. */
  showApplicant?: boolean;
};

/**
 * One leave request, rendered the same way for both audiences — the mirror of
 * LeaveCard in the apps. The principal build adds the applicant and the
 * Approve / Reject pair, the teacher build adds Withdraw.
 */
export function LeaveRequestCard({ busy = false, onApprove, onReject, onWithdraw, request, showApplicant = false }: Props) {
  const range = request.days === 1 ? dayLabel(request.fromDate) : `${dayLabel(request.fromDate)} → ${dayLabel(request.toDate)}`;
  const showActions = request.status === "PENDING" && (onApprove || onReject || onWithdraw);

  return (
    <article className="rounded-[8px] border border-[#DCE1E8] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
      <div className="flex items-start gap-3">
        {showApplicant ? <InitialsAvatar name={request.applicant.fullName} /> : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-[#0F1419]">
            {showApplicant ? request.applicant.fullName : leaveTypeLabel(request.type)}
          </p>
          <p className="truncate text-[12px] text-[#5A6573]">
            {showApplicant
              ? `${leaveTypeLabel(request.type)} · ${humanizeConstant(request.applicant.role)}`
              : `${request.days} ${request.days === 1 ? "day" : "days"}`}
          </p>
        </div>
        <StatusPill label={request.status} tone={leaveStatusTone[request.status]} />
      </div>

      <div className="mt-3 flex items-center gap-2 text-[13px]">
        <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-[#86868b]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <rect height="16" rx="2" width="18" x="3" y="5" />
          <path d="M8 3v4M16 3v4M3 11h18" />
        </svg>
        <span className="font-semibold text-[#0F1419]">{range}</span>
        {showApplicant ? <span className="ml-auto font-semibold text-[#5A6573]">{request.days}d</span> : null}
      </div>

      <p className="mt-2 whitespace-pre-wrap text-[13px] leading-5 text-[#5A6573]">{request.reason}</p>

      {request.hasAttachment ? (
        <button
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#2456E6] hover:underline"
          onClick={() => leaveApi.downloadAttachment(request.id, request.attachmentName ?? "leave-attachment")}
          type="button"
        >
          <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          <span className="max-w-[220px] truncate">{request.attachmentName ?? "Attachment"}</span>
        </button>
      ) : null}

      <p className="mt-2.5 text-[11px] text-[#86868b]">
        Applied {appliedLabel(request.appliedOn)}
        {request.status !== "PENDING" && request.decidedBy
          ? ` · ${humanizeConstant(request.status)} by ${request.decidedBy.fullName}`
          : ""}
      </p>

      {request.decisionNote ? (
        <p className="mt-2 rounded-[6px] bg-[#F7F8FB] px-3 py-2 text-[12px] leading-5 text-[#2A3340]">{request.decisionNote}</p>
      ) : null}

      {showActions ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[#EEF1F5] pt-3">
          {onApprove ? (
            <button
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-[6px] bg-[#0F8A4A] px-4 text-[13px] font-semibold text-white transition hover:bg-[#0C7340] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
              onClick={onApprove}
              type="button"
            >
              Approve
            </button>
          ) : null}
          {onReject ? (
            <button
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-[6px] border border-[#C8242C] px-4 text-[13px] font-semibold text-[#C8242C] transition hover:bg-[#FCE3E5] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
              onClick={onReject}
              type="button"
            >
              Reject
            </button>
          ) : null}
          {onWithdraw ? (
            <button
              className="inline-flex min-h-10 items-center justify-center rounded-[6px] border border-[#C2C9D4] px-4 text-[13px] font-semibold text-[#2A3340] transition hover:bg-[#F7F8FB] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
              onClick={onWithdraw}
              type="button"
            >
              Withdraw
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
