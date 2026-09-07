import PDFDocument from "pdfkit";

export type InvoicePdfData = {
  seller: { name: string; address?: string | null; email?: string | null };
  school: {
    schoolId: string;
    schoolName: string;
    ownerName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  invoice: {
    number: string;
    status: string;
    currency: string;
    planName: string;
    planCode: string;
    subtotalMinor: number;
    discountMinor: number;
    taxMinor: number;
    totalMinor: number;
    amountPaidMinor: number;
    couponCode?: string | null;
    periodStart: Date;
    periodEnd: Date;
    issuedAt: Date;
    dueAt: Date;
    paidAt?: Date | null;
    notes?: string | null;
  };
  payments: {
    status: string;
    method?: string | null;
    reference?: string | null;
    amountMinor: number;
    refundedMinor: number;
    at: Date;
  }[];
};

type GridItem = [string, string];

const STATUS_COLORS: Record<string, { fill: string; text: string }> = {
  PAID: { fill: "#E1F5EA", text: "#0F8A4A" },
  DUE: { fill: "#FFF4E5", text: "#8A5300" },
  DRAFT: { fill: "#F1F3F6", text: "#5A6573" },
  VOID: { fill: "#F1F3F6", text: "#5A6573" },
  REFUNDED: { fill: "#EEF3FF", text: "#2456E6" }
};

function formatMoney(minor: number, currency: string): string {
  const prefix = currency === "INR" ? "Rs" : currency;
  return `${prefix} ${(minor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
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

function drawText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options?: PDFKit.Mixins.TextOptions
) {
  doc.text(text || "-", x, y, { width, height, ellipsis: true, ...options });
}

const MARGIN = 28;

/** Starts a new page when the next block would not fit under the bottom margin. */
function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number) {
  if (y + needed <= doc.page.height - MARGIN) return y;
  doc.addPage();
  return MARGIN;
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string, x: number, y: number, width: number) {
  doc.roundedRect(x, y, width, 23, 4).fill("#0F2557");
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#FFFFFF").text(title, x + 10, y + 7, {
    width: width - 20,
    characterSpacing: 0.45
  });
  return y + 23;
}

function drawGridSection(
  doc: PDFKit.PDFDocument,
  title: string,
  items: GridItem[],
  x: number,
  y: number,
  width: number,
  rowHeight = 32
) {
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

/** The billed line, then everything that adds up to the total. */
function drawChargesSection(doc: PDFKit.PDFDocument, data: InvoicePdfData, x: number, y: number, width: number) {
  const { invoice } = data;
  y = drawSectionTitle(doc, "CHARGES", x, y, width);

  const descriptionWidth = width - 150;
  const lineHeight = 40;
  doc.rect(x, y, width, lineHeight).lineWidth(0.8).strokeColor("#DCE1E8").stroke();
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0F1419");
  drawText(doc, `${invoice.planName} (${invoice.planCode})`, x + 10, y + 8, descriptionWidth - 20, 14);
  doc.font("Helvetica").fontSize(8.5).fillColor("#5A6573");
  drawText(
    doc,
    `Subscription period ${formatDate(invoice.periodStart)} to ${formatDate(invoice.periodEnd)}`,
    x + 10,
    y + 23,
    descriptionWidth - 20,
    12
  );
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#0F1419");
  drawText(doc, formatMoney(invoice.subtotalMinor, invoice.currency), x + descriptionWidth, y + 15, 140, 14, {
    align: "right"
  });
  y += lineHeight;

  const taxable = invoice.subtotalMinor - invoice.discountMinor;
  const taxLabel = taxable > 0 ? `GST (${Math.round((invoice.taxMinor / taxable) * 100)}%)` : "GST";

  const rows: GridItem[] = [["Subtotal", formatMoney(invoice.subtotalMinor, invoice.currency)]];
  if (invoice.discountMinor > 0) {
    rows.push([
      invoice.couponCode ? `Discount (${invoice.couponCode})` : "Discount",
      `- ${formatMoney(invoice.discountMinor, invoice.currency)}`
    ]);
  }
  if (invoice.taxMinor > 0) rows.push([taxLabel, formatMoney(invoice.taxMinor, invoice.currency)]);

  const rowHeight = 24;
  const labelX = x + descriptionWidth - 240;
  rows.forEach(([label, value], index) => {
    const rowY = y + index * rowHeight;
    doc.rect(x, rowY, width, rowHeight).lineWidth(0.8).strokeColor("#DCE1E8").stroke();
    doc.font("Helvetica").fontSize(9).fillColor("#5A6573");
    drawText(doc, label, labelX, rowY + 8, 230, 12, { align: "right" });
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0F1419");
    drawText(doc, value, x + descriptionWidth, rowY + 8, 140, 12, { align: "right" });
  });
  y += rows.length * rowHeight;

  const totalHeight = 34;
  doc.rect(x, y, width, totalHeight).fill("#0F2557");
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF");
  drawText(doc, "TOTAL PAYABLE", labelX, y + 12, 230, 14, { align: "right", characterSpacing: 0.3 });
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#FFFFFF");
  drawText(doc, formatMoney(invoice.totalMinor, invoice.currency), x + descriptionWidth, y + 10, 140, 16, {
    align: "right"
  });
  y += totalHeight;

  const balanceMinor = Math.max(0, invoice.totalMinor - invoice.amountPaidMinor);
  const settled: GridItem[] = [
    ["Amount paid", formatMoney(invoice.amountPaidMinor, invoice.currency)],
    ["Balance due", formatMoney(balanceMinor, invoice.currency)]
  ];
  settled.forEach(([label, value], index) => {
    const rowY = y + index * rowHeight;
    doc.rect(x, rowY, width, rowHeight).lineWidth(0.8).strokeColor("#DCE1E8").stroke();
    doc.font("Helvetica").fontSize(9).fillColor("#5A6573");
    drawText(doc, label, labelX, rowY + 8, 230, 12, { align: "right" });
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(index === 1 && balanceMinor > 0 ? "#C8242C" : "#0F8A4A");
    drawText(doc, value, x + descriptionWidth, rowY + 8, 140, 12, { align: "right" });
  });

  return y + settled.length * rowHeight + 14;
}

function drawPaymentsSection(doc: PDFKit.PDFDocument, data: InvoicePdfData, x: number, y: number, width: number) {
  if (!data.payments.length) return y;
  // A well-used invoice carries every abandoned checkout as its own row, so the
  // list has to be able to run onto a second page.
  y = ensureSpace(doc, y, 23 + 26);
  y = drawSectionTitle(doc, "PAYMENTS", x, y, width);

  const rowHeight = 26;
  data.payments.forEach((payment) => {
    const rowY = ensureSpace(doc, y, rowHeight);
    y = rowY;
    doc.rect(x, rowY, width, rowHeight).lineWidth(0.8).strokeColor("#DCE1E8").stroke();
    doc.font("Helvetica").fontSize(8.5).fillColor("#5A6573");
    drawText(doc, formatDate(payment.at), x + 10, rowY + 9, 84, 12);
    drawText(doc, payment.method || "-", x + 100, rowY + 9, 74, 12);
    drawText(doc, payment.reference || "-", x + 180, rowY + 9, width - 400, 12);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(payment.status === "CAPTURED" ? "#0F8A4A" : "#5A6573");
    drawText(doc, payment.status, x + width - 210, rowY + 9, 74, 12);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#0F1419");
    const amount =
      payment.refundedMinor > 0
        ? `${formatMoney(payment.amountMinor, data.invoice.currency)} (refunded ${formatMoney(payment.refundedMinor, data.invoice.currency)})`
        : formatMoney(payment.amountMinor, data.invoice.currency);
    drawText(doc, amount, x + width - 130, rowY + 9, 120, 12, { align: "right" });
    y += rowHeight;
  });

  return y + 14;
}

export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 28,
        info: {
          Title: `Invoice ${data.invoice.number}`,
          Author: data.seller.name,
          Subject: `Subscription invoice for ${data.school.schoolName}`
        }
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - MARGIN * 2;
      const left = MARGIN;
      let y = MARGIN;

      doc.rect(0, 0, doc.page.width, doc.page.height).fill("#FFFFFF");
      doc.roundedRect(left, y, pageWidth, 104, 8).lineWidth(1).strokeColor("#DCE1E8").fillAndStroke("#FFFFFF", "#DCE1E8");

      const metaX = left + pageWidth - 190;
      const sellerWidth = metaX - left - 32;
      doc.font("Helvetica-Bold").fontSize(16).fillColor("#0F1419");
      drawText(doc, data.seller.name, left + 16, y + 16, sellerWidth, 20);
      doc.font("Helvetica").fontSize(8.5).fillColor("#5A6573");
      drawText(doc, data.seller.address || "-", left + 16, y + 40, sellerWidth, 26);
      if (data.seller.email) {
        drawText(doc, `Billing queries: ${data.seller.email}`, left + 16, y + 72, sellerWidth, 14);
      }

      doc.roundedRect(metaX, y + 16, 174, 72, 6).fill("#F7F8FB");
      doc.roundedRect(metaX, y + 16, 174, 72, 6).strokeColor("#DCE1E8").stroke();
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#2456E6").text("SUBSCRIPTION INVOICE", metaX + 12, y + 26, {
        width: 150,
        characterSpacing: 0.5
      });
      doc.font("Helvetica-Bold").fontSize(13).fillColor("#0F1419");
      drawText(doc, data.invoice.number, metaX + 12, y + 40, 150, 18);

      const badge = STATUS_COLORS[data.invoice.status] ?? STATUS_COLORS.DRAFT;
      doc.roundedRect(metaX + 12, y + 62, 70, 18, 9).fill(badge.fill);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(badge.text).text(data.invoice.status, metaX + 12, y + 67, {
        width: 70,
        align: "center"
      });

      y += 120;
      y = drawGridSection(
        doc,
        "BILLED TO",
        [
          ["School", data.school.schoolName],
          ["School ID", data.school.schoolId],
          ["Contact", data.school.ownerName || "-"],
          ["Phone", data.school.phone || "-"],
          ["Email", data.school.email || "-"],
          ["Address", data.school.address || "-"]
        ],
        left,
        y,
        pageWidth
      );

      y = drawGridSection(
        doc,
        "INVOICE DETAILS",
        [
          ["Issued On", formatDate(data.invoice.issuedAt)],
          ["Due On", formatDate(data.invoice.dueAt)],
          ["Billing Period", `${formatDate(data.invoice.periodStart)} - ${formatDate(data.invoice.periodEnd)}`],
          ["Paid On", data.invoice.paidAt ? formatDate(data.invoice.paidAt) : "-"]
        ],
        left,
        y,
        pageWidth
      );

      y = drawChargesSection(doc, data, left, y, pageWidth);
      y = drawPaymentsSection(doc, data, left, y, pageWidth);

      if (data.invoice.notes) {
        y = ensureSpace(doc, y, 42);
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#5A6573");
        drawText(doc, "NOTES", left, y, pageWidth, 10, { characterSpacing: 0.2 });
        doc.font("Helvetica").fontSize(8.5).fillColor("#2A3340");
        drawText(doc, data.invoice.notes, left, y + 12, pageWidth, 26);
        y += 42;
      }

      y = ensureSpace(doc, y, 40);
      doc.rect(left, y, pageWidth, 1).fill("#DCE1E8");
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#5A6573")
        .text("This is a computer-generated invoice and does not require a signature.", left, y + 12, {
          width: pageWidth,
          align: "center"
        });
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#5A6573")
        .text(`Generated by SmartShala ERP - ${formatDateTime(new Date())}`, left, y + 25, {
          width: pageWidth,
          align: "center"
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
