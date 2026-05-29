import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  AttendanceStatus,
  FeeFrequency,
  Gender,
  HomeworkSubmissionStatus,
  InstallmentStatus,
  NotificationKind,
  NotificationStatus,
  PaymentMode,
  Prisma,
  type Class,
  UserRole,
  UserStatus
} from "@prisma/client";
import { env } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import { gradeForPercentage } from "../../core/grading.js";
import { prisma } from "../../lib/prisma.js";

const CONFIRMATION = "RESET_SMARTSHALA_DEMO_DATA";
const academicYear = "2025-26";
const demoPassword = "SmartShala@123";
const subjects = ["English", "Hindi", "Mathematics", "Science", "Social Studies"];

const teacherNames = [
  "Anita Iyer",
  "Rajesh Menon",
  "Farah Qureshi",
  "Kavita Shah",
  "Nilesh Desai",
  "Pooja Nair",
  "Imran Khan",
  "Neha Kulkarni",
  "Harsh Vyas",
  "Ritu Chatterjee",
  "Vikram Rao",
  "Asha Pillai",
  "Meera Trivedi",
  "Sandeep Patel",
  "Rekha Sharma",
  "Arvind Rao",
  "Lata Menon",
  "Prakash Nair",
  "Sunita Joshi",
  "Rahul Verma",
  "Maya Kapoor",
  "Deepak Shah",
  "Sonal Mehta",
  "Irfan Ali",
  "Nandita Roy",
  "Gaurav Singh",
  "Priya Reddy",
  "Amit Chauhan",
  "Leena Thomas",
  "Sameer Khan"
];

const firstNames = [
  "Aarav",
  "Aditi",
  "Kabir",
  "Kiara",
  "Ishaan",
  "Ananya",
  "Dev",
  "Riya",
  "Vihaan",
  "Saanvi",
  "Arjun",
  "Navya",
  "Reyansh",
  "Zoya",
  "Mehul",
  "Tara",
  "Ved",
  "Nisha",
  "Rohan",
  "Prisha",
  "Mihir",
  "Avni",
  "Shaurya",
  "Ayesha",
  "Kunal",
  "Mira",
  "Yash",
  "Sara",
  "Aditya",
  "Ira",
  "Neil",
  "Tanvi"
];

const lastNames = [
  "Patel",
  "Shah",
  "Mehta",
  "Trivedi",
  "Desai",
  "Joshi",
  "Vyas",
  "Parikh",
  "Modi",
  "Bhatt",
  "Kapadia",
  "Thakkar",
  "Raval",
  "Dave",
  "Soni",
  "Choksi"
];

const parentNames = [
  "Nirav",
  "Hetal",
  "Bhavesh",
  "Minal",
  "Ketan",
  "Falguni",
  "Pranav",
  "Sonal",
  "Manish",
  "Rupal",
  "Amit",
  "Sejal",
  "Dhaval",
  "Payal",
  "Chirag",
  "Priti"
];

function pick<T>(items: readonly T[], index: number) {
  return items[index % items.length];
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function utcDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day));
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

function attendanceValue(status: AttendanceStatus) {
  if (status === AttendanceStatus.ABSENT) return new Prisma.Decimal(0);
  if (status === AttendanceStatus.HALF_DAY) return new Prisma.Decimal(0.5);
  return new Prisma.Decimal(1);
}

function feeAmountForGrade(grade: number) {
  return 24000 + grade * 2600;
}

function studentCountFor(grade: number, section: "A" | "B") {
  return 29 + ((grade + (section === "A" ? 0 : 1)) % 3);
}

function paymentMode(index: number) {
  return pick(
    [
      PaymentMode.UPI,
      PaymentMode.BANK_TRANSFER,
      PaymentMode.CASH,
      PaymentMode.CHEQUE,
      PaymentMode.DD,
      PaymentMode.ONLINE_GATEWAY
    ],
    index
  );
}

async function createManyInChunks<T>(items: T[], createMany: (chunk: T[]) => Promise<unknown>, size = 1000) {
  for (let index = 0; index < items.length; index += size) {
    await createMany(items.slice(index, index + size));
  }
}

async function clearSchoolData(schoolId: string, principalId: string) {
  await prisma.$transaction(
    async (tx) => {
      await tx.receipt.deleteMany({ where: { schoolId } });
      await tx.notification.deleteMany({ where: { schoolId } });
      await tx.communicationLog.deleteMany({ where: { schoolId } });
      await tx.attendanceRecord.deleteMany({ where: { schoolId } });
      await tx.attendanceSession.deleteMany({ where: { schoolId } });
      await tx.feeAdjustment.deleteMany({ where: { schoolId } });
      await tx.payment.deleteMany({ where: { schoolId } });
      await tx.studentFeeAssignment.deleteMany({ where: { schoolId } });
      await tx.feeInstallment.deleteMany({ where: { feeStructure: { schoolId } } });
      await tx.feeStructure.deleteMany({ where: { schoolId } });
      await tx.homeworkSubmission.deleteMany({ where: { schoolId } });
      await tx.homeworkAssignment.deleteMany({ where: { schoolId } });
      await tx.homeworkRecord.deleteMany({ where: { schoolId } });
      await tx.examResult.deleteMany({ where: { schoolId } });
      await tx.exam.deleteMany({ where: { schoolId } });
      await tx.studentDocument.deleteMany({ where: { schoolId } });
      await tx.behaviourRecord.deleteMany({ where: { schoolId } });
      await tx.auditLog.deleteMany({ where: { schoolId } });
      await tx.student.deleteMany({ where: { schoolId } });
      await tx.teacherPeriodAssignment.deleteMany({ where: { schoolId } });
      await tx.subject.deleteMany({ where: { schoolId } });
      await tx.class.deleteMany({ where: { schoolId } });
      await tx.refreshToken.deleteMany({ where: { user: { schoolId } } });
      await tx.user.deleteMany({ where: { schoolId, id: { not: principalId } } });
    },
    { timeout: 60_000 }
  );
}

export async function resetAndSeedDemoData(user: Express.UserContext, body: unknown) {
  if (env.NODE_ENV === "production") {
    throw new AppError(403, "Demo reset is disabled in production", "DEMO_RESET_DISABLED_IN_PRODUCTION");
  }

  if (!env.DEMO_RESET_ENABLED) {
    throw new AppError(403, "Demo reset is disabled", "DEMO_RESET_DISABLED");
  }

  const confirmation = (body as { confirmation?: string } | undefined)?.confirmation;
  if (confirmation !== CONFIRMATION) {
    throw new AppError(400, `Send confirmation: ${CONFIRMATION}`, "DEMO_RESET_CONFIRMATION_REQUIRED");
  }

  const principal = await prisma.user.findFirst({
    where: { id: user.id, schoolId: user.schoolId, role: { in: [UserRole.PRINCIPAL, UserRole.ADMIN] } },
    include: { school: true }
  });
  if (!principal) throw new AppError(403, "Principal account not found", "FORBIDDEN");

  const passwordHash = await bcrypt.hash(demoPassword, 10);
  await clearSchoolData(user.schoolId, principal.id);

  await prisma.school.update({
    where: { id: user.schoolId },
    data: {
      name: "SmartShala Ahmedabad Public School",
      code: "DEMO-SCHOOL",
      city: "Ahmedabad",
      state: "Gujarat",
      phone: "079-4102-8821",
      gstin: "24AABCS1429B1Z8",
      udiseNumber: "24071234567",
      affiliationBoard: "CBSE"
    }
  });

  await prisma.user.update({
    where: { id: principal.id },
    data: {
      fullName: "Principal",
      email: "principal@smartshala.local",
      phone: "9876504001",
      passwordHash,
      status: UserStatus.ACTIVE,
      isActive: true
    }
  });

  const teachers = [];
  for (let index = 0; index < teacherNames.length; index += 1) {
    const name = teacherNames[index];
    teachers.push(
      await prisma.user.create({
        data: {
          schoolId: user.schoolId,
          fullName: name,
          email: `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/\.$/, "")}@smartshala.local`,
          phone: `98765${String(4101 + index).padStart(5, "0")}`,
          passwordHash,
          role: UserRole.TEACHER,
          status: UserStatus.ACTIVE,
          isActive: true
        }
      })
    );
  }

  const classes: Class[] = [];
  for (let grade = 1; grade <= 12; grade += 1) {
    for (const section of ["A", "B"] as const) {
      const classIndex = (grade - 1) * 2 + (section === "A" ? 0 : 1);
      classes.push(
        await prisma.class.create({
          data: {
            schoolId: user.schoolId,
            name: String(grade),
            section,
            academicYear,
            classTeacherId: teachers[classIndex].id
          }
        })
      );
    }
  }

  const subjectRows = classes.flatMap((classRecord) =>
    subjects.map((name) => ({
      schoolId: user.schoolId,
      classId: classRecord.id,
      teacherId: classRecord.classTeacherId,
      name
    }))
  );
  await prisma.subject.createMany({ data: subjectRows });
  const subjectRecords = await prisma.subject.findMany({ where: { schoolId: user.schoolId } });
  const subjectsByClass = new Map<string, typeof subjectRecords>();
  for (const subject of subjectRecords) {
    const list = subjectsByClass.get(subject.classId ?? "") ?? [];
    list.push(subject);
    subjectsByClass.set(subject.classId ?? "", list);
  }

  await prisma.teacherPeriodAssignment.createMany({
    data: teachers.flatMap((teacher, teacherIndex) =>
      Array.from({ length: 8 }, (_, periodIndex) => {
        const classRecord = classes[(teacherIndex + periodIndex) % classes.length];
        const subject = (subjectsByClass.get(classRecord.id) ?? [])[periodIndex % subjects.length];
        return {
          schoolId: user.schoolId,
          teacherId: teacher.id,
          periodNumber: periodIndex + 1,
          classId: periodIndex === 7 ? null : classRecord.id,
          subjectId: periodIndex === 7 ? null : subject?.id ?? null
        };
      })
    )
  });

  const feeStructures = [];
  for (let grade = 1; grade <= 12; grade += 1) {
    const totalAmount = feeAmountForGrade(grade);
    const quarterly = money(totalAmount / 4);
    feeStructures.push(
      await prisma.feeStructure.create({
        data: {
          schoolId: user.schoolId,
          name: `Class ${grade} Annual Fees`,
          academicYear,
          frequency: FeeFrequency.QUARTERLY,
          totalAmount,
          installments: {
            create: [
              { name: "Quarter 1", dueDate: utcDate(2026, 3, 10), amount: quarterly, sortOrder: 1 },
              { name: "Quarter 2", dueDate: utcDate(2026, 6, 10), amount: quarterly, sortOrder: 2 },
              { name: "Quarter 3", dueDate: utcDate(2026, 9, 10), amount: quarterly, sortOrder: 3 },
              { name: "Quarter 4", dueDate: utcDate(2027, 0, 10), amount: money(totalAmount - quarterly * 3), sortOrder: 4 }
            ]
          }
        },
        include: { installments: true }
      })
    );
  }

  const feeByGrade = new Map(feeStructures.map((fee, index) => [index + 1, fee]));
  const studentsToCreate = [];
  for (const classRecord of classes) {
    const grade = Number(classRecord.name);
    const section = classRecord.section as "A" | "B";
    const count = studentCountFor(grade, section);
    for (let roll = 1; roll <= count; roll += 1) {
      const index = grade * 97 + (section === "A" ? 0 : 41) + roll;
      const last = pick(lastNames, index + roll);
      const father = `${pick(parentNames, index)} ${last}`;
      const mother = `${pick(parentNames, index + 5)} ${last}`;
      studentsToCreate.push({
        schoolId: user.schoolId,
        classId: classRecord.id,
        fullName: `${pick(firstNames, index)} ${last}`,
        admissionNumber: `SSA-2025-${String(grade).padStart(2, "0")}${section}${String(roll).padStart(2, "0")}`,
        rollNumber: roll,
        dateOfBirth: utcDate(2019 - Math.min(grade, 12), (roll + grade) % 12, ((roll * 3) % 27) + 1),
        gender: roll % 2 === 0 ? Gender.FEMALE : Gender.MALE,
        parentName: father,
        parentPhone: `98${String(70000000 + grade * 100000 + (section === "A" ? 0 : 20_000) + roll * 137).padStart(8, "0").slice(0, 8)}`,
        alternatePhone: roll % 4 === 0 ? `97${String(60000000 + grade * 100000 + roll * 173).padStart(8, "0").slice(0, 8)}` : null,
        fatherName: father,
        fatherPhone: `98${String(70000000 + grade * 100000 + (section === "A" ? 0 : 20_000) + roll * 137).padStart(8, "0").slice(0, 8)}`,
        fatherOccupation: pick(["Engineer", "Business Owner", "Teacher", "Bank Officer", "Consultant"], index),
        motherName: mother,
        motherPhone: `97${String(60000000 + grade * 100000 + roll * 173).padStart(8, "0").slice(0, 8)}`,
        motherOccupation: pick(["Homemaker", "Teacher", "Doctor", "Designer", "Accountant"], index + 2),
        address: `${12 + roll}, ${pick(["Satellite", "Navrangpura", "Bopal", "Paldi", "Vastrapur"], index)}, Ahmedabad`,
        joiningDate: utcDate(2025, 3, 1),
        isActive: true
      });
    }
  }
  await createManyInChunks(studentsToCreate, (chunk) => prisma.student.createMany({ data: chunk }), 1000);
  const students = await prisma.student.findMany({ where: { schoolId: user.schoolId }, orderBy: [{ classId: "asc" }, { rollNumber: "asc" }] });
  const studentsByClass = new Map<string, typeof students>();
  for (const student of students) {
    const list = studentsByClass.get(student.classId) ?? [];
    list.push(student);
    studentsByClass.set(student.classId, list);
  }

  const feeAssignments = [];
  const payments = [];
  const receipts = [];
  let receiptCounter = 1;
  for (const classRecord of classes) {
    const grade = Number(classRecord.name);
    const fee = feeByGrade.get(grade)!;
    const totalAmount = Number(fee.totalAmount);
    for (const student of studentsByClass.get(classRecord.id) ?? []) {
      const pattern = (student.rollNumber ?? 1) % 10;
      const paidAmount = pattern <= 6 ? totalAmount : pattern <= 8 ? money(totalAmount * pick([0.5, 0.75], pattern)) : 0;
      const pendingAmount = money(totalAmount - paidAmount);
      const assignmentId = randomUUID();
      feeAssignments.push({
        id: assignmentId,
        schoolId: user.schoolId,
        studentId: student.id,
        feeStructureId: fee.id,
        totalAmount,
        paidAmount,
        pendingAmount,
        status: pendingAmount === 0 ? InstallmentStatus.PAID : paidAmount > 0 ? InstallmentStatus.PARTIAL : InstallmentStatus.PENDING
      });

      if (paidAmount > 0) {
        const paymentId = randomUUID();
        const mode = paymentMode(student.rollNumber ?? 1);
        payments.push({
          id: paymentId,
          schoolId: user.schoolId,
          studentId: student.id,
          assignmentId,
          recordedById: principal.id,
          amount: paidAmount,
          mode,
          upiTransactionId: mode === PaymentMode.UPI ? `UPI${2026000000 + receiptCounter}` : null,
          chequeNumber: mode === PaymentMode.CHEQUE ? String(610000 + receiptCounter) : null,
          ddNumber: mode === PaymentMode.DD ? String(810000 + receiptCounter) : null,
          gatewayTransactionId: mode === PaymentMode.ONLINE_GATEWAY ? `pay_demo_${receiptCounter}` : null,
          bankReference: mode === PaymentMode.BANK_TRANSFER ? `NEFT${20260000 + receiptCounter}` : null,
          paidAt: daysAgo((student.rollNumber ?? 1) % 24),
          notes: pendingAmount === 0 ? "Full annual fee received" : "Partial fee payment"
        });
        receipts.push({
          id: randomUUID(),
          schoolId: user.schoolId,
          paymentId,
          receiptNo: `REC-2026-${String(receiptCounter).padStart(5, "0")}`,
          issuedAt: daysAgo((student.rollNumber ?? 1) % 24)
        });
        receiptCounter += 1;
      }
    }
  }
  await createManyInChunks(feeAssignments, (chunk) => prisma.studentFeeAssignment.createMany({ data: chunk }), 1000);
  await createManyInChunks(payments, (chunk) => prisma.payment.createMany({ data: chunk }), 1000);
  await createManyInChunks(receipts, (chunk) => prisma.receipt.createMany({ data: chunk }), 1000);

  const sessions = [];
  const attendanceRecords = [];
  for (const classRecord of classes) {
    const classStudents = studentsByClass.get(classRecord.id) ?? [];
    for (let day = 0; day < 30; day += 1) {
      const sessionId = randomUUID();
      sessions.push({
        id: sessionId,
        schoolId: user.schoolId,
        classId: classRecord.id,
        date: daysAgo(day),
        markedById: classRecord.classTeacherId ?? principal.id,
        notes: "Demo 30-day attendance"
      });
      for (const student of classStudents) {
        const pattern = ((student.rollNumber ?? 1) + day + Number(classRecord.name)) % 18;
        const status =
          pattern === 0
            ? AttendanceStatus.ABSENT
            : pattern === 1
              ? AttendanceStatus.HALF_DAY
              : pattern <= 3
                ? AttendanceStatus.LATE
                : AttendanceStatus.PRESENT;
        attendanceRecords.push({
          schoolId: user.schoolId,
          sessionId,
          studentId: student.id,
          status,
          attendanceValue: attendanceValue(status)
        });
      }
    }
  }
  await createManyInChunks(sessions, (chunk) => prisma.attendanceSession.createMany({ data: chunk }), 1000);
  await createManyInChunks(attendanceRecords, (chunk) => prisma.attendanceRecord.createMany({ data: chunk }), 1000);

  const homeworkAssignments = [];
  const homeworkSubmissions = [];
  for (const classRecord of classes) {
    const classSubjects = subjectsByClass.get(classRecord.id) ?? [];
    const classStudents = studentsByClass.get(classRecord.id) ?? [];
    for (let index = 0; index < 5; index += 1) {
      const subject = classSubjects[index % classSubjects.length];
      const assignmentId = randomUUID();
      const dueDate = daysAgo(index * 5 + 2);
      homeworkAssignments.push({
        id: assignmentId,
        schoolId: user.schoolId,
        classId: classRecord.id,
        subjectId: subject.id,
        subject: subject.name,
        title: `${subject.name} practice task ${index + 1}`,
        description: `Complete the ${subject.name.toLowerCase()} worksheet and submit in class.`,
        assignedById: classRecord.classTeacherId,
        assignedDate: daysAgo(index * 5 + 5),
        dueDate,
        maxMarks: new Prisma.Decimal(20)
      });
      for (const student of classStudents) {
        const pattern = ((student.rollNumber ?? 1) + index) % 12;
        const status =
          pattern === 0
            ? HomeworkSubmissionStatus.NOT_SUBMITTED
            : pattern <= 2
              ? HomeworkSubmissionStatus.LATE
              : HomeworkSubmissionStatus.ON_TIME;
        homeworkSubmissions.push({
          schoolId: user.schoolId,
          assignmentId,
          studentId: student.id,
          status,
          marks: status === HomeworkSubmissionStatus.NOT_SUBMITTED ? null : new Prisma.Decimal(11 + (((student.rollNumber ?? 1) * 3 + index) % 9)),
          teacherNote: status === HomeworkSubmissionStatus.NOT_SUBMITTED ? "Follow-up required" : "Checked",
          submittedAt: status === HomeworkSubmissionStatus.NOT_SUBMITTED ? null : dueDate
        });
      }
    }
  }
  await createManyInChunks(homeworkAssignments, (chunk) => prisma.homeworkAssignment.createMany({ data: chunk }), 500);
  await createManyInChunks(homeworkSubmissions, (chunk) => prisma.homeworkSubmission.createMany({ data: chunk }), 1000);

  const exams = [];
  const examResults = [];
  for (const classRecord of classes) {
    const classSubjects = subjectsByClass.get(classRecord.id) ?? [];
    const classStudents = studentsByClass.get(classRecord.id) ?? [];
    for (let index = 0; index < 4; index += 1) {
      const subject = classSubjects[index % classSubjects.length];
      const examId = randomUUID();
      const examName = `${pick(["Unit Test 1", "Mid Term", "Unit Test 2", "Term Assessment"], index)} - ${subject.name}`;
      const examDate = daysAgo(index * 7 + 3);
      exams.push({
        id: examId,
        schoolId: user.schoolId,
        classId: classRecord.id,
        subjectId: subject.id,
        name: examName,
        term: pick(["UNIT_TEST", "MID_TERM", "UNIT_TEST", "TERM_1"], index) as "UNIT_TEST" | "MID_TERM" | "TERM_1",
        maxMarks: new Prisma.Decimal(100),
        examDate
      });
      for (const student of classStudents) {
        const marks = 48 + (((student.rollNumber ?? 1) * 7 + Number(classRecord.name) * 3 + index * 5) % 47);
        const percentage = marks;
        examResults.push({
          schoolId: user.schoolId,
          studentId: student.id,
          examId,
          subjectId: subject.id,
          subject: subject.name,
          assessmentName: examName,
          marksObtained: new Prisma.Decimal(marks),
          maxMarks: new Prisma.Decimal(100),
          percentage: new Prisma.Decimal(percentage),
          grade: gradeForPercentage(percentage),
          examDate
        });
      }
    }
  }
  await createManyInChunks(exams, (chunk) => prisma.exam.createMany({ data: chunk }), 500);
  await createManyInChunks(examResults, (chunk) => prisma.examResult.createMany({ data: chunk }), 1000);

  const notificationKinds = [
    NotificationKind.ABSENCE,
    NotificationKind.LOW_ATTENDANCE,
    NotificationKind.FEE_REMINDER,
    NotificationKind.OVERDUE_FEE,
    NotificationKind.PAYMENT_RECEIPT,
    NotificationKind.MONTHLY_REPORT,
    NotificationKind.SCHOOL_ALERT
  ];
  const notificationMessages: Record<NotificationKind, string> = {
    ABSENCE: "Dear parent, your child was absent today. Please share the reason with the class teacher.",
    LOW_ATTENDANCE: "Dear parent, attendance needs attention this month. Please connect with school.",
    FEE_REMINDER: "Dear parent, fee installment is due. Kindly complete payment at the office or online.",
    OVERDUE_FEE: "Dear parent, fee balance is overdue. Please clear the pending amount at the earliest.",
    PAYMENT_RECEIPT: "Dear parent, payment receipt has been generated and shared for your records.",
    MONTHLY_REPORT: "Dear parent, monthly progress summary is ready. Please review attendance and marks.",
    SCHOOL_ALERT: "Dear parent, please note the latest school update shared by SmartShala."
  };
  const notifications = students.slice(0, 90).map((student, index) => {
    const kind = notificationKinds[index % notificationKinds.length];
    const status = index % 17 === 0 ? NotificationStatus.FAILED : index % 13 === 0 ? NotificationStatus.QUEUED : NotificationStatus.SENT;
    const createdAt = daysAgo(index % 2);
    return {
      schoolId: user.schoolId,
      studentId: student.id,
      kind,
      recipientPhone: student.parentPhone,
      message: notificationMessages[kind],
      status,
      providerMessageId: status === NotificationStatus.SENT ? `wa_demo_${index + 1}` : null,
      errorMessage: status === NotificationStatus.FAILED ? "Parent number not reachable" : null,
      sentAt: status === NotificationStatus.SENT ? createdAt : null,
      createdAt
    };
  });
  await createManyInChunks(notifications, (chunk) => prisma.notification.createMany({ data: chunk }), 500);

  return {
    status: "seeded",
    login: {
      identifier: "principal@smartshala.local",
      password: demoPassword
    },
    counts: {
      teachers: teachers.length,
      classes: classes.length,
      students: students.length,
      subjects: subjectRecords.length,
      feeStructures: feeStructures.length,
      feeAssignments: feeAssignments.length,
      payments: payments.length,
      attendanceSessions: sessions.length,
      attendanceRecords: attendanceRecords.length,
      homeworkAssignments: homeworkAssignments.length,
      homeworkSubmissions: homeworkSubmissions.length,
      exams: exams.length,
      examResults: examResults.length,
      notifications: notifications.length
    }
  };
}
