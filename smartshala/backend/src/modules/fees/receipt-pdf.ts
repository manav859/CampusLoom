import PDFDocument from "pdfkit";

type ReceiptData = {
  receiptNo: string;
  issuedAt: Date;
  schoolName: string;
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

export function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        info: {
          Title: `Fee Receipt - ${data.receiptNo}`,
          Author: data.schoolName,
          Subject: `Fee receipt for ${data.student.fullName}`
        }
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageWidth = doc.page.width - 100; // 50 margin each side
      const leftMargin = 50;

      // ─── Header Background ───
      doc.rect(0, 0, doc.page.width, 130).fill("#1a3c4d");

      // School name
      doc
        .font("Helvetica-Bold")
        .fontSize(22)
        .fillColor("#ffffff")
        .text(data.schoolName.toUpperCase(), leftMargin, 35, {
          width: pageWidth,
          align: "center"
        });

      // Subtitle
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("rgba(255,255,255,0.7)")
        .text("FEE PAYMENT RECEIPT", leftMargin, 65, {
          width: pageWidth,
          align: "center"
        });

      // Receipt number & date row
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#ffffff")
        .text(data.receiptNo, leftMargin, 95, { width: pageWidth / 2 });
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("rgba(255,255,255,0.8)")
        .text(`Issued: ${formatDateTime(data.issuedAt)}`, leftMargin, 97, {
          width: pageWidth,
          align: "right"
        });

      // ─── Status Badge ───
      let y = 150;
      const statusColors: Record<string, { bg: string; text: string; label: string }> = {
        PAID: { bg: "#34c759", text: "#ffffff", label: "FULLY PAID" },
        PARTIAL: { bg: "#ff9500", text: "#ffffff", label: "PARTIAL PAYMENT" },
        PENDING: { bg: "#ff3b30", text: "#ffffff", label: "PENDING" },
        OVERDUE: { bg: "#ff3b30", text: "#ffffff", label: "OVERDUE" }
      };
      const statusStyle = statusColors[data.ledger.status] ?? statusColors.PENDING;
      const badgeWidth = 140;
      const badgeX = leftMargin + pageWidth - badgeWidth;
      doc.roundedRect(badgeX, y, badgeWidth, 24, 12).fill(statusStyle.bg);
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(statusStyle.text)
        .text(statusStyle.label, badgeX, y + 7, {
          width: badgeWidth,
          align: "center"
        });

      // ─── Student Details Section ───
      y = 145;
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#86868b")
        .text("STUDENT DETAILS", leftMargin, y);
      y += 18;

      doc.rect(leftMargin, y, pageWidth, 1).fill("#e5e5ea");
      y += 10;

      const detailPairs = [
        ["Student Name", data.student.fullName],
        ["Admission No", data.student.admissionNumber],
        ["Class / Section", data.student.class],
        ["Parent / Guardian", data.student.parentName],
        ["Contact", data.student.parentPhone]
      ];

      for (const [label, value] of detailPairs) {
        doc.font("Helvetica").fontSize(9).fillColor("#86868b").text(label, leftMargin, y, { width: 140 });
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#1d1d1f").text(value, leftMargin + 150, y - 1);
        y += 20;
      }

      // ─── Payment Details Section ───
      y += 10;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#86868b").text("PAYMENT DETAILS", leftMargin, y);
      y += 18;
      doc.rect(leftMargin, y, pageWidth, 1).fill("#e5e5ea");
      y += 10;

      const paymentPairs = [
        ["Fee Structure", data.feeStructure.name],
        ["Academic Year", data.feeStructure.academicYear],
        ["Payment Mode", data.payment.mode],
        ["Payment Date", formatDate(data.payment.paidAt)]
      ];

      if (data.payment.notes) {
        paymentPairs.push(["Notes", data.payment.notes]);
      }

      for (const [label, value] of paymentPairs) {
        doc.font("Helvetica").fontSize(9).fillColor("#86868b").text(label, leftMargin, y, { width: 140 });
        doc.font("Helvetica-Bold").fontSize(10).fillColor("#1d1d1f").text(value, leftMargin + 150, y - 1);
        y += 20;
      }

      // ─── Amount Summary Box ───
      y += 15;
      const boxHeight = 120;
      doc.roundedRect(leftMargin, y, pageWidth, boxHeight, 8).fill("#f5f5f7");

      const col1 = leftMargin + 20;
      const col2 = leftMargin + pageWidth / 2 + 20;
      let boxY = y + 15;

      // Row 1: Total Fee & Amount Paid
      doc.font("Helvetica").fontSize(9).fillColor("#86868b").text("TOTAL FEE", col1, boxY);
      doc.font("Helvetica").fontSize(9).fillColor("#86868b").text("AMOUNT PAID (THIS RECEIPT)", col2, boxY);
      boxY += 14;
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#1d1d1f").text(formatMoney(data.feeStructure.totalAmount), col1, boxY);
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#248a3d").text(formatMoney(data.payment.amount), col2, boxY);

      // Row 2: Total Paid & Remaining Balance
      boxY += 30;
      doc.font("Helvetica").fontSize(9).fillColor("#86868b").text("TOTAL PAID TO DATE", col1, boxY);
      doc.font("Helvetica").fontSize(9).fillColor("#86868b").text("REMAINING BALANCE", col2, boxY);
      boxY += 14;
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#1d1d1f").text(formatMoney(data.ledger.paidAmount), col1, boxY);
      const balanceColor = data.ledger.pendingAmount > 0 ? "#d70015" : "#248a3d";
      doc.font("Helvetica-Bold").fontSize(14).fillColor(balanceColor).text(formatMoney(data.ledger.pendingAmount), col2, boxY);

      // ─── Highlighted Amount Paid ───
      y += boxHeight + 20;
      doc.roundedRect(leftMargin, y, pageWidth, 50, 8).fill("#1a3c4d");
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("rgba(255,255,255,0.7)")
        .text("AMOUNT RECEIVED", leftMargin + 20, y + 10);
      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .fillColor("#ffffff")
        .text(formatMoney(data.payment.amount), leftMargin + 20, y + 25);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("rgba(255,255,255,0.7)")
        .text(`via ${data.payment.mode}`, leftMargin + pageWidth - 120, y + 18, {
          width: 100,
          align: "right"
        });

      // ─── Footer ───
      y += 80;
      doc.rect(leftMargin, y, pageWidth, 1).fill("#e5e5ea");
      y += 15;

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#86868b")
        .text("This is a computer-generated receipt and does not require a signature.", leftMargin, y, {
          width: pageWidth,
          align: "center"
        });
      y += 14;
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor("#86868b")
        .text(`Generated by SmartShala ERP · ${formatDateTime(new Date())}`, leftMargin, y, {
          width: pageWidth,
          align: "center"
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
