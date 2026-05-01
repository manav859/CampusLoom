import { StatusPill } from "@/components/ui/StatusPill";
import type { StudentDetail } from "@/lib/api";
import { money } from "./studentProfileUtils";

export type FeesTabPanelProps = {
  student: StudentDetail;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

function buildTransactionLedger(student: StudentDetail) {
  const total = student.feeAssignments.reduce((sum, assignment) => sum + Number(assignment.totalAmount ?? 0), 0);
  const payments = student.feeAssignments
    .flatMap((assignment) =>
      assignment.payments.map((payment) => ({
        id: payment.id,
        date: payment.paidAt,
        amount: Number(payment.amount ?? 0),
        mode: payment.mode,
        receiptId: payment.receipt?.id ?? null,
        receiptNo: payment.receipt?.receiptNo ?? null,
        feeStructureName: assignment.feeStructure.name
      }))
    )
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime() || left.id.localeCompare(right.id));

  let runningBalance = total;
  return payments.map((payment) => {
    runningBalance = Math.max(0, Math.round((runningBalance - payment.amount) * 100) / 100);
    return { ...payment, balanceAfter: runningBalance };
  });
}

export default function FeesTabPanel({ student }: FeesTabPanelProps) {
  const transactionLedger = buildTransactionLedger(student);
  const recentTransactions = [...transactionLedger].reverse();

  return (
    <section className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white shadow-apple">
        <div className="border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Fee assignments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="table-head">
              <tr>
                {["Fee", "Paid", "Pending", "Status"].map((head) => (
                  <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
              {student.feeAssignments.length === 0 ? (
                <tr>
                  <td className="px-5 py-12 text-center text-[#86868b]" colSpan={4}>No fee assignments found.</td>
                </tr>
              ) : (
                student.feeAssignments.map((assignment) => (
                  <tr key={assignment.id} className="table-row">
                    <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{assignment.feeStructure.name}</td>
                    <td className="px-5 py-4 text-[#6e6e73]">{money(assignment.paidAmount)}</td>
                    <td className="px-5 py-4 text-[#6e6e73]">{money(assignment.pendingAmount)}</td>
                    <td className="px-5 py-4">
                      <StatusPill
                        label={assignment.status}
                        tone={assignment.status === "PAID" ? "good" : assignment.status === "PARTIAL" ? "warn" : "danger"}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white shadow-apple">
          <div className="border-b border-[rgba(0,0,0,0.06)] px-5 py-4">
            <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Transaction ledger</h2>
            <p className="mt-0.5 text-[13px] text-[#86868b]">Running balance is recalculated from posted payments.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="table-head">
                <tr>{["Date", "Amount", "Mode", "Receipt ID", "Balance After", "Fee"].map((head) => <th className="px-5 py-3.5 font-semibold" key={head}>{head}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
                {recentTransactions.length === 0 ? (
                  <tr><td className="px-5 py-12 text-center text-[#86868b]" colSpan={6}>No payments recorded yet.</td></tr>
                ) : (
                  recentTransactions.map((payment) => (
                    <tr key={payment.id} className="table-row">
                      <td className="px-5 py-4 text-[#6e6e73]">{formatDate(payment.date)}</td>
                      <td className="px-5 py-4 font-semibold text-[#248a3d]">{money(payment.amount)}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{payment.mode}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{payment.receiptNo ?? payment.receiptId ?? "Pending"}</td>
                      <td className="px-5 py-4 font-semibold text-[#1d1d1f]">{money(payment.balanceAfter)}</td>
                      <td className="px-5 py-4 text-[#6e6e73]">{payment.feeStructureName}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="rounded-2xl border border-[rgba(0,0,0,0.04)] bg-white p-5 shadow-apple">
          <h2 className="text-[17px] font-semibold text-[#1d1d1f]">Payment timeline</h2>
          <div className="mt-5 space-y-5">
            {transactionLedger.length === 0 ? (
              <div className="rounded-xl bg-[rgba(0,0,0,0.02)] p-4 text-[13px] font-medium text-[#86868b]">No payment timeline yet.</div>
            ) : (
              transactionLedger.map((payment, index) => (
                <div className="relative pl-7" key={payment.id}>
                  <span className="absolute left-0 top-1.5 h-3 w-3 rounded-full bg-[#34c759] ring-4 ring-[#34c759]/15" />
                  {index < transactionLedger.length - 1 ? <span className="absolute bottom-[-22px] left-[5px] top-5 w-px bg-[rgba(0,0,0,0.08)]" /> : null}
                  <p className="text-[13px] font-semibold text-[#1d1d1f]">{money(payment.amount)} posted</p>
                  <p className="mt-1 text-[12px] text-[#86868b]">{formatDate(payment.date)} - {payment.mode}</p>
                  <p className="mt-1 text-[12px] font-semibold text-[#6e6e73]">Balance after: {money(payment.balanceAfter)}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </section>
  );
}
