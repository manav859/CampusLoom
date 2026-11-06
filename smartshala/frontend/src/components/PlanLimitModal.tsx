"use client";

import { Modal } from "@/components/ui";
import { formatMinor, type PlanLimitDetails } from "@/lib/api";
import { withSchoolPath } from "@/lib/tenant";

/**
 * Shown when an admission is refused because the school has filled its plan's
 * student tier. The principal is sent to Billing to buy the difference; an
 * admin is told who can.
 */
export function PlanLimitModal({
  details,
  isPrincipal,
  onClose
}: {
  details: PlanLimitDetails;
  isPrincipal: boolean;
  onClose: () => void;
}) {
  const { upgrade } = details;
  const canBuyOnline = Boolean(upgrade?.selfServe);

  return (
    <Modal
      description={`${details.plan.name} covers ${details.maxStudents.toLocaleString("en-IN")} students`}
      isOpen
      onClose={onClose}
      title="You have filled your plan"
    >
      <div className="space-y-5 p-5">
        <div className="rounded-[6px] border border-[#FDE3B8] bg-[#FFF8EC] p-4">
          <p className="text-[13px] font-semibold text-[#8A5300]">
            {details.students.toLocaleString("en-IN")} of {details.maxStudents.toLocaleString("en-IN")} students are on
            your {details.plan.name} plan
            {details.adding > 1 ? `, so these ${details.adding.toLocaleString("en-IN")} will not fit.` : "."}
          </p>
        </div>

        {upgrade ? (
          <div className="rounded-[6px] border border-[#C9D3DE] bg-[#F7F8FB] p-4">
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#5A6573]">Next plan</p>
            <p className="mt-1 text-[20px] font-semibold text-[#031526]">{upgrade.planName}</p>
            <p className="mt-0.5 text-[13px] font-medium text-[#5A6573]">
              {upgrade.maxStudents === null
                ? "No student limit"
                : `Up to ${upgrade.maxStudents.toLocaleString("en-IN")} students`}
              {" · "}
              {formatMinor(upgrade.listPriceMinor, upgrade.currency)} a year
            </p>

            {canBuyOnline ? (
              <div className="mt-4 space-y-2 border-t border-[#DCE1E8] pt-3 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#5A6573]">
                    {upgrade.chargesDifferenceOnly ? "Difference to pay now" : "Price for a new year"}
                  </span>
                  <span className="font-semibold text-[#031526]">
                    {formatMinor(upgrade.subtotalMinor, upgrade.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#5A6573]">GST ({upgrade.taxPercent}%)</span>
                  <span className="font-semibold text-[#031526]">{formatMinor(upgrade.taxMinor, upgrade.currency)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[#DCE1E8] pt-2 text-[15px]">
                  <span className="font-semibold text-[#031526]">Total</span>
                  <span className="font-bold text-[#031526]">{formatMinor(upgrade.totalMinor, upgrade.currency)}</span>
                </div>
                {upgrade.chargesDifferenceOnly ? (
                  <p className="pt-1 text-[12px] font-medium text-[#5A6573]">
                    You pay only the difference between the two plans. Your renewal date stays{" "}
                    {new Date(upgrade.periodEnd).toLocaleDateString("en-IN", { dateStyle: "medium" })}.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 border-t border-[#DCE1E8] pt-3 text-[13px] font-medium text-[#5A6573]">
                {upgrade.note}
              </p>
            )}
          </div>
        ) : (
          <p className="text-[13px] font-medium text-[#5A6573]">
            Contact SmartShala to raise your student limit.
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          {canBuyOnline && isPrincipal ? (
            <a
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[6px] bg-[#2456E6] px-5 text-[14px] font-semibold text-white hover:bg-[#1B45BD]"
              href={withSchoolPath("/billing")}
            >
              Upgrade in Billing
            </a>
          ) : null}
          <button
            className="min-h-11 rounded-[6px] border border-[#C2C9D4] bg-white px-5 text-[14px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        {canBuyOnline && !isPrincipal ? (
          <p className="text-[12px] font-medium text-[#5A6573]">
            Only the principal can upgrade the plan. Ask them to open Billing.
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
