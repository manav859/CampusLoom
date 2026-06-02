import PDFDocument from "pdfkit";

type ReceiptData = {
  receiptNo: string;
  issuedAt: Date;
  school: {
    name: string;
    city?: string | null;
    state?: string | null;
    phone?: string | null;
    udiseNumber?: string | null;
    affiliationBoard?: string | null;
    logoUrl?: string | null;
  };
  student: {
    fullName: string;
    admissionNumber: string;
    class: string;
    parentName: string;
    parentPhone: string;
  };
  payment: {
    amount: number;
    mode: string;
    recordedByName?: string | null;
    upiTransactionId?: string | null;
    chequeNumber?: string | null;
    ddNumber?: string | null;
    gatewayTransactionId?: string | null;
    bankReference?: string | null;
    paidAt: Date;
    notes?: string | null;
  };
  feeStructure: {
    name: string;
    academicYear: string;
    totalAmount: number;
  };
  ledger: {
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    status: string;
  };
};

type GridItem = [string, string];

function formatMoney(value: number): string {
  return `Rs ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

function formatMode(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function schoolInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "SS";
}

function schoolAddress(school: ReceiptData["school"]) {
  return [school.city, school.state].filter(Boolean).join(", ") || "-";
}

function imageBufferFromDataUrl(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^data:image\/(?:png|jpe?g);base64,(.+)$/i);
  if (!match) return null;
  return Buffer.from(match[1], "base64");
}

function paymentReference(payment: ReceiptData["payment"]) {
  return (
    payment.upiTransactionId ||
    payment.chequeNumber ||
    payment.ddNumber ||
    payment.gatewayTransactionId ||
    payment.bankReference ||
    "-"
  );
}

function fitFontSize(doc: PDFKit.PDFDocument, text: string, width: number, maxHeight: number, startSize: number, minSize: number) {
  for (let size = startSize; size >= minSize; size -= 1) {
    doc.font("Helvetica-Bold").fontSize(size);
    if (doc.heightOfString(text, { width }) <= maxHeight) return size;
  }
  return minSize;
}

function drawText(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number, height: number, options?: PDFKit.Mixins.TextOptions) {
  doc.text(text || "-", x, y, { width, height, ellipsis: true, ...options });
}

function drawLogo(doc: PDFKit.PDFDocument, data: ReceiptData, x: number, y: number, size: number) {
  doc.roundedRect(x, y, size, size, 8).lineWidth(1).strokeColor("#DCE1E8").fillAndStroke("#F7F8FB", "#DCE1E8");

  const logoBuffer = imageBufferFromDataUrl(data.school.logoUrl);
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, x + 6, y + 6, { fit: [size - 12, size - 12], align: "center", valign: "center" });
      return;
    } catch {
      // Fall back to initials below.
    }
  }

  doc.font("Helvetica-Bold").fontSize(15).fillColor("#2456E6").text(schoolInitials(data.school.name), x, y + size / 2 - 8, {
    width: size,
    align: "center"
  });
}

function drawHeaderField(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number) {
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#5A6573");
  drawText(doc, label.toUpperCase(), x, y, width, 10, { characterSpacing: 0.25 });
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0F1419");
  drawText(doc, value || "-", x, y + 12, width, 18);
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, x: number, y: number, width: number) {
  doc.roundedRect(x, y, width, 23, 4).fill("#0F2557");
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#FFFFFF").text(title, x + 10, y + 7, {
    width: width - 20,
    characterSpacing: 0.45
  });
  return y + 23;
}

function drawGridSection(doc: PDFKit.PDFDocument, title: string, items: GridItem[], x: number, y: number, width: number, rowHeight = 34) {
  y = drawSectionTitle(doc, title, x, y, width);

  const columnWidth = width / 2;
  for (let index = 0; index < items.length; index += 2) {
    const rowItems = [items[index], items[index + 1]].filter(Boolean) as GridItem[];
    const rowY = y + Math.floor(index / 2) * rowHeight;
    doc.rect(x, rowY, width, rowHeight).lineWidth(0.8).strokeColor("#DCE1E8").stroke();

    for (let column = 0; column < 2; column += 1) {
      const item = rowItems[column];
      const cellX = x + column * columnWidth;
      if (column === 1) doc.moveTo(cellX, rowY).lineTo(cellX, rowY + rowHeight).strokeColor("#DCE1E8").stroke();
      if (!item) continue;

      const [label, value] = item;
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#5A6573");
      drawText(doc, label.toUpperCase(), cellX + 10, rowY + 6, columnWidth - 20, 10, { characterSpacing: 0.2 });
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0F1419");
      drawText(doc, value, cellX + 10, rowY + 18, columnWidth - 20, rowHeight - 20);
    }
  }

  return y + Math.ceil(items.length / 2) * rowHeight + 14;
}

function drawAmountSection(doc: PDFKit.PDFDocument, data: ReceiptData, x: number, y: number, width: number) {
  y = drawSectionTitle(doc, "AMOUNT DETAILS", x, y, width);

  const rows: GridItem[] = [
    ["TOTAL FEE", formatMoney(data.feeStructure.totalAmount)],
    ["AMOUNT PAID (THIS RECEIPT)", formatMoney(data.payment.amount)],
    ["TOTAL PAID TO DATE", formatMoney(data.ledger.paidAmount)],
    ["REMAINING BALANCE", formatMoney(data.ledger.pendingAmount)]
  ];
  const rowHeight = 36;
  const labelWidth = 210;
  const valueWidth = width - labelWidth;

  rows.forEach(([label, value], index) => {
    const rowY = y + index * rowHeight;
    const isPaidRow = label.includes("PAID");
    const isBalanceRow = label.includes("BALANCE");
    const valueColor = isPaidRow ? "#0F8A4A" : isBalanceRow && data.ledger.pendingAmount > 0 ? "#C8242C" : "#0F1419";

    doc.rect(x, rowY, width, rowHeight).lineWidth(0.8).strokeColor("#DCE1E8").stroke();
    doc.rect(x, rowY, labelWidth, rowHeight).fill("#F7F8FB");
    doc.rect(x, rowY, labelWidth, rowHeight).strokeColor("#DCE1E8").stroke();
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#5A6573").text(label, x + 10, rowY + 13, { width: labelWidth - 20 });
    doc.font("Helvetica-Bold").fontSize(13).fillColor(valueColor).text(value, x + labelWidth + 10, rowY + 10, {
      width: valueWidth - 20,
      align: "right"
    });
  });

  return y + rows.length * rowHeight + 14;
}

function drawReceivedSection(doc: PDFKit.PDFDocument, data: ReceiptData, x: number, y: number, width: number) {
  const height = 58;
  const columnWidth = width / 3;
  const items: GridItem[] = [
    ["AMOUNT RECEIVED", formatMoney(data.payment.amount)],
    ["VIA", formatMode(data.payment.mode)],
    ["PAYMENT RECEIVED BY", data.payment.recordedByName ?? "School office"]
  ];

  doc.roundedRect(x, y, width, height, 6).fill("#EAF9EB");
  doc.roundedRect(x, y, width, height, 6).lineWidth(0.8).strokeColor("#BEE7CB").stroke();

  items.forEach(([label, value], index) => {
    const cellX = x + index * columnWidth;
    if (index > 0) doc.moveTo(cellX, y + 9).lineTo(cellX, y + height - 9).strokeColor("#BEE7CB").stroke();
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#0F8A4A");
    drawText(doc, label, cellX + 10, y + 11, columnWidth - 20, 10, { characterSpacing: 0.2 });
    doc.font("Helvetica-Bold").fontSize(index === 0 ? 13 : 10).fillColor("#0F1419");
    drawText(doc, value, cellX + 10, y + 28, columnWidth - 20, 20);
  });

  return y + height + 12;
}

export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 28,
        info: {
          Title: `Fee Receipt - ${data.receiptNo}`,
          Author: data.school.name,
          Subject: `Fee receipt for ${data.student.fullName}`
        }
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const margin = 28;
      const pageWidth = doc.page.width - margin * 2;
      const left = margin;
      let y = margin;

      doc.rect(0, 0, doc.page.width, doc.page.height).fill("#FFFFFF");
      doc.roundedRect(left, y, pageWidth, 118, 8).lineWidth(1).strokeColor("#DCE1E8").fillAndStroke("#FFFFFF", "#DCE1E8");

      drawLogo(doc, data, left + 14, y + 16, 58);

      const schoolX = left + 84;
      const receiptX = left + pageWidth - 174;
      const schoolWidth = receiptX - schoolX - 18;
      const schoolFont = fitFontSize(doc, data.school.name, schoolWidth, 32, 16, 11);
      doc.font("Helvetica-Bold").fontSize(schoolFont).fillColor("#0F1419");
      drawText(doc, data.school.name, schoolX, y + 16, schoolWidth, 34);
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#2456E6").text("FEE PAYMENT RECEIPT", schoolX, y + 52, {
        width: schoolWidth,
        characterSpacing: 0.5
      });
      doc.font("Helvetica").fontSize(8.5).fillColor("#5A6573");
      drawText(doc, `Address: ${schoolAddress(data.school)}`, schoolX, y + 70, schoolWidth, 14);
      drawText(
        doc,
        `Phone: ${data.school.phone || "-"}   Board: ${data.school.affiliationBoard || "-"}   U-DISE: ${data.school.udiseNumber || "-"}`,
        schoolX,
        y + 87,
        schoolWidth,
        16
      );

      doc.roundedRect(receiptX, y + 16, 160, 78, 6).fill("#F7F8FB");
      doc.roundedRect(receiptX, y + 16, 160, 78, 6).strokeColor("#DCE1E8").stroke();
      drawHeaderField(doc, "Receipt No", data.receiptNo, receiptX + 12, y + 27, 136);
      drawHeaderField(doc, "Issued Date & Time", formatDateTime(data.issuedAt), receiptX + 12, y + 61, 136);

      y += 134;
      y = drawGridSection(doc, "STUDENT DETAILS", [
        ["Student Name", data.student.fullName],
        ["Admission No", data.student.admissionNumber],
        ["Class / Section", data.student.class],
        ["Parent / Guardian", data.student.parentName],
        ["Contact", data.student.parentPhone]
      ], left, y, pageWidth, 32);

      y = drawGridSection(doc, "PAYMENT DETAILS", [
        ["Fee Structure", data.feeStructure.name],
        ["Academic Year", data.feeStructure.academicYear],
        ["Payment Mode", formatMode(data.payment.mode)],
        ["Payment Date", formatDate(data.payment.paidAt)],
        ["Transaction Reference", paymentReference(data.payment)],
        ["Notes", data.payment.notes || "-"]
      ], left, y, pageWidth, 32);

      y = drawAmountSection(doc, data, left, y, pageWidth);
      y = drawReceivedSection(doc, data, left, y, pageWidth);

      doc.rect(left, y, pageWidth, 1).fill("#DCE1E8");
      y += 12;
      doc.font("Helvetica").fontSize(8).fillColor("#5A6573").text("This is a computer-generated receipt and does not require a signature.", left, y, {
        width: pageWidth,
        align: "center"
      });
      doc.font("Helvetica").fontSize(8).fillColor("#5A6573").text(`Generated by SmartShala ERP - ${formatDateTime(new Date())}`, left, y + 13, {
        width: pageWidth,
        align: "center"
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
