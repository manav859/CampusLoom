import PDFDocument from "pdfkit";

export type TermCell = { obtained: number; max: number; isAbsent?: boolean };

export type ReportCardData = {
  student: {
    fullName: string;
    admissionNumber: string;
    rollNumber: number | null;
    dateOfBirth: Date | null;
    fatherName: string | null;
    motherName: string | null;
  };
  classRecord: {
    name: string;
    section: string;
    academicYear: string;
    classTeacherName?: string | null;
  };
  school: {
    name: string;
    city?: string | null;
    state?: string | null;
    phone?: string | null;
    affiliationBoard?: string | null;
    logoUrl?: string | null;
  };
  // Dynamic exam columns, already ordered for display.
  terms: { key: string; label: string }[];
  subjectResults: {
    subjectName: string;
    // Keyed by term key; null/absent when the subject has no marks for that term.
    marks: Record<string, TermCell | null>;
    finalPercentage: number;
    finalGrade: string;
    finalResult: "PASS" | "FAIL" | "N/A";
  }[];
  summary: {
    finalPercentage: number;
    finalGrade: string;
    totalMarksObtained: number;
    totalMaxMarks: number;
    result: "PASS" | "FAIL";
    promotedToClass: string;
  };
  issuedAt: Date;
};

// ── Palette (intentionally minimal / grayscale) ──
const INK = "#1A1A1A"; // primary text
const MUTED = "#6B7280"; // labels / secondary
const FAINT = "#9AA1AC"; // dashes / disabled
const LINE = "#D0D5DD"; // borders
const HEADER_BG = "#F2F4F7"; // table header fill
const PASS = "#1A7F37";
const FAIL = "#B42318";

function formatDate(date: Date | null | string): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

function sessionRange(academicYear: string): string {
  const match = academicYear.match(/(\d{4})/);
  if (!match) return academicYear;
  const start = Number(match[1]);
  return `1 Apr ${start} – 31 Mar ${start + 1}`;
}

function imageBufferFromDataUrl(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^data:image\/(?:png|jpe?g);base64,(.+)$/i);
  if (!match) return null;
  return Buffer.from(match[1], "base64");
}

function schoolInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "SS";
}

function resultColor(result: string): string {
  if (result === "PASS") return PASS;
  if (result === "FAIL") return FAIL;
  return FAINT;
}

export function generateReportCardPdf(data: ReportCardData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: {
          Title: `Report Card - ${data.student.fullName}`,
          Author: data.school.name,
          Subject: `Report card of ${data.student.fullName} for session ${data.classRecord.academicYear}`
        }
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = 40;
      const width = doc.page.width - 80; // printable width
      const right = left + width;
      let y = 44;

      // Subtle document frame
      doc.rect(left - 10, left - 10, width + 20, doc.page.height - 60).lineWidth(0.75).strokeColor(LINE).stroke();

      // ── HEADER ──
      doc.roundedRect(left, y, 50, 50, 6).lineWidth(0.75).strokeColor(LINE).fillAndStroke("#FFFFFF", LINE);
      const logoBuffer = imageBufferFromDataUrl(data.school.logoUrl);
      let logoDrawn = false;
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, left + 4, y + 4, { fit: [42, 42], align: "center", valign: "center" });
          logoDrawn = true;
        } catch {
          logoDrawn = false;
        }
      }
      if (!logoDrawn) {
        doc.font("Helvetica-Bold").fontSize(16).fillColor(INK).text(schoolInitials(data.school.name), left, y + 17, { width: 50, align: "center" });
      }

      const schoolX = left + 64;
      const titleW = 150;
      const titleX = right - titleW;
      const schoolW = titleX - schoolX - 12;

      doc.font("Helvetica-Bold").fontSize(15).fillColor(INK).text(data.school.name, schoolX, y, { width: schoolW });
      const address = [data.school.city, data.school.state].filter(Boolean).join(", ");
      doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(address ? address.toUpperCase() : "-", schoolX, y + 19, { width: schoolW });
      doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(`${data.school.affiliationBoard || "CBSE"} Affiliated`, schoolX, y + 30, { width: schoolW });

      doc.font("Helvetica-Bold").fontSize(13).fillColor(INK).text("REPORT CARD", titleX, y + 1, { width: titleW, align: "right", characterSpacing: 0.5 });
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(MUTED).text(`Academic Session ${data.classRecord.academicYear}`, titleX, y + 19, { width: titleW, align: "right" });
      doc.font("Helvetica").fontSize(7.5).fillColor(FAINT).text(sessionRange(data.classRecord.academicYear), titleX, y + 30, { width: titleW, align: "right" });

      y += 62;
      doc.moveTo(left, y).lineTo(right, y).lineWidth(0.75).strokeColor(LINE).stroke();
      y += 14;

      // ── STUDENT DETAILS GRID ──
      const detailsH = 54;
      const colW = width / 3;
      const rowH = detailsH / 2;

      doc.roundedRect(left, y, width, detailsH, 4).lineWidth(0.75).strokeColor(LINE).stroke();
      doc.moveTo(left + colW, y).lineTo(left + colW, y + detailsH).lineWidth(0.6).strokeColor(LINE).stroke();
      doc.moveTo(left + colW * 2, y).lineTo(left + colW * 2, y + detailsH).stroke();
      doc.moveTo(left, y + rowH).lineTo(right, y + rowH).stroke();

      const details = [
        ["STUDENT NAME", data.student.fullName, "CLASS & SECTION", `${data.classRecord.name} - ${data.classRecord.section}`, "SR NO.", data.student.admissionNumber],
        ["FATHER'S NAME", data.student.fatherName || "-", "MOTHER'S NAME", data.student.motherName || "-", "DATE OF BIRTH", formatDate(data.student.dateOfBirth)]
      ];

      for (let r = 0; r < 2; r++) {
        const cellY = y + r * rowH;
        for (let c = 0; c < 3; c++) {
          const label = details[r][c * 2];
          const val = details[r][c * 2 + 1];
          const cellX = left + c * colW;
          doc.font("Helvetica").fontSize(6.5).fillColor(MUTED).text(label, cellX + 10, cellY + 6, { width: colW - 20 });
          doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text(val, cellX + 10, cellY + 15, { width: colW - 20, ellipsis: true });
        }
      }

      y += detailsH + 16;

      // ── SCHOLASTIC PERFORMANCE ──
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(INK).text("SCHOLASTIC PERFORMANCE", left, y, { characterSpacing: 0.3 });
      y += 14;

      const terms = data.terms;
      const numTerms = terms.length;

      const finalPctW = 42;
      const finalGrdW = 46;
      const finalResW = 58;
      const finalW = finalPctW + finalGrdW + finalResW;

      let colSubjectW = 118;
      const termsAreaW = width - colSubjectW - finalW;
      const termColW = numTerms > 0 ? termsAreaW / numTerms : 0;
      // When there are no exam columns, give the freed space to the subject column.
      if (numTerms === 0) colSubjectW += termsAreaW;
      const subColW = termColW / 2;

      const subjectStart = left;
      const subjectEnd = left + colSubjectW;
      const finalStart = subjectEnd + numTerms * termColW;

      const headerH1 = 18;
      const headerH2 = 13;
      const tableRowH = 17;
      const tableTop = y;

      // Header backgrounds
      doc.rect(left, tableTop, width, headerH1 + headerH2).fill(HEADER_BG);

      // Outer + primary vertical separators
      const drawColSeparators = (startY: number, h: number) => {
        doc.lineWidth(0.6).strokeColor(LINE);
        doc.moveTo(subjectEnd, startY).lineTo(subjectEnd, startY + h).stroke();
        for (let i = 1; i <= numTerms; i++) {
          const x = subjectEnd + i * termColW;
          doc.moveTo(x, startY).lineTo(x, startY + h).stroke();
        }
      };

      doc.lineWidth(0.75).strokeColor(LINE).rect(left, tableTop, width, headerH1 + headerH2).stroke();
      drawColSeparators(tableTop, headerH1 + headerH2);
      // Divider between header rows (only over the term + final area, subject cell spans both)
      doc.moveTo(subjectEnd, tableTop + headerH1).lineTo(right, tableTop + headerH1).lineWidth(0.6).strokeColor(LINE).stroke();

      // SUBJECT header (spans both header rows)
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(INK).text("SUBJECT", subjectStart + 8, tableTop + (headerH1 + headerH2) / 2 - 4, { width: colSubjectW - 16 });

      // Term headers + Max/Obt sub-headers
      terms.forEach((term, i) => {
        const tx = subjectEnd + i * termColW;
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(INK).text(term.label, tx, tableTop + 6, { width: termColW, align: "center" });
        doc.font("Helvetica").fontSize(6).fillColor(MUTED);
        doc.text("Max", tx, tableTop + headerH1 + 4, { width: subColW, align: "center" });
        doc.text("Obt", tx + subColW, tableTop + headerH1 + 4, { width: subColW, align: "center" });
        // separator between Max and Obt
        doc.moveTo(tx + subColW, tableTop + headerH1).lineTo(tx + subColW, tableTop + headerH1 + headerH2).lineWidth(0.5).strokeColor(LINE).stroke();
      });

      // FINAL header + sub-headers
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(INK).text("FINAL", finalStart, tableTop + 6, { width: finalW, align: "center" });
      doc.font("Helvetica").fontSize(6).fillColor(MUTED);
      doc.text("%", finalStart, tableTop + headerH1 + 4, { width: finalPctW, align: "center" });
      doc.text("Grade", finalStart + finalPctW, tableTop + headerH1 + 4, { width: finalGrdW, align: "center" });
      doc.text("Result", finalStart + finalPctW + finalGrdW, tableTop + headerH1 + 4, { width: finalResW, align: "center" });
      doc.moveTo(finalStart + finalPctW, tableTop + headerH1).lineTo(finalStart + finalPctW, tableTop + headerH1 + headerH2).lineWidth(0.5).strokeColor(LINE).stroke();
      doc.moveTo(finalStart + finalPctW + finalGrdW, tableTop + headerH1).lineTo(finalStart + finalPctW + finalGrdW, tableTop + headerH1 + headerH2).stroke();

      y = tableTop + headerH1 + headerH2;

      const drawSubColLines = (rowY: number, h: number) => {
        doc.lineWidth(0.5).strokeColor(LINE);
        terms.forEach((_, i) => {
          const tx = subjectEnd + i * termColW;
          doc.moveTo(tx + subColW, rowY).lineTo(tx + subColW, rowY + h).stroke();
        });
        doc.moveTo(finalStart + finalPctW, rowY).lineTo(finalStart + finalPctW, rowY + h).stroke();
        doc.moveTo(finalStart + finalPctW + finalGrdW, rowY).lineTo(finalStart + finalPctW + finalGrdW, rowY + h).stroke();
      };

      // Subject rows
      data.subjectResults.forEach((res, idx) => {
        const rowY = y + idx * tableRowH;
        if (idx % 2 === 1) doc.rect(left, rowY, width, tableRowH).fill("#FAFBFC");

        drawColSeparators(rowY, tableRowH);
        drawSubColLines(rowY, tableRowH);

        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK).text(res.subjectName, subjectStart + 8, rowY + 5, { width: colSubjectW - 16, ellipsis: true });

        terms.forEach((term, i) => {
          const tx = subjectEnd + i * termColW;
          const cell = res.marks[term.key];
          doc.font("Helvetica").fontSize(8).fillColor(cell ? MUTED : FAINT).text(cell ? String(cell.max) : "–", tx, rowY + 5, { width: subColW, align: "center" });
          let obt = "–";
          let obtColor = FAINT;
          if (cell) {
            if (cell.isAbsent) { obt = "AB"; obtColor = FAINT; }
            else { obt = String(cell.obtained); obtColor = INK; }
          }
          doc.font("Helvetica-Bold").fontSize(8).fillColor(obtColor).text(obt, tx + subColW, rowY + 5, { width: subColW, align: "center" });
        });

        const hasMarks = res.finalResult !== "N/A";
        doc.font("Helvetica-Bold").fontSize(8).fillColor(hasMarks ? INK : FAINT).text(hasMarks ? res.finalPercentage.toFixed(1) : "–", finalStart, rowY + 5, { width: finalPctW, align: "center" });
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(hasMarks ? INK : FAINT).text(hasMarks ? res.finalGrade : "–", finalStart + finalPctW, rowY + 5, { width: finalGrdW, align: "center" });
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(resultColor(res.finalResult)).text(hasMarks ? res.finalResult : "–", finalStart + finalPctW + finalGrdW, rowY + 5, { width: finalResW, align: "center" });
      });

      y += data.subjectResults.length * tableRowH;

      // ── TOTAL ROW ──
      doc.rect(left, y, width, tableRowH).fill(HEADER_BG);
      doc.lineWidth(0.75).strokeColor(LINE).rect(left, tableTop, width, y + tableRowH - tableTop).stroke();
      drawColSeparators(y, tableRowH);
      drawSubColLines(y, tableRowH);

      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK).text("Total", subjectStart + 8, y + 5, { width: colSubjectW - 16 });

      terms.forEach((term, i) => {
        let mm = 0;
        let obt = 0;
        let has = false;
        data.subjectResults.forEach((res) => {
          const cell = res.marks[term.key];
          if (cell) { mm += cell.max; obt += cell.isAbsent ? 0 : cell.obtained; has = true; }
        });
        const tx = subjectEnd + i * termColW;
        doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text(has ? String(mm) : "–", tx, y + 5, { width: subColW, align: "center" });
        doc.font("Helvetica-Bold").fontSize(8).fillColor(has ? INK : FAINT).text(has ? String(obt) : "–", tx + subColW, y + 5, { width: subColW, align: "center" });
      });

      doc.font("Helvetica-Bold").fontSize(8).fillColor(INK).text(data.summary.finalPercentage.toFixed(1), finalStart, y + 5, { width: finalPctW, align: "center" });
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor(INK).text(data.summary.finalGrade, finalStart + finalPctW, y + 5, { width: finalGrdW, align: "center" });
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(resultColor(data.summary.result)).text(data.summary.result, finalStart + finalPctW + finalGrdW, y + 5, { width: finalResW, align: "center" });

      y += tableRowH + 18;

      // ── RESULT SUMMARY STRIP ──
      const sumH = 46;
      const cards = [
        { label: "FINAL PERCENTAGE", val: `${data.summary.finalPercentage.toFixed(1)}%`, color: INK },
        { label: "FINAL GRADE", val: data.summary.finalGrade, color: INK },
        { label: "TOTAL MARKS", val: `${data.summary.totalMarksObtained} / ${data.summary.totalMaxMarks}`, color: INK },
        { label: "RESULT", val: data.summary.result, color: resultColor(data.summary.result) },
        { label: "PROMOTED TO", val: data.summary.promotedToClass, color: INK }
      ];
      const cardW = width / cards.length;
      doc.roundedRect(left, y, width, sumH, 4).lineWidth(0.75).strokeColor(LINE).stroke();
      cards.forEach((card, i) => {
        const cx = left + i * cardW;
        if (i > 0) doc.moveTo(cx, y).lineTo(cx, y + sumH).lineWidth(0.6).strokeColor(LINE).stroke();
        doc.font("Helvetica").fontSize(6).fillColor(MUTED).text(card.label, cx + 4, y + 9, { width: cardW - 8, align: "center" });
        const valSize = card.val.length > 9 ? 11 : 13;
        doc.font("Helvetica-Bold").fontSize(valSize).fillColor(card.color).text(card.val, cx + 4, y + 22, { width: cardW - 8, align: "center" });
      });

      y += sumH + 16;

      // ── GRADE SCALE + NOTES ──
      doc.moveTo(left, y).lineTo(right, y).lineWidth(0.6).strokeColor(LINE).stroke();
      y += 8;
      const halfW = width / 2;
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED).text("GRADE SCALE", left, y, { width: halfW - 10 });
      doc.font("Courier").fontSize(6.5).fillColor(MUTED).text(
        "A1 91-100   A2 81-90   B1 71-80   B2 61-70\nC1 51-60   C2 41-50   D 33-40    E 0-32",
        left, y + 11, { width: halfW - 10, lineGap: 2 }
      );
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(MUTED).text("NOTES", left + halfW, y, { width: halfW });
      doc.font("Helvetica").fontSize(6.5).fillColor(MUTED).text(
        "Final % is the marks obtained as a share of total maximum marks across all exams.\nPass: overall >= 33%. AB = absent. – = no exam recorded.",
        left + halfW, y + 11, { width: halfW, lineGap: 2 }
      );

      // ── SIGNATURES ──
      const sigY = doc.page.height - 88;
      const sigW = 100;
      const sigCols = [
        { label: "Class Teacher", cx: left + width * 0.125 },
        { label: "Examination In-Charge", cx: left + width * 0.375 },
        { label: "Principal", cx: left + width * 0.625 },
        { label: "Parent's Signature", cx: left + width * 0.875 }
      ];
      doc.lineWidth(0.6).strokeColor(MUTED);
      sigCols.forEach((col) => {
        doc.moveTo(col.cx - sigW / 2, sigY).lineTo(col.cx + sigW / 2, sigY).stroke();
        doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(col.label, col.cx - sigW / 2 - 20, sigY + 6, { width: sigW + 40, align: "center" });
      });

      const footerY = doc.page.height - 52;
      doc.font("Helvetica").fontSize(7).fillColor(FAINT).text(`Issued on ${formatDate(data.issuedAt)}  ·  Generated by SmartShala ERP`, left, footerY, { width, align: "center", lineBreak: false });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
