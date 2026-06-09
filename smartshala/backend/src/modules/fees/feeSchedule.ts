function num(value: unknown) {
  return Number(value ?? 0);
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

type InstallmentLike = { dueDate: Date; amount: unknown };
type AssignmentLike = {
  totalAmount: unknown;
  paidAmount: unknown;
  feeStructure: { installments: InstallmentLike[] };
};

/**
 * Derive how much of an assignment should have been paid by `asOf`, based on the
 * fee structure's installment schedule. Nothing is stored — `pendingAmount` remains
 * the full-year balance; this is read-time only.
 *
 * `currentlyDue` is prorated by the fraction of the schedule that has come due, so a
 * student's transport fee (included in `totalAmount` but not in the installments) is
 * spread across the same schedule.
 */
export function computeCurrentDue(a: AssignmentLike, asOf: Date = new Date()) {
  const total = num(a.totalAmount);
  const paid = num(a.paidAmount);
  const inst = a.feeStructure?.installments ?? [];
  const structureTotal = inst.reduce((s, i) => s + num(i.amount), 0);
  const scheduledToDate = inst
    .filter((i) => i.dueDate.getTime() <= asOf.getTime())
    .reduce((s, i) => s + num(i.amount), 0);
  const dueFraction = structureTotal > 0
    ? scheduledToDate / structureTotal
    : (inst.length === 0 ? 1 : 0); // no schedule => whole amount considered due
  const currentlyDue = money(dueFraction * total);
  const currentOutstanding = money(Math.max(0, currentlyDue - paid));
  const currentCollected = money(Math.min(paid, currentlyDue));
  const upcomingDue = money(Math.max(0, total - currentlyDue));
  return { currentlyDue, currentOutstanding, currentCollected, upcomingDue };
}
