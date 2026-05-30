import PDFDocument from "pdfkit";

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
  subjectResults: {
    subjectName: string;
    PT1?: { obtained: number; max: number; isAbsent?: boolean } | null;
    HY?: { obtained: number; max: number; isAbsent?: boolean } | null;
    PT2?: { obtained: number; max: number; isAbsent?: boolean } | null;
    AN?: { obtained: number; max: number; isAbsent?: boolean } | null;
    finalPercentage: number;
    finalGrade: string;
    finalResult: "PASS" | "FAIL" | "N/A";
  }[];
  coScholastic?: {
    workEducation?: string;
    artEducation?: string;
    healthPhysicalEdu?: string;
    discipline?: string;
  } | null;
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

// Helper to format date
function formatDate(date: Date | null | string): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(d);
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

function getGradeColor(grade: string): string {
  const g = grade.toUpperCase();
  if (g.startsWith("A")) return "#0F8A4A"; // green
  if (g.startsWith("B")) return "#1B5E20"; // lighter green
  if (g.startsWith("C")) return "#B95A00"; // orange
  if (g.startsWith("D")) return "#E65100"; // darker orange
  return "#C8242C"; // red for E or F
}

export function generateReportCardPdf(data: ReportCardData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 30,
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

      const left = 30;
      const width = doc.page.width - 60; // 535 pt printable width
      let y = 30;

      // Draw background and double page border
      doc.rect(0, 0, doc.page.width, doc.page.height).fill("#FFFFFF");
      doc.rect(left - 8, left - 8, width + 16, doc.page.height - 44).lineWidth(1).strokeColor("#2456E6").stroke();
      doc.rect(left - 5, left - 5, width + 10, doc.page.height - 50).lineWidth(0.5).strokeColor("#DCE1E8").stroke();

      // Top colored stripe (aesthetic)
      doc.rect(left - 8, left - 8, width + 16, 8).fill("#0F2557");
      doc.rect(left - 8 + (width + 16) * 0.75, left - 8, (width + 16) * 0.25, 8).fill("#E65100");

      y += 12;

      // ── HEADER SECTION ──
      // School Logo
      doc.roundedRect(left, y, 54, 54, 8).lineWidth(1).strokeColor("#DCE1E8").fillAndStroke("#F7F8FB", "#DCE1E8");
      const logoBuffer = imageBufferFromDataUrl(data.school.logoUrl);
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, left + 5, y + 5, { fit: [44, 44], align: "center", valign: "center" });
        } catch {
          // Fall back to initials
          doc.font("Helvetica-Bold").fontSize(16).fillColor("#2456E6").text(schoolInitials(data.school.name), left, y + 20, {
            width: 54,
            align: "center"
          });
        }
      } else {
        doc.font("Helvetica-Bold").fontSize(16).fillColor("#2456E6").text(schoolInitials(data.school.name), left, y + 20, {
          width: 54,
          align: "center"
        });
      }

      // School Info
      const schoolX = left + 68;
      const titleX = left + width - 180;
      const schoolWidth = titleX - schoolX - 10;

      doc.font("Helvetica-Bold").fontSize(15).fillColor("#0F1419");
      doc.text(data.school.name, schoolX, y, { width: schoolWidth });
      
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#5A6573");
      const address = [data.school.city, data.school.state].filter(Boolean).join(", ");
      doc.text(address ? address.toUpperCase() : "-", schoolX, y + 18, { width: schoolWidth });
      
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#86868B");
      doc.text(`${data.school.affiliationBoard || "CBSE"} Affiliated`, schoolX, y + 28, { width: schoolWidth });

      // Title & Session Info
      doc.font("Helvetica-Bold").fontSize(14).fillColor("#0F2557").text("REPORT CARD", titleX, y, {
        width: 180,
        align: "right",
        characterSpacing: 0.5
      });
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#5A6573").text(`Academic Session ${data.classRecord.academicYear}`, titleX, y + 18, {
        width: 180,
        align: "right"
      });
      doc.font("Helvetica").fontSize(7.5).fillColor("#86868B").text("1 Apr 2025 - 31 Mar 2026", titleX, y + 28, {
        width: 180,
        align: "right"
      });

      y += 66;

      // ── STUDENT DETAILS GRID ──
      const detailsBoxHeight = 56;
      doc.roundedRect(left, y, width, detailsBoxHeight, 6).lineWidth(1).strokeColor("#DCE1E8").fillAndStroke("#FFFFFF", "#DCE1E8");

      // Draw Grid Headers and values
      const colWidth = width / 3;
      const rowHeight = detailsBoxHeight / 2;

      // Vertical separators
      doc.moveTo(left + colWidth, y).lineTo(left + colWidth, y + detailsBoxHeight).lineWidth(0.8).strokeColor("#DCE1E8").stroke();
      doc.moveTo(left + colWidth * 2, y).lineTo(left + colWidth * 2, y + detailsBoxHeight).lineWidth(0.8).strokeColor("#DCE1E8").stroke();
      
      // Horizontal separator
      doc.moveTo(left, y + rowHeight).lineTo(left + width, y + rowHeight).lineWidth(0.8).strokeColor("#DCE1E8").stroke();

      const details = [
        ["STUDENT NAME", data.student.fullName, "CLASS & SECTION", `${data.classRecord.name} - ${data.classRecord.section}`, "SR NO.", data.student.admissionNumber],
        ["FATHER'S NAME", data.student.fatherName || "-", "MOTHER'S NAME", data.student.motherName || "-", "DATE OF BIRTH", formatDate(data.student.dateOfBirth)]
      ];

      for (let row = 0; row < 2; row++) {
        const rowY = y + row * rowHeight;
        for (let col = 0; col < 3; col++) {
          const label = details[row][col * 2];
          const val = details[row][col * 2 + 1];
          const cellX = left + col * colWidth;

          // Label
          doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#86868B");
          doc.text(label, cellX + 10, rowY + 5, { width: colWidth - 20 });
          
          // Value
          doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0F1419");
          doc.text(val, cellX + 10, rowY + 14, { width: colWidth - 20, ellipsis: true });
        }
      }

      y += detailsBoxHeight + 15;

      // ── SCHOLASTIC PERFORMANCE SECTION ──
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0F1419").text("SCHOLASTIC PERFORMANCE", left, y, { characterSpacing: 0.3 });
      y += 14;

      // Scholastic Table Dimensions
      const tableTopY = y;
      const colSubjectW = 125;
      const colTermW = 60; // MM + OBT (30 each)
      const colFinalW = 170; // % (40) + Grade (60) + Result (70)

      const subColTermW = 30;
      const subColFinalPct = 40;
      const subColFinalGrd = 60;
      const subColFinalRes = 70;

      const tableHeaderH1 = 20;
      const tableHeaderH2 = 14;
      const tableRowH = 18;

      // Draw table header row 1 background
      doc.rect(left, tableTopY, width, tableHeaderH1).fill("#F7F8FB");
      // Draw table header row 2 background
      doc.rect(left, tableTopY + tableHeaderH1, width, tableHeaderH2).fill("#FAFBFD");

      // Draw vertical column borders
      const drawVerticalLines = (currY: number, h: number) => {
        doc.lineWidth(0.8).strokeColor("#DCE1E8");
        // Left & Right boundary
        doc.rect(left, currY, width, h).stroke();
        // Inner borders
        let currentX = left + colSubjectW;
        doc.moveTo(currentX, currY).lineTo(currentX, currY + h).stroke();
        
        for (let i = 0; i < 4; i++) {
          currentX += colTermW;
          doc.moveTo(currentX, currY).lineTo(currentX, currY + h).stroke();
        }
      };

      // Draw table outer lines & headers
      drawVerticalLines(tableTopY, tableHeaderH1 + tableHeaderH2);
      
      // Horizontal border between header row 1 and 2
      doc.moveTo(left + colSubjectW, tableTopY + tableHeaderH1).lineTo(left + width, tableTopY + tableHeaderH1).lineWidth(0.8).strokeColor("#DCE1E8").stroke();

      // Table Header Row 1 text
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#0F1419");
      
      // SUBJECT (Centered vertically across both rows)
      doc.text("SUBJECT", left + 8, tableTopY + 11, { width: colSubjectW - 16, align: "left" });
      
      // Terms
      const termsConfig = [
        { name: "PT1", weight: "10%", x: left + colSubjectW },
        { name: "HY", weight: "30%", x: left + colSubjectW + colTermW },
        { name: "PT2", weight: "10%", x: left + colSubjectW + colTermW * 2 },
        { name: "AN", weight: "50%", x: left + colSubjectW + colTermW * 3 }
      ];

      termsConfig.forEach((term) => {
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#0F1419").text(term.name, term.x, tableTopY + 3, { width: colTermW, align: "center" });
        doc.font("Helvetica").fontSize(6).fillColor("#86868B").text(term.weight, term.x, tableTopY + 11, { width: colTermW, align: "center" });
      });

      // FINAL HEADER
      doc.rect(left + colSubjectW + colTermW * 4, tableTopY, colFinalW, tableHeaderH1).fill("#0F2557");
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#FFFFFF").text("FINAL", left + colSubjectW + colTermW * 4, tableTopY + 6, {
        width: colFinalW,
        align: "center",
        characterSpacing: 0.5
      });

      // Table Header Row 2 text
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#5A6573");
      for (let i = 0; i < 4; i++) {
        const termX = left + colSubjectW + i * colTermW;
        doc.text("M.M.", termX, tableTopY + tableHeaderH1 + 4, { width: subColTermW, align: "center" });
        doc.text("OBT.", termX + subColTermW, tableTopY + tableHeaderH1 + 4, { width: subColTermW, align: "center" });
        
        // vertical separator between MM & OBT
        doc.moveTo(termX + subColTermW, tableTopY + tableHeaderH1).lineTo(termX + subColTermW, tableTopY + tableHeaderH1 + tableHeaderH2).stroke();
      }

      // Final sub-headers
      const finalX = left + colSubjectW + colTermW * 4;
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#5A6573");
      doc.text("%", finalX, tableTopY + tableHeaderH1 + 4, { width: subColFinalPct, align: "center" });
      doc.text("GRADE", finalX + subColFinalPct, tableTopY + tableHeaderH1 + 4, { width: subColFinalGrd, align: "center" });
      doc.text("RESULT", finalX + subColFinalPct + subColFinalGrd, tableTopY + tableHeaderH1 + 4, { width: subColFinalRes, align: "center" });
      
      // Vertical separators for final columns
      doc.moveTo(finalX + subColFinalPct, tableTopY + tableHeaderH1).lineTo(finalX + subColFinalPct, tableTopY + tableHeaderH1 + tableHeaderH2).stroke();
      doc.moveTo(finalX + subColFinalPct + subColFinalGrd, tableTopY + tableHeaderH1).lineTo(finalX + subColFinalPct + subColFinalGrd, tableTopY + tableHeaderH1 + tableHeaderH2).stroke();

      y += tableHeaderH1 + tableHeaderH2;

      // Table Rows (Subject Results)
      const subjectsCount = data.subjectResults.length;
      
      for (let idx = 0; idx < subjectsCount; idx++) {
        const rowY = y + idx * tableRowH;
        const res = data.subjectResults[idx];

        // Alternating row background
        if (idx % 2 === 1) {
          doc.rect(left, rowY, width, tableRowH).fill("#FAFBFD");
        }

        // Cell Borders
        drawVerticalLines(rowY, tableRowH);

        // Subject Name
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0F1419");
        doc.text(res.subjectName, left + 8, rowY + 5, { width: colSubjectW - 16, align: "left", ellipsis: true });

        // Term marks columns
        const termsData = [res.PT1, res.HY, res.PT2, res.AN];
        for (let i = 0; i < 4; i++) {
          const termX = left + colSubjectW + i * colTermW;
          const markInfo = termsData[i];

          // Vertical line between MM and Obt
          doc.moveTo(termX + subColTermW, rowY).lineTo(termX + subColTermW, rowY + tableRowH).lineWidth(0.8).strokeColor("#DCE1E8").stroke();

          doc.font("Helvetica").fontSize(8).fillColor("#5A6573");
          const mmStr = markInfo ? String(markInfo.max) : "-";
          doc.text(mmStr, termX, rowY + 5, { width: subColTermW, align: "center" });

          doc.font("Helvetica-Bold").fontSize(8);
          let obtStr = "-";
          let obtColor = "#0F1419";
          if (markInfo) {
            if (markInfo.isAbsent) {
              obtStr = "AB";
              obtColor = "#86868B";
            } else {
              obtStr = String(markInfo.obtained);
            }
          }
          doc.fillColor(obtColor).text(obtStr, termX + subColTermW, rowY + 5, { width: subColTermW, align: "center" });
        }

        // Final columns
        const resFinalX = left + colSubjectW + colTermW * 4;
        
        // Vertical separators
        doc.moveTo(resFinalX + subColFinalPct, rowY).lineTo(resFinalX + subColFinalPct, rowY + tableRowH).stroke();
        doc.moveTo(resFinalX + subColFinalPct + subColFinalGrd, rowY).lineTo(resFinalX + subColFinalPct + subColFinalGrd, rowY + tableRowH).stroke();

        // Pct
        doc.font("Helvetica-Bold").fontSize(8).fillColor("#0F1419");
        const pctStr = res.finalPercentage > 0 || res.PT1 || res.HY || res.PT2 || res.AN ? `${res.finalPercentage.toFixed(1)}` : "-";
        doc.text(pctStr, resFinalX, rowY + 5, { width: subColFinalPct, align: "center" });

        // Grade Badge
        if (res.finalGrade && res.finalGrade !== "-") {
          const badgeX = resFinalX + subColFinalPct + (subColFinalGrd - 16) / 2;
          const badgeY = rowY + 2.5;
          doc.roundedRect(badgeX, badgeY, 16, 13, 3).fill(getGradeColor(res.finalGrade));
          doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#FFFFFF").text(res.finalGrade, badgeX, badgeY + 2.5, { width: 16, align: "center" });
        } else {
          doc.font("Helvetica").fontSize(8).fillColor("#86868B").text("-", resFinalX + subColFinalPct, rowY + 5, { width: subColFinalGrd, align: "center" });
        }

        // Result Badge
        if (res.finalResult && res.finalResult !== "N/A") {
          const badgeW = 34;
          const badgeX = resFinalX + subColFinalPct + subColFinalGrd + (subColFinalRes - badgeW) / 2;
          const badgeY = rowY + 3;
          const isPass = res.finalResult === "PASS";
          doc.roundedRect(badgeX, badgeY, badgeW, 12, 6).fill(isPass ? "#E1F5EA" : "#FCE3E5");
          doc.font("Helvetica-Bold").fontSize(6.5).fillColor(isPass ? "#0F8A4A" : "#C8242C").text(res.finalResult, badgeX, badgeY + 2.5, { width: badgeW, align: "center" });
        } else {
          doc.font("Helvetica").fontSize(8).fillColor("#86868B").text("-", resFinalX + subColFinalPct + subColFinalGrd, rowY + 5, { width: subColFinalRes, align: "center" });
        }
      }

      y += subjectsCount * tableRowH;

      // ── TOTAL ROW ──
      // Draw background
      doc.rect(left, y, width, tableRowH).fill("#F7F8FB");
      drawVerticalLines(y, tableRowH);

      // Label: Total
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0F1419");
      doc.text("Total", left + 8, y + 5, { width: colSubjectW - 16, align: "left" });

      // Compute sums
      const totals = {
        PT1: { mm: 0, obt: 0, has: false },
        HY: { mm: 0, obt: 0, has: false },
        PT2: { mm: 0, obt: 0, has: false },
        AN: { mm: 0, obt: 0, has: false }
      };

      data.subjectResults.forEach((res) => {
        if (res.PT1) { totals.PT1.mm += res.PT1.max; totals.PT1.obt += res.PT1.obtained; totals.PT1.has = true; }
        if (res.HY) { totals.HY.mm += res.HY.max; totals.HY.obt += res.HY.obtained; totals.HY.has = true; }
        if (res.PT2) { totals.PT2.mm += res.PT2.max; totals.PT2.obt += res.PT2.obtained; totals.PT2.has = true; }
        if (res.AN) { totals.AN.mm += res.AN.max; totals.AN.obt += res.AN.obtained; totals.AN.has = true; }
      });

      const sumsData = [totals.PT1, totals.HY, totals.PT2, totals.AN];
      for (let i = 0; i < 4; i++) {
        const termX = left + colSubjectW + i * colTermW;
        const sumInfo = sumsData[i];

        // Vertical line
        doc.moveTo(termX + subColTermW, y).lineTo(termX + subColTermW, y + tableRowH).lineWidth(0.8).strokeColor("#DCE1E8").stroke();

        doc.font("Helvetica-Bold").fontSize(8).fillColor("#5A6573");
        doc.text(sumInfo.has ? String(sumInfo.mm) : "0", termX, y + 5, { width: subColTermW, align: "center" });
        doc.text(sumInfo.has ? String(sumInfo.obt) : "0", termX + subColTermW, y + 5, { width: subColTermW, align: "center" });
      }

      // Final columns totals
      const totalFinalX = left + colSubjectW + colTermW * 4;
      doc.moveTo(totalFinalX + subColFinalPct, y).lineTo(totalFinalX + subColFinalPct, y + tableRowH).stroke();
      doc.moveTo(totalFinalX + subColFinalPct + subColFinalGrd, y).lineTo(totalFinalX + subColFinalPct + subColFinalGrd, y + tableRowH).stroke();

      // Final Percentage
      doc.font("Helvetica-Bold").fontSize(8).fillColor("#0F1419");
      doc.text(data.summary.finalPercentage.toFixed(1), totalFinalX, y + 5, { width: subColFinalPct, align: "center" });

      // Final Grade badge
      const badgeX = totalFinalX + subColFinalPct + (subColFinalGrd - 16) / 2;
      const badgeY = y + 2.5;
      doc.roundedRect(badgeX, badgeY, 16, 13, 3).fill(getGradeColor(data.summary.finalGrade));
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#FFFFFF").text(data.summary.finalGrade, badgeX, badgeY + 2.5, { width: 16, align: "center" });

      // Final Result badge
      const badgeW = 34;
      const badgeX_res = totalFinalX + subColFinalPct + subColFinalGrd + (subColFinalRes - badgeW) / 2;
      const badgeY_res = y + 3;
      const isPass = data.summary.result === "PASS";
      doc.roundedRect(badgeX_res, badgeY_res, badgeW, 12, 6).fill(isPass ? "#E1F5EA" : "#FCE3E5");
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor(isPass ? "#0F8A4A" : "#C8242C").text(data.summary.result, badgeX_res, badgeY_res + 2.5, { width: badgeW, align: "center" });

      y += tableRowH + 12;

      // ── CO-SCHOLASTIC AREAS SECTION ──
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0F1419").text("CO-SCHOLASTIC AREAS", left, y, { characterSpacing: 0.3 });
      y += 14;

      const coScholasticHeaderH = 18;
      const coScholasticRowH = 20;
      const coSchSubjectW = 295; // Same as colSubjectW + colTermW + some padding (width - colTermW*4)
      // W = width - 240 = 535 - 240 = 295 pt.
      
      // Header background
      doc.rect(left, y, width, coScholasticHeaderH).fill("#F7F8FB");
      
      const drawCoScholasticBorders = (currY: number, h: number) => {
        doc.lineWidth(0.8).strokeColor("#DCE1E8");
        doc.rect(left, currY, width, h).stroke();
        let currentX = left + coSchSubjectW;
        doc.moveTo(currentX, currY).lineTo(currentX, currY + h).stroke();
        for (let i = 0; i < 4; i++) {
          currentX += colTermW;
          doc.moveTo(currentX, currY).lineTo(currentX, currY + h).stroke();
        }
      };

      drawCoScholasticBorders(y, coScholasticHeaderH);
      
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#0F1419");
      doc.text("AREA", left + 8, y + 5, { width: coSchSubjectW - 16, align: "left" });
      
      termsConfig.forEach((term, idx) => {
        doc.text(term.name, left + coSchSubjectW + idx * colTermW, y + 5, { width: colTermW, align: "center" });
      });

      y += coScholasticHeaderH;

      const coSchData = [
        { area: "Work Education", desc: "Practical skills, classroom upkeep, projects", PT1: data.coScholastic?.workEducation ?? "-", HY: data.coScholastic?.workEducation ?? "-", PT2: data.coScholastic?.workEducation ?? "-", AN: data.coScholastic?.workEducation ?? "-" },
        { area: "Art Education", desc: "Visual / performing arts engagement", PT1: data.coScholastic?.artEducation ?? "-", HY: data.coScholastic?.artEducation ?? "-", PT2: data.coScholastic?.artEducation ?? "-", AN: data.coScholastic?.artEducation ?? "-" },
        { area: "Health & Physical Edu.", desc: "Sports, yoga, fitness & games participation", PT1: data.coScholastic?.healthPhysicalEdu ?? "-", HY: data.coScholastic?.healthPhysicalEdu ?? "-", PT2: data.coScholastic?.healthPhysicalEdu ?? "-", AN: data.coScholastic?.healthPhysicalEdu ?? "-" },
        { area: "Discipline", desc: "Punctuality, conduct, regularity", PT1: data.coScholastic?.discipline ?? "-", HY: data.coScholastic?.discipline ?? "-", PT2: data.coScholastic?.discipline ?? "-", AN: data.coScholastic?.discipline ?? "-" }
      ];

      coSchData.forEach((row, idx) => {
        const rowY = y + idx * coScholasticRowH;
        
        if (idx % 2 === 1) {
          doc.rect(left, rowY, width, coScholasticRowH).fill("#FAFBFD");
        }

        drawCoScholasticBorders(rowY, coScholasticRowH);

        doc.font("Helvetica-Bold").fontSize(8).fillColor("#0F1419");
        doc.text(row.area, left + 8, rowY + 3, { width: coSchSubjectW - 16, align: "left" });
        doc.font("Helvetica").fontSize(6.5).fillColor("#86868B");
        doc.text(row.desc, left + 8, rowY + 11, { width: coSchSubjectW - 16, align: "left" });

        const values = [row.PT1, row.HY, row.PT2, row.AN];
        doc.font("Helvetica").fontSize(8).fillColor("#5A6573");
        for (let i = 0; i < 4; i++) {
          doc.text(values[i], left + coSchSubjectW + i * colTermW, rowY + 6, { width: colTermW, align: "center" });
        }
      });

      y += coSchData.length * coScholasticRowH + 12;

      // ── KPI SUMMARY CARDS ──
      const kpiCardH = 46;
      const kpiCardW = (width - 16) / 5; // 5 cards

      const cardsConfig = [
        { label: "FINAL PERCENTAGE", val: `${data.summary.finalPercentage.toFixed(1)}%`, valColor: "#0F1419" },
        { label: "FINAL GRADE", val: data.summary.finalGrade, valColor: getGradeColor(data.summary.finalGrade), isBadge: true },
        { label: "TOTAL MARKS", val: `${data.summary.totalMarksObtained} / ${data.summary.totalMaxMarks}`, valColor: "#0F1419" },
        { label: "RESULT", val: data.summary.result, valColor: isPass ? "#0F8A4A" : "#C8242C" },
        { label: "PROMOTED TO", val: data.summary.promotedToClass, valColor: "#0F2557" }
      ];

      cardsConfig.forEach((card, idx) => {
        const cardX = left + idx * (kpiCardW + 4);
        doc.roundedRect(cardX, y, kpiCardW, kpiCardH, 4).lineWidth(1).strokeColor("#BEE7CB").fillAndStroke("#EAF9EB", "#BEE7CB");

        doc.font("Helvetica-Bold").fontSize(5.5).fillColor("#0F8A4A");
        doc.text(card.label, cardX + 6, y + 6, { width: kpiCardW - 12, align: "center" });

        if (card.isBadge) {
          const badgeX = cardX + (kpiCardW - 18) / 2;
          const badgeY = y + 18;
          doc.roundedRect(badgeX, badgeY, 18, 16, 4).fill(card.valColor);
          doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF").text(card.val, badgeX, badgeY + 3.5, { width: 18, align: "center" });
        } else {
          doc.font("Helvetica-Bold").fontSize(IdxToSize(idx, card.val)).fillColor(card.valColor).text(card.val, cardX + 4, y + 18, {
            width: kpiCardW - 8,
            align: "center"
          });
        }
      });

      function IdxToSize(index: number, val: string) {
        if (index === 0) return 14;
        if (index === 2) return val.length > 9 ? 9.5 : 12;
        if (index === 4) return val.length > 10 ? 9.5 : 11;
        return 13;
      }

      y += kpiCardH + 12;

      // ── GRADING SCALE AND INSTRUCTIONS ──
      const legendBoxH = 34;
      const colLegendW = width / 2;

      doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.8).strokeColor("#DCE1E8").stroke();
      y += 6;

      // Left Column: Scholastic scale
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#86868B");
      doc.text("GRADE SCALE (SCHOLASTIC)", left, y, { width: colLegendW - 10 });
      doc.font("Courier-Bold").fontSize(6).fillColor("#5A6573");
      doc.text("A1 91-100   A2 81-90   B1 71-80   B2 61-70\nC1 51-60   C2 41-50   D 33-40    E 0-32", left, y + 10, { width: colLegendW - 10, lineGap: 1.5 });

      // Right Column: Co-scholastic scale
      doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#86868B");
      doc.text("CO-SCHOLASTIC GRADES", left + colLegendW, y, { width: colLegendW });
      doc.font("Helvetica").fontSize(6).fillColor("#5A6573");
      doc.text("A Outstanding     B Very Good     C Satisfactory", left + colLegendW, y + 10, { width: colLegendW });
      doc.font("Helvetica-Oblique").fontSize(6.2).fillColor("#86868B");
      doc.text("Pass criteria: >= 33% in the AN exam of every subject. AB = absent.\nAggregate is the weighted average across all terms.", left + colLegendW, y + 18, { width: colLegendW, lineGap: 1 });

      y += legendBoxH + 10;

      // ── SIGNATURE SECTION ──
      const sigLineY = doc.page.height - 70;
      const sigW = 100;
      const sigCols = [
        { label: "Class Teacher", x: left + (width / 8) - sigW / 2 },
        { label: "Examination In-Charge", x: left + (width * 3 / 8) - sigW / 2 },
        { label: "Principal", x: left + (width * 5 / 8) - sigW / 2 },
        { label: "Parent's Signature", x: left + (width * 7 / 8) - sigW / 2 }
      ];

      doc.lineWidth(0.8).strokeColor("#86868B");
      sigCols.forEach((col) => {
        // Line
        doc.moveTo(col.x, sigLineY).lineTo(col.x + sigW, sigLineY).stroke();
        // Label
        doc.font("Helvetica").fontSize(7.5).fillColor("#5A6573").text(col.label, col.x - 20, sigLineY + 6, {
          width: sigW + 40,
          align: "center"
        });
      });

      // Bottom footer text
      const footerY = doc.page.height - 24;
      doc.font("Helvetica").fontSize(7).fillColor("#86868B").text(`Issued on ${formatDate(data.issuedAt)}  ·  Generated by SmartShala ERP`, left, footerY, {
        width: width,
        align: "center"
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
