import { prisma, withRetry } from "../../core/prisma.js";
import { notFound } from "../../core/errors.js";
import { generateReportCardPdf, type ReportCardData, type TermCell } from "./report-card-pdf.js";

// Helper to determine next class
function getNextClass(className: string): string {
  const name = className.toUpperCase().trim();
  if (name === "NURSERY") return "Class LKG";
  if (name === "LKG") return "Class UKG";
  if (name === "UKG") return "Class 1";

  const num = parseInt(name, 10);
  if (!isNaN(num)) {
    if (num === 12) return "Graduated";
    return `Class ${num + 1}`;
  }
  return "Next Class";
}

// Display labels for exam terms (must match the labels used in the exams UI).
const TERM_LABELS: Record<string, string> = {
  CLASS_TEST: "Class Test",
  MID_TERM: "Mid-Term",
  FINAL: "Final",
  TERM_1: "Term 1",
  TERM_2: "Term 2"
};

// Resolve an exam result to a display term key, or null to exclude it.
// Unit tests are always excluded.
function resolveTermKey(examTerm: string | null | undefined, examName: string | undefined): string | null {
  const term = (examTerm || "").toUpperCase();
  if (term === "UNIT_TEST") return null;
  if (term in TERM_LABELS) return term;

  // No linked exam term — infer from the assessment/exam name.
  const name = (examName || "").toUpperCase();
  if (name.includes("UNIT TEST") || /\bUT\s?\d?\b/.test(name)) return null;
  if (name.includes("CLASS TEST")) return "CLASS_TEST";
  if (name.includes("MID")) return "MID_TERM";
  if (name.includes("FINAL") || name.includes("ANNUAL")) return "FINAL";
  if (name.includes("TERM 1") || name.includes("TERM1")) return "TERM_1";
  if (name.includes("TERM 2") || name.includes("TERM2")) return "TERM_2";
  return null;
}

// Grade calculation helper based on the CBSE scale shown on the card.
function gradeForPercentage(percent: number): string {
  if (percent >= 91) return "A1";
  if (percent >= 81) return "A2";
  if (percent >= 71) return "B1";
  if (percent >= 61) return "B2";
  if (percent >= 51) return "C1";
  if (percent >= 41) return "C2";
  if (percent >= 33) return "D";
  return "E";
}

export async function getStudentReportCardPdf(user: Express.UserContext, studentId: string): Promise<Buffer> {
  return withRetry(async () => {
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId: user.schoolId },
      include: { class: true, school: true }
    });

    if (!student) throw notFound("Student");

    const subjects = await prisma.subject.findMany({
      where: { schoolId: user.schoolId, classId: student.classId }
    });

    const examResults = await prisma.examResult.findMany({
      where: { schoolId: user.schoolId, studentId: student.id },
      include: { exam: true }
    });

    // Determine which term columns to show: every non-unit-test term the
    // student actually has results in, ordered by earliest exam date.
    const termEarliest = new Map<string, number>();
    examResults.forEach((res) => {
      const key = resolveTermKey(res.exam?.term, res.exam?.name || res.assessmentName);
      if (!key) return;
      const when = (res.exam?.examDate ?? res.examDate)?.getTime() ?? 0;
      const prev = termEarliest.get(key);
      if (prev === undefined || when < prev) termEarliest.set(key, when);
    });
    const terms = Array.from(termEarliest.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([key]) => ({ key, label: TERM_LABELS[key] ?? key }));

    // Build per-subject marks keyed by term. Multiple exams in the same
    // term+subject are aggregated (summed), which keeps the max-marks
    // weighting consistent.
    type SubjectRow = { subjectName: string; marks: Record<string, TermCell | null> };
    const subjectMap = new Map<string, SubjectRow>();

    const emptyMarks = (): Record<string, TermCell | null> => {
      const m: Record<string, TermCell | null> = {};
      terms.forEach((t) => { m[t.key] = null; });
      return m;
    };

    subjects.forEach((sub) => {
      subjectMap.set(sub.name.toLowerCase(), { subjectName: sub.name, marks: emptyMarks() });
    });

    examResults.forEach((res) => {
      const termKey = resolveTermKey(res.exam?.term, res.exam?.name || res.assessmentName);
      if (!termKey) return;

      const subName = res.subject || "General";
      const key = subName.toLowerCase();
      if (!subjectMap.has(key)) {
        subjectMap.set(key, { subjectName: subName, marks: emptyMarks() });
      }

      const row = subjectMap.get(key)!;
      const obtained = res.isAbsent ? 0 : Number(res.marksObtained);
      const max = Number(res.maxMarks);
      const existing = row.marks[termKey];
      if (existing) {
        row.marks[termKey] = {
          obtained: existing.obtained + obtained,
          max: existing.max + max,
          isAbsent: existing.isAbsent && res.isAbsent
        };
      } else {
        row.marks[termKey] = { obtained, max, isAbsent: res.isAbsent };
      }
    });

    // Compute per-subject finals: % = total obtained / total max (max-marks weighted).
    const subjectResults = Array.from(subjectMap.values()).map((sub) => {
      let obt = 0;
      let max = 0;
      terms.forEach((t) => {
        const cell = sub.marks[t.key];
        if (cell) { obt += cell.obtained; max += cell.max; }
      });
      const hasMarks = max > 0;
      const finalPercentage = hasMarks ? (obt / max) * 100 : 0;
      const finalGrade = hasMarks ? gradeForPercentage(finalPercentage) : "-";
      const finalResult: "PASS" | "FAIL" | "N/A" = hasMarks ? (finalPercentage >= 33 ? "PASS" : "FAIL") : "N/A";
      return { subjectName: sub.subjectName, marks: sub.marks, finalPercentage, finalGrade, finalResult };
    });

    // Overall summary, also max-marks weighted.
    let totalMarksObtained = 0;
    let totalMaxMarks = 0;
    let passesAllSubjects = true;
    subjectResults.forEach((sub) => {
      terms.forEach((t) => {
        const cell = sub.marks[t.key];
        if (cell) { totalMarksObtained += cell.obtained; totalMaxMarks += cell.max; }
      });
      if (sub.finalResult === "FAIL") passesAllSubjects = false;
    });

    const finalPercentage = totalMaxMarks > 0 ? (totalMarksObtained / totalMaxMarks) * 100 : 0;
    const finalGrade = totalMaxMarks > 0 ? gradeForPercentage(finalPercentage) : "-";
    const result: "PASS" | "FAIL" = passesAllSubjects && finalPercentage >= 33 ? "PASS" : "FAIL";

    const reportCardData: ReportCardData = {
      student: {
        fullName: student.fullName,
        admissionNumber: student.admissionNumber,
        rollNumber: student.rollNumber,
        dateOfBirth: student.dateOfBirth,
        fatherName: student.fatherName,
        motherName: student.motherName
      },
      classRecord: {
        name: student.class.name,
        section: student.class.section,
        academicYear: student.class.academicYear,
        classTeacherName: null
      },
      school: {
        name: student.school.name,
        city: student.school.city,
        state: student.school.state,
        phone: student.school.phone,
        affiliationBoard: student.school.affiliationBoard,
        logoUrl: student.school.logoUrl
      },
      terms,
      subjectResults,
      summary: {
        finalPercentage,
        finalGrade,
        totalMarksObtained,
        totalMaxMarks,
        result,
        promotedToClass: getNextClass(student.class.name)
      },
      issuedAt: new Date()
    };

    return generateReportCardPdf(reportCardData);
  }, { label: "getStudentReportCardPdf" });
}
