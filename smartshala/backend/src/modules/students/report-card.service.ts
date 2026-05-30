import { prisma, withRetry } from "../../core/prisma.js";
import { notFound } from "../../core/errors.js";
import { generateReportCardPdf, type ReportCardData } from "./report-card-pdf.js";

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

// Helpers to match exam to category
function getExamCategory(examName: string, term: string): "PT1" | "HY" | "PT2" | "AN" | null {
  const name = examName.toUpperCase();
  const termStr = term.toUpperCase();
  
  if (name.includes("PT1") || name.includes("PT 1") || name.includes("PERIODIC TEST 1") || name.includes("UNIT TEST 1") || name.includes("UT1") || name.includes("UT 1")) {
    return "PT1";
  }
  if (name.includes("PT2") || name.includes("PT 2") || name.includes("PERIODIC TEST 2") || name.includes("UNIT TEST 2") || name.includes("UT2") || name.includes("UT 2")) {
    return "PT2";
  }
  if (name.includes("HY") || name.includes("HALF YEARLY") || name.includes("MID TERM") || name.includes("MID-TERM") || termStr === "MID_TERM" || termStr === "TERM_1") {
    return "HY";
  }
  if (name.includes("AN") || name.includes("ANNUAL") || name.includes("FINAL") || name.includes("YEARLY") || termStr === "FINAL" || termStr === "TERM_2") {
    return "AN";
  }
  
  // Default fallbacks based on term if name didn't match
  if (termStr === "UNIT_TEST" || termStr === "CLASS_TEST") {
    return "PT1"; 
  }
  if (termStr === "MID_TERM" || termStr === "TERM_1") {
    return "HY";
  }
  if (termStr === "FINAL" || termStr === "TERM_2") {
    return "AN";
  }
  
  return null;
}

// Grade calculation helper based on the CBSE scale in the reference image
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
    // 1. Fetch student detail
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        schoolId: user.schoolId
      },
      include: {
        class: true,
        school: true
      }
    });

    if (!student) throw notFound("Student");

    // 2. Fetch all subjects for the class
    const subjects = await prisma.subject.findMany({
      where: {
        schoolId: user.schoolId,
        classId: student.classId
      }
    });

    // 3. Fetch student's exam results
    const examResults = await prisma.examResult.findMany({
      where: {
        schoolId: user.schoolId,
        studentId: student.id
      },
      include: {
        exam: true
      }
    });

    // Group exams and results by subject & category
    const subjectMap = new Map<string, {
      subjectName: string;
      PT1?: { obtained: number; max: number; isAbsent?: boolean } | null;
      HY?: { obtained: number; max: number; isAbsent?: boolean } | null;
      PT2?: { obtained: number; max: number; isAbsent?: boolean } | null;
      AN?: { obtained: number; max: number; isAbsent?: boolean } | null;
    }>();

    // Initialize map with all class subjects
    subjects.forEach((sub) => {
      subjectMap.set(sub.name.toLowerCase(), {
        subjectName: sub.name,
        PT1: null,
        HY: null,
        PT2: null,
        AN: null
      });
    });

    // Process exam results and map them to categories
    examResults.forEach((res) => {
      const subName = res.subject || "General";
      const key = subName.toLowerCase();
      
      const examNameStr = res.exam?.name || res.assessmentName || "";
      const examTermStr = res.exam?.term || "UNIT_TEST";
      
      const category = getExamCategory(examNameStr, examTermStr);
      if (!category) return;

      if (!subjectMap.has(key)) {
        subjectMap.set(key, {
          subjectName: subName,
          PT1: null,
          HY: null,
          PT2: null,
          AN: null
        });
      }

      const item = subjectMap.get(key)!;
      item[category] = {
        obtained: Number(res.marksObtained),
        max: Number(res.maxMarks),
        isAbsent: res.isAbsent
      };
    });

    // Compile scholastic data and calculate percentages/grades/results
    const subjectResultsList = Array.from(subjectMap.values()).map((sub) => {
      // Calculate weighted percentage
      let weightedSum = 0;
      let totalWeight = 0;

      const terms = [
        { data: sub.PT1, weight: 10 },
        { data: sub.HY, weight: 30 },
        { data: sub.PT2, weight: 10 },
        { data: sub.AN, weight: 50 }
      ];

      terms.forEach((term) => {
        if (term.data && term.data.max > 0) {
          const pct = term.data.isAbsent ? 0 : (term.data.obtained / term.data.max) * 100;
          weightedSum += pct * (term.weight / 100);
          totalWeight += term.weight;
        }
      });

      // If no exams conducted at all, default percentage to 0
      const finalPercentage = totalWeight > 0 ? (weightedSum * (100 / totalWeight)) : 0;
      const finalGrade = totalWeight > 0 ? gradeForPercentage(finalPercentage) : "-";

      // Pass criteria: >= 33% in AN exam, or if AN is missing, fallback to finalPercentage >= 33
      let finalResult: "PASS" | "FAIL" | "N/A" = "N/A";
      if (sub.AN && sub.AN.max > 0) {
        if (sub.AN.isAbsent) {
          finalResult = "FAIL";
        } else {
          const anPct = (sub.AN.obtained / sub.AN.max) * 100;
          finalResult = anPct >= 33 ? "PASS" : "FAIL";
        }
      } else if (totalWeight > 0) {
        finalResult = finalPercentage >= 33 ? "PASS" : "FAIL";
      }

      return {
        ...sub,
        finalPercentage,
        finalGrade,
        finalResult
      };
    });

    // Summary calculations
    let overallWeightedPct = 0;
    let validSubjectsCount = 0;
    let totalMarksObtained = 0;
    let totalMaxMarks = 0;
    let passesAllSubjects = true;

    subjectResultsList.forEach((sub) => {
      overallWeightedPct += sub.finalPercentage;
      validSubjectsCount++;

      // Sum all obtained and max marks across all terms for total marks
      const terms = [sub.PT1, sub.HY, sub.PT2, sub.AN];
      terms.forEach((t) => {
        if (t) {
          totalMarksObtained += t.isAbsent ? 0 : t.obtained;
          totalMaxMarks += t.max;
        }
      });

      if (sub.finalResult === "FAIL") {
        passesAllSubjects = false;
      }
    });

    const finalPercentage = validSubjectsCount > 0 ? (overallWeightedPct / validSubjectsCount) : 0;
    const finalGrade = validSubjectsCount > 0 ? gradeForPercentage(finalPercentage) : "-";
    const result = passesAllSubjects && finalPercentage >= 33 ? "PASS" : "FAIL";

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
      subjectResults: subjectResultsList,
      coScholastic: {
        workEducation: "--",
        artEducation: "--",
        healthPhysicalEdu: "--",
        discipline: "--"
      },
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
