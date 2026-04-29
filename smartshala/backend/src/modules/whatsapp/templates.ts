function formatMessageDate(date: Date | string) {
  if (typeof date === "string") return date;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function buildAttendanceAbsentMessage(studentName: string, className: string, date: Date | string) {
  return `Dear Parent, your child ${studentName} (${className}) was absent on ${formatMessageDate(date)}.`;
}

export function buildFeeReceiptMessage(
  studentName: string,
  amount: number,
  receiptNo: string,
  date: Date | string,
  pendingAmount?: number,
  status?: string
) {
  let message = `Dear Parent, fee payment of Rs. ${amount.toFixed(2)} for ${studentName} was received on ${formatMessageDate(date)}. Receipt No: ${receiptNo}.`;

  if (pendingAmount !== undefined && pendingAmount > 0) {
    message += ` Remaining balance: Rs. ${pendingAmount.toFixed(2)}.`;
  } else if (status === "PAID") {
    message += ` All fees are now fully paid. Thank you!`;
  }

  return message;
}

export function buildFeeReminderMessage(studentName: string, balance: number, dueDate: Date | string) {
  return `Dear Parent, fee balance of Rs. ${balance.toFixed(2)} for ${studentName} is due on ${formatMessageDate(dueDate)}.`;
}
