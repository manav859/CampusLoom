import PDFDocument from "pdfkit";

type ReceiptData = {
  receiptNo: string;
  issuedAt: Date;
  school: {
    name: string;
    city?: string | null;
    state?: string | null;
    phone?: string | null;
    gstin?: string | null;
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

type Row = [string, string];

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

function paymentReferenceRows(payment: ReceiptData["payment"]): Row[] {
  const rows: Row[] = [];
  if (payment.upiTransactionId) rows.push(["UPI Transaction ID", payment.upiTransactionId]);
  if (payment.chequeNumber) rows.push(["Cheque Number", payment.chequeNumber]);
  if (payment.ddNumber) rows.push(["DD Number", payment.ddNumber]);
  if (payment.gatewayTransactionId) rows.push(["Gateway Transaction ID", payment.gatewayTransactionId]);
  if (payment.bankReference) rows.push(["Bank Reference", payment.bankReference]);
  return rows;
}

function schoolInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "SS";
}

function schoolMetaRows(school: ReceiptData["school"]) {
  return [
    [school.city, school.state].filter(Boolean).join(", "),
    school.phone ? `Phone: ${school.phone}` : "",
    school.affiliationBoard ? `Board: ${school.affiliationBoard}` : "",
    school.udiseNumber ? `U-DISE: ${school.udiseNumber}` : "",
    school.gstin ? `GSTIN: ${school.gstin}` : ""
  ].filter(Boolean);
}

function imageBufferFromDataUrl(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^data:image\/(?:png|jpe?g);base64,(.+)$/i);
  if (!match) return null;
  return Buffer.from(match[1], "base64");
}

function fitFontSize(doc: PDFKit.PDFDocument, text: string, width: number, maxHeight: number, startSize: number, minSize: number) {
  for (let size = startSize; size >= minSize; size -= 1) {
    doc.font("Helvetica-Bold").fontSize(size);
    if (doc.heightOfString(text, { width }) <= maxHeight) return size;
  }
  return minSize;
}

function ensureSpace(doc: PDFKit.PDFDocument, y: number, needed: number, margin: number) {
  if (y + needed <= doc.page.height - margin) return y;
  doc.addPage();
  return margin;
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, x: number, y: number, width: number) {
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#6e6e73").text(title, x, y, {
    width,
    characterSpacing: 0.4
  });
  doc.rect(x, y + 15, width, 1).fill("#e5e5ea");
  return y + 27;
}

function drawRows(doc: PDFKit.PDFDocument, rows: Row[], x: number, y: number, width: number) {
  const labelWidth = 135;
  const gap = 18;
  const valueX = x + labelWidth + gap;
  const valueWidth = width - labelWidth - gap;

  for (const [label, rawValue] of rows) {
    const value = rawValue || "-";
    doc.font("Helvetica").fontSize(9);
    const labelHeight = doc.heightOfString(label, { width: labelWidth });
    doc.font("Helvetica-Bold").fontSize(10);
    const valueHeight = doc.heightOfString(value, { width: valueWidth, lineGap: 2 });
    const rowHeight = Math.max(20, labelHeight, valueHeight) + 8;

    doc.font("Helvetica").fontSize(9).fillColor("#6e6e73").text(label, x, y, {
      width: labelWidth
    });
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#1d1d1f").text(value, valueX, y - 1, {
      width: valueWidth,
      lineGap: 2
    });
    y += rowHeight;
  }

  return y;
}

function drawMetric(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number, color = "#1d1d1f") {
  doc.font("Helvetica").fontSize(8.5).fillColor("#6e6e73").text(label, x, y, {
    width,
    characterSpacing: 0.2
  });
  doc.font("Helvetica-Bold").fontSize(13).fillColor(color).text(value, x, y + 15, {
    width,
    lineGap: 1
  });
}

export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const schoolName = data.school.name;
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Fee Receipt - ${data.receiptNo}`,
          Author: schoolName,
          Subject: `Fee receipt for ${data.student.fullName}`
        }
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const margin = 50;
      const pageWidth = doc.page.width - margin * 2;
      const leftMargin = margin;
      const rightMargin = leftMargin + pageWidth;

      const statusColors: Record<string, { bg: string; text: string; label: string }> = {
        PAID: { bg: "#34c759", text: "#ffffff", label: "FULLY PAID" },
        PARTIAL: { bg: "#ff9500", text: "#ffffff", label: "PARTIAL PAYMENT" },
        PENDING: { bg: "#ff3b30", text: "#ffffff", label: "PENDING" },
        OVERDUE: { bg: "#ff3b30", text: "#ffffff", label: "OVERDUE" }
      };
      const statusStyle = statusColors[data.ledger.status] ?? statusColors.PENDING;

      doc.rect(0, 0, doc.page.width, 160).fill("#1a3c4d");

      const logoBuffer = imageBufferFromDataUrl(data.school.logoUrl);
      const logoX = leftMargin;
      const logoY = 32;
      const logoSize = 58;
      doc.roundedRect(logoX, logoY, logoSize, logoSize, 10).fill("#ffffff");
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, logoX + 7, logoY + 7, { fit: [44, 44], align: "center", valign: "center" });
        } catch {
          doc.font("Helvetica-Bold").fontSize(16).fillColor("#1a3c4d").text(schoolInitials(schoolName), logoX, logoY + 20, {
            width: logoSize,
            align: "center"
          });
        }
      } else {
        doc.font("Helvetica-Bold").fontSize(16).fillColor("#1a3c4d").text(schoolInitials(schoolName), logoX, logoY + 20, {
          width: logoSize,
          align: "center"
        });
      }

      const schoolX = leftMargin + 74;
      const infoWidth = 145;
      const schoolWidth = pageWidth - 74 - infoWidth - 18;
      const schoolFont = fitFontSize(doc, schoolName.toUpperCase(), schoolWidth, 44, 17, 12);
      doc.font("Helvetica-Bold").fontSize(schoolFont).fillColor("#ffffff").text(schoolName.toUpperCase(), schoolX, 29, {
        width: schoolWidth,
        height: 46,
        lineGap: 1
      });

      doc.font("Helvetica-Bold").fontSize(9).fillColor("#d7e3e8").text("FEE PAYMENT RECEIPT", schoolX, 78, {
        width: schoolWidth
      });

      const meta = schoolMetaRows(data.school).join(" | ");
      if (meta) {
        doc.font("Helvetica").fontSize(8).fillColor("#c7d4da").text(meta, schoolX, 96, {
          width: schoolWidth,
          height: 38,
          lineGap: 2
        });
      }

      const infoX = rightMargin - infoWidth;
      doc.roundedRect(infoX, 31, infoWidth, 86, 8).fill("#ffffff");
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#6e6e73").text("RECEIPT NO", infoX + 12, 43, {
        width: infoWidth - 24
      });
      doc.font("Helvetica-Bold").fontSize(11).fillColor("#1d1d1f").text(data.receiptNo, infoX + 12, 58, {
        width: infoWidth - 24
      });
      doc.font("Helvetica").fontSize(8).fillColor("#6e6e73").text("Issued", infoX + 12, 80, {
        width: infoWidth - 24
      });
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#1d1d1f").text(formatDateTime(data.issuedAt), infoX + 12, 94, {
        width: infoWidth - 24,
        lineGap: 1
      });

      doc.roundedRect(leftMargin, 128, 150, 24, 12).fill(statusStyle.bg);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(statusStyle.text).text(statusStyle.label, leftMargin, 135, {
        width: 150,
        align: "center"
      });

      let y = 184;
      y = sectionTitle(doc, "STUDENT DETAILS", leftMargin, y, pageWidth);
      y = drawRows(doc, [
        ["Student Name", data.student.fullName],
        ["Admission No", data.student.admissionNumber],
        ["Class / Section", data.student.class],
        ["Parent / Guardian", data.student.parentName],
        ["Contact", data.student.parentPhone]
      ], leftMargin, y, pageWidth);

      y = ensureSpace(doc, y + 8, 160, margin);
      y = sectionTitle(doc, "PAYMENT DETAILS", leftMargin, y, pageWidth);

      const paymentPairs: Row[] = [
        ["Fee Structure", data.feeStructure.name],
        ["Academic Year", data.feeStructure.academicYear],
        ["Payment Mode", data.payment.mode.replace(/_/g, " ")],
        ["Collected By", data.payment.recordedByName ?? "School office"],
        ["Payment Date", formatDate(data.payment.paidAt)],
        ...paymentReferenceRows(data.payment)
      ];

      if (data.payment.notes) {
        paymentPairs.push(["Notes", data.payment.notes]);
      }

      y = drawRows(doc, paymentPairs, leftMargin, y, pageWidth);

      y = ensureSpace(doc, y + 8, 210, margin);
      const boxHeight = 126;
      doc.roundedRect(leftMargin, y, pageWidth, boxHeight, 8).fill("#f5f5f7");
      const boxPad = 20;
      const metricGap = 22;
      const metricWidth = (pageWidth - boxPad * 2 - metricGap) / 2;
      const col1 = leftMargin + boxPad;
      const col2 = col1 + metricWidth + metricGap;
      const balanceColor = data.ledger.pendingAmount > 0 ? "#d70015" : "#248a3d";
      drawMetric(doc, "TOTAL FEE", formatMoney(data.feeStructure.totalAmount), col1, y + 18, metricWidth);
      drawMetric(doc, "AMOUNT PAID (THIS RECEIPT)", formatMoney(data.payment.amount), col2, y + 18, metricWidth, "#248a3d");
      drawMetric(doc, "TOTAL PAID TO DATE", formatMoney(data.ledger.paidAmount), col1, y + 72, metricWidth);
      drawMetric(doc, "REMAINING BALANCE", formatMoney(data.ledger.pendingAmount), col2, y + 72, metricWidth, balanceColor);

      y += boxHeight + 20;
      doc.roundedRect(leftMargin, y, pageWidth, 50, 8).fill("#1a3c4d");
      doc.font("Helvetica").fontSize(9).fillColor("#d7e3e8").text("AMOUNT RECEIVED", leftMargin + 20, y + 10, {
        width: pageWidth - 40
      });
      doc.font("Helvetica-Bold").fontSize(18).fillColor("#ffffff").text(formatMoney(data.payment.amount), leftMargin + 20, y + 25, {
        width: pageWidth * 0.58
      });
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#d7e3e8").text(`via ${data.payment.mode.replace(/_/g, " ")}`, leftMargin + pageWidth * 0.62, y + 18, {
        width: pageWidth * 0.32,
        align: "right"
      });

      y += 78;
      y = ensureSpace(doc, y, 70, margin);
      doc.rect(leftMargin, y, pageWidth, 1).fill("#e5e5ea");
      y += 15;

      const footerMeta = schoolMetaRows(data.school).join(" | ");
      if (footerMeta) {
        doc.font("Helvetica").fontSize(8).fillColor("#6e6e73").text(footerMeta, leftMargin, y, {
          width: pageWidth,
          align: "center",
          lineGap: 1
        });
        y += doc.heightOfString(footerMeta, { width: pageWidth, lineGap: 1 }) + 6;
      }

      doc.font("Helvetica").fontSize(8).fillColor("#6e6e73").text("This is a computer-generated receipt and does not require a signature.", leftMargin, y, {
        width: pageWidth,
        align: "center"
      });
      y += 14;
      doc.font("Helvetica").fontSize(8).fillColor("#6e6e73").text(`Generated by SmartShala ERP - ${formatDateTime(new Date())}`, leftMargin, y, {
        width: pageWidth,
        align: "center"
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
