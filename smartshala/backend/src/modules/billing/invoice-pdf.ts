import PDFDocument from "pdfkit";

export type InvoicePdfData = {
  seller: {
    name: string;
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    gstin?: string | null;
    pan?: string | null;
    stateName?: string | null;
    stateCode?: string | null;
  };
  school: {
    schoolId: string;
    schoolName: string;
    ownerName?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    gstin?: string | null;
    stateName?: string | null;
    stateCode?: string | null;
  };
  invoice: {
    number: string;
    status: string;
    currency: string;
    planName: string;
    planCode: string;
    sacCode: string;
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

const MARGIN = 36;
const RULE = "#8A8A8A";
const HAIRLINE = 0.7;
const INK = "#000000";
const MUTED = "#444444";

function money(minor: number, currency: string): string {
  const prefix = currency === "INR" ? "Rs." : `${currency} `;
  return `${prefix}${(minor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen"
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function underHundred(value: number): string {
  if (value < 20) return ONES[value];
  const tens = TENS[Math.floor(value / 10)];
  const ones = ONES[value % 10];
  return ones ? `${tens} ${ones}` : tens;
}

/** Indian numbering: crore, lakh, thousand, hundred. */
function wordsForInteger(value: number): string {
  if (value === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(value / 10000000);
  const lakh = Math.floor((value % 10000000) / 100000);
  const thousand = Math.floor((value % 100000) / 1000);
  const hundred = Math.floor((value % 1000) / 100);
  const rest = value % 100;

  if (crore) parts.push(`${wordsForInteger(crore)} Crore`);
  if (lakh) parts.push(`${underHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${underHundred(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (rest) parts.push(underHundred(rest));
  return parts.join(" ");
}

/** "Rupees Twelve Thousand Three Hundred and Fifty Paise Only" — the line a
 *  filed invoice is expected to carry. */
export function amountInWords(minor: number, currency: string): string {
  const rupees = Math.floor(minor / 100);
  const paise = minor % 100;
  const unit = currency === "INR" ? "Rupees" : currency;
  const head = `${unit} ${wordsForInteger(rupees)}`;
  return paise ? `${head} and ${underHundred(paise)} Paise Only` : `${head} Only`;
}

/**
 * CGST+SGST when the supply stays inside the seller's state, IGST when it
 * crosses. With no buyer state on file we assume intra-state, which is what a
 * seller invoicing an unregistered local buyer would do.
 */
function taxSplit(data: InvoicePdfData) {
  const sellerState = data.seller.stateCode?.trim() || null;
  const buyerState = data.school.stateCode?.trim() || null;
  const interState = Boolean(sellerState && buyerState && sellerState !== buyerState);

  const taxable = data.invoice.subtotalMinor - data.invoice.discountMinor;
  const ratePercent = taxable > 0 ? (data.invoice.taxMinor / taxable) * 100 : 0;

  if (interState) {
    return { interState, rows: [{ label: `IGST @ ${ratePercent.toFixed(2)}%`, amountMinor: data.invoice.taxMinor }] };
  }

  // Halve on the total, not on each line, so the two halves always add back up.
  const cgst = Math.round(data.invoice.taxMinor / 2);
  const sgst = data.invoice.taxMinor - cgst;
  const half = (ratePercent / 2).toFixed(2);
  return {
    interState,
    rows: [
      { label: `CGST @ ${half}%`, amountMinor: cgst },
      { label: `SGST @ ${half}%`, amountMinor: sgst }
    ]
  };
}

function label(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number) {
  doc.font("Helvetica").fontSize(7).fillColor(MUTED).text(text.toUpperCase(), x, y, {
    width,
    characterSpacing: 0.4
  });
}

function value(doc: PDFKit.PDFDocument, text: string, x: number, y: number, width: number, bold = false, height = 12) {
  doc
    .font(bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(9)
    .fillColor(INK)
    // height is what makes ellipsis bite, so a long value truncates inside its
    // cell instead of spilling over the rule below it.
    .text(text || "-", x, y, { width, height, ellipsis: true });
}

function box(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number) {
  doc.rect(x, y, width, height).lineWidth(HAIRLINE).strokeColor(RULE).stroke();
}

function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number) {
  if (y + needed <= doc.page.height - MARGIN - 20) return y;
  doc.addPage();
  return MARGIN;
}

/** Party block — seller on one side, buyer on the other. */
function drawParty(
  doc: PDFKit.PDFDocument,
  heading: string,
  party: {
    name: string;
    lines: string[];
    gstin?: string | null;
    stateName?: string | null;
    stateCode?: string | null;
  },
  x: number,
  y: number,
  width: number,
  height: number
) {
  box(doc, x, y, width, height);
  doc.rect(x, y, width, 15).fillColor("#EFEFEF").fill();
  box(doc, x, y, width, 15);
  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(INK).text(heading.toUpperCase(), x + 8, y + 4.5, {
    width: width - 16,
    characterSpacing: 0.5
  });

  let cursor = y + 21;
  doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(party.name, x + 8, cursor, { width: width - 16 });
  cursor = doc.y + 2;

  doc.font("Helvetica").fontSize(8).fillColor(MUTED);
  party.lines.filter(Boolean).forEach((line) => {
    doc.text(line, x + 8, cursor, { width: width - 16 });
    cursor = doc.y + 1;
  });

  cursor += 3;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(INK);
  doc.text(`GSTIN: ${party.gstin || "Unregistered"}`, x + 8, cursor, { width: width - 16 });
  cursor = doc.y + 1;
  const state = party.stateName ? `${party.stateName}${party.stateCode ? ` (${party.stateCode})` : ""}` : "-";
  doc.text(`State: ${state}`, x + 8, cursor, { width: width - 16 });
}

export function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: MARGIN,
        info: {
          Title: `Tax Invoice ${data.invoice.number}`,
          Author: data.seller.name,
          Subject: `Subscription tax invoice for ${data.school.schoolName}`
        }
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = MARGIN;
      const width = doc.page.width - MARGIN * 2;
      const half = width / 2;
      const currency = data.invoice.currency;
      let y = MARGIN;

      // --- Title -------------------------------------------------------------
      doc.font("Helvetica-Bold").fontSize(15).fillColor(INK).text("TAX INVOICE", left, y, {
        width,
        align: "center",
        characterSpacing: 1.2
      });
      y += 20;
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text("(Issued under Rule 46 of the CGST Rules, 2017)", left, y, {
        width,
        align: "center"
      });
      y += 16;

      // --- Seller | Invoice meta --------------------------------------------
      const partyHeight = 104;
      drawParty(
        doc,
        "Supplier",
        {
          name: data.seller.name,
          lines: [
            data.seller.address || "",
            data.seller.phone ? `Phone: ${data.seller.phone}` : "",
            data.seller.email ? `Email: ${data.seller.email}` : "",
            data.seller.pan ? `PAN: ${data.seller.pan}` : ""
          ],
          gstin: data.seller.gstin,
          stateName: data.seller.stateName,
          stateCode: data.seller.stateCode
        },
        left,
        y,
        half,
        partyHeight
      );

      const metaX = left + half;
      box(doc, metaX, y, half, partyHeight);
      doc.rect(metaX, y, half, 15).fillColor("#EFEFEF").fill();
      box(doc, metaX, y, half, 15);
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(INK).text("INVOICE DETAILS", metaX + 8, y + 4.5, {
        width: half - 16,
        characterSpacing: 0.5
      });

      const metaRows: [string, string][] = [
        ["Invoice No.", data.invoice.number],
        ["Invoice Date", formatDate(data.invoice.issuedAt)],
        ["Due Date", formatDate(data.invoice.dueAt)],
        ["Place of Supply", data.school.stateName ? `${data.school.stateName} (${data.school.stateCode ?? "-"})` : "-"],
        ["Reverse Charge", "No"],
        ["Status", data.invoice.status]
      ];
      const metaRowHeight = (partyHeight - 15) / 3;
      metaRows.forEach(([metaLabel, metaValue], index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const cellX = metaX + column * (half / 2);
        const cellY = y + 15 + row * metaRowHeight;
        box(doc, cellX, cellY, half / 2, metaRowHeight);
        label(doc, metaLabel, cellX + 8, cellY + 5, half / 2 - 16);
        value(doc, metaValue, cellX + 8, cellY + 15, half / 2 - 16, true);
      });
      y += partyHeight;

      // --- Buyer -------------------------------------------------------------
      drawParty(
        doc,
        "Billed to (Recipient)",
        {
          name: data.school.schoolName,
          lines: [
            data.school.address || "",
            data.school.ownerName ? `Attn: ${data.school.ownerName}` : "",
            data.school.phone ? `Phone: ${data.school.phone}` : "",
            data.school.email ? `Email: ${data.school.email}` : ""
          ],
          gstin: data.school.gstin,
          stateName: data.school.stateName,
          stateCode: data.school.stateCode
        },
        left,
        y,
        half,
        partyHeight
      );

      box(doc, metaX, y, half, partyHeight);
      doc.rect(metaX, y, half, 15).fillColor("#EFEFEF").fill();
      box(doc, metaX, y, half, 15);
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(INK).text("SUBSCRIPTION", metaX + 8, y + 4.5, {
        width: half - 16,
        characterSpacing: 0.5
      });
      const subRows: [string, string][] = [
        ["School ID", data.school.schoolId],
        ["Plan Code", data.invoice.planCode],
        ["Billing Period", `${formatDate(data.invoice.periodStart)} to ${formatDate(data.invoice.periodEnd)}`],
        ["Paid On", data.invoice.paidAt ? formatDate(data.invoice.paidAt) : "-"]
      ];
      const subRowHeight = (partyHeight - 15) / 2;
      subRows.forEach(([subLabel, subValue], index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const cellX = metaX + column * (half / 2);
        const cellY = y + 15 + row * subRowHeight;
        box(doc, cellX, cellY, half / 2, subRowHeight);
        label(doc, subLabel, cellX + 8, cellY + 6, half / 2 - 16);
        value(doc, subValue, cellX + 8, cellY + 17, half / 2 - 16, true, 24);
      });
      y += partyHeight + 12;

      // --- Line items --------------------------------------------------------
      const columns = [
        { key: "sr", title: "#", width: 24, align: "left" as const },
        { key: "desc", title: "Description of Service", width: 231, align: "left" as const },
        { key: "sac", title: "SAC", width: 54, align: "left" as const },
        { key: "qty", title: "Qty", width: 32, align: "right" as const },
        { key: "rate", title: "Rate", width: 91, align: "right" as const },
        { key: "amount", title: "Taxable Value", width: width - 24 - 231 - 54 - 32 - 91, align: "right" as const }
      ];

      const headHeight = 20;
      doc.rect(left, y, width, headHeight).fillColor("#EFEFEF").fill();
      box(doc, left, y, width, headHeight);
      let columnX = left;
      columns.forEach((column) => {
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(INK).text(column.title.toUpperCase(), columnX + 6, y + 6.5, {
          width: column.width - 12,
          align: column.align,
          characterSpacing: 0.3
        });
        columnX += column.width;
        if (columnX < left + width) doc.moveTo(columnX, y).lineTo(columnX, y + headHeight).lineWidth(HAIRLINE).strokeColor(RULE).stroke();
      });
      y += headHeight;

      const taxableMinor = data.invoice.subtotalMinor - data.invoice.discountMinor;
      const itemHeight = 46;
      box(doc, left, y, width, itemHeight);
      columnX = left;
      const cells = [
        "1",
        "",
        data.invoice.sacCode,
        "1",
        money(data.invoice.subtotalMinor, currency),
        money(data.invoice.subtotalMinor, currency)
      ];
      columns.forEach((column, index) => {
        if (index > 0) doc.moveTo(columnX, y).lineTo(columnX, y + itemHeight).lineWidth(HAIRLINE).strokeColor(RULE).stroke();
        if (column.key === "desc") {
          doc.font("Helvetica-Bold").fontSize(9).fillColor(INK).text(data.invoice.planName, columnX + 6, y + 8, {
            width: column.width - 12
          });
          doc
            .font("Helvetica")
            .fontSize(7.5)
            .fillColor(MUTED)
            .text(
              `SmartShala school ERP subscription\nPeriod: ${formatDate(data.invoice.periodStart)} to ${formatDate(data.invoice.periodEnd)}`,
              columnX + 6,
              y + 21,
              { width: column.width - 12 }
            );
        } else {
          doc.font("Helvetica").fontSize(9).fillColor(INK).text(cells[index], columnX + 6, y + 17, {
            width: column.width - 12,
            align: column.align
          });
        }
        columnX += column.width;
      });
      y += itemHeight;

      // --- Words | Totals ----------------------------------------------------
      const split = taxSplit(data);
      const summaryRows: [string, string, boolean][] = [
        ["Taxable Value", money(data.invoice.subtotalMinor, currency), false]
      ];
      if (data.invoice.discountMinor > 0) {
        summaryRows.push([
          data.invoice.couponCode ? `Less: Discount (${data.invoice.couponCode})` : "Less: Discount",
          `- ${money(data.invoice.discountMinor, currency)}`,
          false
        ]);
        summaryRows.push(["Net Taxable Value", money(taxableMinor, currency), false]);
      }
      split.rows.forEach((row) => summaryRows.push([row.label, money(row.amountMinor, currency), false]));
      summaryRows.push(["Total Invoice Value", money(data.invoice.totalMinor, currency), true]);
      summaryRows.push(["Amount Paid", money(data.invoice.amountPaidMinor, currency), false]);
      summaryRows.push([
        "Balance Due",
        money(Math.max(0, data.invoice.totalMinor - data.invoice.amountPaidMinor), currency),
        true
      ]);

      const summaryWidth = 244;
      const wordsWidth = width - summaryWidth;
      const summaryRowHeight = 19;
      const summaryHeight = summaryRows.length * summaryRowHeight;

      box(doc, left, y, wordsWidth, summaryHeight);
      label(doc, "Total invoice value (in words)", left + 8, y + 8, wordsWidth - 16);
      doc
        .font("Helvetica-Bold")
        .fontSize(8.5)
        .fillColor(INK)
        .text(amountInWords(data.invoice.totalMinor, currency), left + 8, y + 20, { width: wordsWidth - 16 });
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(MUTED)
        .text(
          split.interState
            ? "Inter-state supply: IGST charged."
            : "Intra-state supply: CGST and SGST charged in equal halves.",
          left + 8,
          y + summaryHeight - 22,
          { width: wordsWidth - 16 }
        );

      const summaryX = left + wordsWidth;
      summaryRows.forEach(([rowLabel, rowValue, strong], index) => {
        const rowY = y + index * summaryRowHeight;
        box(doc, summaryX, rowY, summaryWidth, summaryRowHeight);
        if (strong) {
          doc.rect(summaryX + HAIRLINE, rowY + HAIRLINE, summaryWidth - HAIRLINE * 2, summaryRowHeight - HAIRLINE * 2).fillColor("#EFEFEF").fill();
          box(doc, summaryX, rowY, summaryWidth, summaryRowHeight);
        }
        doc
          .font(strong ? "Helvetica-Bold" : "Helvetica")
          .fontSize(8.5)
          .fillColor(INK)
          .text(rowLabel, summaryX + 8, rowY + 5.5, { width: summaryWidth / 2 - 8 });
        doc
          .font("Helvetica-Bold")
          .fontSize(8.5)
          .fillColor(INK)
          .text(rowValue, summaryX + summaryWidth / 2, rowY + 5.5, {
            width: summaryWidth / 2 - 8,
            align: "right"
          });
      });
      y += summaryHeight + 12;

      // --- Payments ----------------------------------------------------------
      if (data.payments.length) {
        y = ensureSpace(doc, y, 18 + 18 * Math.min(data.payments.length, 3));
        doc.rect(left, y, width, 18).fillColor("#EFEFEF").fill();
        box(doc, left, y, width, 18);
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(INK).text("PAYMENT HISTORY", left + 8, y + 5.5, {
          width: width - 16,
          characterSpacing: 0.4
        });
        y += 18;

        const payHeight = 18;
        data.payments.forEach((payment) => {
          y = ensureSpace(doc, y, payHeight);
          box(doc, left, y, width, payHeight);
          doc.font("Helvetica").fontSize(8).fillColor(MUTED);
          doc.text(formatDate(payment.at), left + 8, y + 5.5, { width: 84 });
          doc.text(payment.method || "-", left + 96, y + 5.5, { width: 70 });
          doc.text(payment.reference || "-", left + 170, y + 5.5, { width: width - 350, ellipsis: true });
          doc.font("Helvetica-Bold").fontSize(8).fillColor(INK);
          doc.text(payment.status, left + width - 176, y + 5.5, { width: 74 });
          const amount =
            payment.refundedMinor > 0
              ? `${money(payment.amountMinor, currency)} (refund ${money(payment.refundedMinor, currency)})`
              : money(payment.amountMinor, currency);
          doc.text(amount, left + width - 100, y + 5.5, { width: 92, align: "right" });
          y += payHeight;
        });
        y += 12;
      }

      // --- Notes, declaration, signature -------------------------------------
      const footerHeight = 74;
      y = ensureSpace(doc, y, footerHeight + 24);
      const declWidth = width - 190;
      box(doc, left, y, declWidth, footerHeight);
      label(doc, "Declaration", left + 8, y + 7, declWidth - 16);
      doc
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor(MUTED)
        .text(
          "We declare that this invoice shows the actual price of the service described and that all particulars are true and correct. This is a computer-generated invoice and does not require a physical signature.",
          left + 8,
          y + 19,
          { width: declWidth - 16 }
        );
      if (data.invoice.notes) {
        doc.font("Helvetica").fontSize(7.5).fillColor(INK).text(`Note: ${data.invoice.notes}`, left + 8, y + 55, {
          width: declWidth - 16,
          ellipsis: true,
          height: 14
        });
      }

      box(doc, left + declWidth, y, 190, footerHeight);
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(MUTED)
        .text(`For ${data.seller.name}`, left + declWidth + 8, y + 8, { width: 174, align: "right" });
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(INK)
        .text("Authorised Signatory", left + declWidth + 8, y + footerHeight - 18, { width: 174, align: "right" });
      y += footerHeight;

      doc
        .font("Helvetica")
        .fontSize(7)
        .fillColor(MUTED)
        .text(
          `Subject to jurisdiction of ${data.seller.stateName || "the supplier's state"}. Invoice ${data.invoice.number} generated on ${formatDate(new Date())}.`,
          left,
          y + 8,
          { width, align: "center" }
        );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
