import {
  AttendanceStatus,
  FeeFrequency,
  Gender,
  InstallmentStatus,
  PaymentMode,
  PrismaClient,
  UserRole,
  UserStatus
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const academicYear = "2025-26";
const seedPassword = "SmartShala@123";

const teacherProfiles = [
  ["Dr. Meera Trivedi", "meera.trivedi@smartshalaahmedabad.edu.in", "9876504101"],
  ["Rajesh Menon", "rajesh.menon@smartshalaahmedabad.edu.in", "9876504102"],
  ["Farah Qureshi", "farah.qureshi@smartshalaahmedabad.edu.in", "9876504103"],
  ["Kavita Shah", "kavita.shah@smartshalaahmedabad.edu.in", "9876504104"],
  ["Nilesh Desai", "nilesh.desai@smartshalaahmedabad.edu.in", "9876504105"],
  ["Anita Iyer", "anita.iyer@smartshalaahmedabad.edu.in", "9876504106"],
  ["Sandeep Patel", "sandeep.patel@smartshalaahmedabad.edu.in", "9876504107"],
  ["Pooja Nair", "pooja.nair@smartshalaahmedabad.edu.in", "9876504108"],
  ["Imran Khan", "imran.khan@smartshalaahmedabad.edu.in", "9876504109"],
  ["Neha Kulkarni", "neha.kulkarni@smartshalaahmedabad.edu.in", "9876504110"],
  ["Harsh Vyas", "harsh.vyas@smartshalaahmedabad.edu.in", "9876504111"],
  ["Ritu Chatterjee", "ritu.chatterjee@smartshalaahmedabad.edu.in", "9876504112"],
  ["Vikram Rao", "vikram.rao@smartshalaahmedabad.edu.in", "9876504113"],
  ["Asha Pillai", "asha.pillai@smartshalaahmedabad.edu.in", "9876504114"]
] as const;

const firstNames = [
  "Aarav", "Aditi", "Advait", "Ahan", "Ananya", "Anika", "Arjun", "Avni", "Dev", "Diya",
  "Ishaan", "Kabir", "Kiara", "Krisha", "Mehul", "Mihir", "Navya", "Nisha", "Prisha", "Reyansh",
  "Riya", "Rohan", "Saanvi", "Shaurya", "Tara", "Ved", "Vihaan", "Yash", "Zoya", "Ayesha"
];
const lastNames = [
  "Patel", "Shah", "Mehta", "Trivedi", "Desai", "Joshi", "Vyas", "Parikh", "Modi", "Bhatt",
  "Kapadia", "Thakkar", "Raval", "Dave", "Soni", "Brahmbhatt", "Choksi", "Dalal", "Panchal", "Mistry"
];
const parentFirstNames = [
  "Nirav", "Hetal", "Bhavesh", "Jignesh", "Minal", "Ketan", "Falguni", "Pranav", "Kinjal", "Sonal",
  "Manish", "Rupal", "Amit", "Sejal", "Dhaval", "Payal", "Chirag", "Nisha", "Tejas", "Priti"
];
const demoSubjects = ["Mathematics", "English", "Science"];

function pick<T>(items: readonly T[], index: number) {
  return items[index % items.length];
}

function feeAmountForClass(classNumber: number, sectionIndex: number) {
  return 22000 + classNumber * 2400 + sectionIndex * 1250;
}

function classStrength(classNumber: number, sectionIndex: number) {
  return 24 + ((classNumber * 5 + sectionIndex * 7) % 13);
}

function attendanceValue(status: AttendanceStatus) {
  if (status === AttendanceStatus.ABSENT) return 0;
  if (status === AttendanceStatus.HALF_DAY) return 0.5;
  return 1;
}

function gradeForPercent(percent: number) {
  if (percent >= 90) return "A+";
  if (percent >= 80) return "A";
  if (percent >= 70) return "B";
  if (percent >= 60) return "C";
  if (percent >= 50) return "D";
  return "F";
}

function receiptNo(index: number) {
  return `REC-2026-${String(index).padStart(5, "0")}`;
}

function paymentReference(mode: PaymentMode, index: number) {
  if (mode === PaymentMode.UPI) return { upiTransactionId: `UPI${2026000000 + index}` };
  if (mode === PaymentMode.BANK_TRANSFER) return { bankReference: `NEFT${20260000 + index}` };
  if (mode === PaymentMode.CHEQUE) return { chequeNumber: String(610000 + index) };
  if (mode === PaymentMode.DD) return { ddNumber: String(810000 + index) };
  if (mode === PaymentMode.ONLINE_GATEWAY) return { gatewayTransactionId: `pay_demo_${index}` };
  return {};
}

async function main() {
  const passwordHash = await bcrypt.hash(seedPassword, 10);
  console.log("Seeding realistic SmartShala demo data...");

  const school = await prisma.school.upsert({
    where: { code: "DEMO-SCHOOL" },
    update: {
      name: "SmartShala Ahmedabad Public School",
      city: "Ahmedabad",
      state: "Gujarat",
      phone: "079-4102-8821",
      gstin: "24AABCS1429B1Z8",
      udiseNumber: "24071234567",
      affiliationBoard: "CBSE"
    },
    create: {
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

  await prisma.receipt.deleteMany({ where: { schoolId: school.id } });
  await prisma.notification.deleteMany({ where: { schoolId: school.id } });
  await prisma.communicationLog.deleteMany({ where: { schoolId: school.id } });
  await prisma.attendanceRecord.deleteMany({ where: { schoolId: school.id } });
  await prisma.attendanceSession.deleteMany({ where: { schoolId: school.id } });
  await prisma.payment.deleteMany({ where: { schoolId: school.id } });
  await prisma.studentFeeAssignment.deleteMany({ where: { schoolId: school.id } });
  await prisma.feeInstallment.deleteMany({ where: { feeStructure: { schoolId: school.id } } });
  await prisma.feeStructure.deleteMany({ where: { schoolId: school.id } });
  await prisma.homeworkSubmission.deleteMany({ where: { schoolId: school.id } });
  await prisma.homeworkAssignment.deleteMany({ where: { schoolId: school.id } });
  await prisma.homeworkRecord.deleteMany({ where: { schoolId: school.id } });
  await prisma.examResult.deleteMany({ where: { schoolId: school.id } });
  await prisma.exam.deleteMany({ where: { schoolId: school.id } });
  await prisma.studentDocument.deleteMany({ where: { schoolId: school.id } });
  await prisma.behaviourRecord.deleteMany({ where: { schoolId: school.id } });
  await prisma.student.deleteMany({ where: { schoolId: school.id } });
  await prisma.teacherPeriodAssignment.deleteMany({ where: { schoolId: school.id } });
  await prisma.subject.deleteMany({ where: { schoolId: school.id } });
  await prisma.class.deleteMany({ where: { schoolId: school.id } });
  await prisma.user.deleteMany({ where: { schoolId: school.id } });

  const principal = await prisma.user.create({
    data: {
      schoolId: school.id,
      fullName: "Dr. Vinay Desai",
      email: "principal@smartshala.local",
      phone: "9876504001",
      role: UserRole.PRINCIPAL,
      passwordHash,
      status: UserStatus.ACTIVE
    }
  });

  const admin = await prisma.user.create({
    data: {
      schoolId: school.id,
      fullName: "Rupal Shah",
      email: "admin@smartshalaahmedabad.edu.in",
      phone: "9876504002",
      role: UserRole.ADMIN,
      passwordHash,
      status: UserStatus.ACTIVE
    }
  });

  const teachers = [];
  for (const [fullName, email, phone] of teacherProfiles) {
    teachers.push(await prisma.user.create({
      data: {
        schoolId: school.id,
        fullName,
        email,
        phone,
        role: UserRole.TEACHER,
        passwordHash,
        status: UserStatus.ACTIVE
      }
    }));
  }

  const classes = [];
  let teacherIndex = 0;
  for (let classNumber = 1; classNumber <= 12; classNumber += 1) {
    for (const section of ["A", "B"]) {
      classes.push(await prisma.class.create({
        data: {
          schoolId: school.id,
          name: String(classNumber),
          section,
          academicYear,
          classTeacherId: teachers[teacherIndex % teachers.length].id
        }
      }));
      teacherIndex += 1;
    }
  }

  let admissionNumber = 1001;
  let receiptIndex = 1;
  const paymentModes = [PaymentMode.UPI, PaymentMode.BANK_TRANSFER, PaymentMode.CHEQUE, PaymentMode.DD, PaymentMode.ONLINE_GATEWAY, PaymentMode.CASH];

  for (const classRecord of classes) {
    const classNumber = Number(classRecord.name);
    const sectionIndex = classRecord.section === "A" ? 0 : 1;
    const totalAmount = feeAmountForClass(classNumber, sectionIndex);

    const feeStructure = await prisma.feeStructure.create({
      data: {
        schoolId: school.id,
        classId: classRecord.id,
        name: `Class ${classRecord.name}-${classRecord.section} Annual Fees`,
        academicYear,
        frequency: FeeFrequency.QUARTERLY,
        totalAmount
      }
    });

    for (let installment = 1; installment <= 4; installment += 1) {
      await prisma.feeInstallment.create({
        data: {
          feeStructureId: feeStructure.id,
          name: `Quarter ${installment}`,
          dueDate: new Date(2026, (installment - 1) * 3, 10),
          amount: totalAmount / 4,
          sortOrder: installment
        }
      });
    }

    const students = [];
    const strength = classStrength(classNumber, sectionIndex);
    for (let roll = 1; roll <= strength; roll += 1) {
      const nameIndex = classNumber * 37 + sectionIndex * 19 + roll;
      const firstName = pick(firstNames, nameIndex);
      const lastName = pick(lastNames, nameIndex + roll);
      const parentName = `${pick(parentFirstNames, nameIndex + 3)} ${lastName}`;
      const fullName = `${firstName} ${lastName}`;

      students.push(await prisma.student.create({
        data: {
          schoolId: school.id,
          classId: classRecord.id,
          fullName,
          admissionNumber: `SSA-${academicYear.slice(0, 4)}-${admissionNumber++}`,
          rollNumber: roll,
          dateOfBirth: new Date(2018 - Math.min(classNumber, 12), (roll + classNumber) % 12, ((roll * 3) % 27) + 1),
          gender: roll % 2 === 0 ? Gender.FEMALE : Gender.MALE,
          parentName,
          parentPhone: `98${String(70000000 + classNumber * 100000 + sectionIndex * 10000 + roll * 137).padStart(8, "0").slice(0, 8)}`,
          alternatePhone: roll % 4 === 0 ? `97${String(60000000 + classNumber * 100000 + roll * 173).padStart(8, "0").slice(0, 8)}` : null,
          address: `${12 + roll}, ${pick(["Navrangpura", "Satellite", "Maninagar", "Bopal", "Vastrapur", "Paldi"], roll)}, Ahmedabad`,
          joiningDate: new Date(2025, 3, Math.min(roll, 28)),
          isActive: true
        }
      }));
    }

    for (let index = 0; index < students.length; index += 1) {
      const student = students[index];
      const feeScenario = (index + classNumber + sectionIndex) % 5;
      const paidAmount =
        feeScenario === 0 ? totalAmount :
        feeScenario === 1 ? Math.round(totalAmount * 0.75) :
        feeScenario === 2 ? Math.round(totalAmount * 0.5) :
        feeScenario === 3 ? Math.round(totalAmount * 0.25) :
        0;
      const pendingAmount = totalAmount - paidAmount;
      const status =
        pendingAmount === 0 ? InstallmentStatus.PAID :
        paidAmount > 0 ? InstallmentStatus.PARTIAL :
        InstallmentStatus.PENDING;

      const assignment = await prisma.studentFeeAssignment.create({
        data: {
          schoolId: school.id,
          studentId: student.id,
          feeStructureId: feeStructure.id,
          totalAmount,
          paidAmount,
          pendingAmount,
          status
        }
      });

      if (paidAmount > 0) {
        const paidAt = new Date(2026, index % 4, 5 + (index % 20));
        const mode = pick(paymentModes, index + classNumber);
        const payment = await prisma.payment.create({
          data: {
            schoolId: school.id,
            studentId: student.id,
            assignmentId: assignment.id,
            recordedById: admin.id,
            amount: paidAmount,
            mode,
            paidAt,
            notes: paidAmount === totalAmount ? "Full annual fee received" : "Partial installment payment",
            ...paymentReference(mode, receiptIndex)
          }
        });

        await prisma.receipt.create({
          data: {
            schoolId: school.id,
            paymentId: payment.id,
            receiptNo: receiptNo(receiptIndex++),
            issuedAt: paidAt
          }
        });
      }
    }

    for (let subjectIndex = 0; subjectIndex < demoSubjects.length; subjectIndex += 1) {
      const subject = demoSubjects[subjectIndex];
      const exam = await prisma.exam.create({
        data: {
          schoolId: school.id,
          classId: classRecord.id,
          name: `Unit Test 1 - ${subject}`,
          term: "UNIT_TEST",
          examDate: new Date(2026, 1 + subjectIndex, 18 + subjectIndex),
          maxMarks: 100
        }
      });

      await prisma.examResult.createMany({
        data: students.map((student, index) => {
          const variation = (index * 7 + subjectIndex * 9 + classNumber * 3 + sectionIndex * 5) % 38;
          const marks = Math.max(42, Math.min(98, 58 + variation - (index % 11 === 0 ? 10 : 0)));
          return {
            schoolId: school.id,
            studentId: student.id,
            examId: exam.id,
            subject,
            assessmentName: exam.name,
            marksObtained: marks,
            maxMarks: 100,
            percentage: marks,
            grade: gradeForPercent(marks),
            examDate: exam.examDate
          };
        })
      });
    }

    for (let dayOffset = 0; dayOffset < 20; dayOffset += 1) {
      const date = new Date(2026, 4, 14 - dayOffset);
      date.setHours(0, 0, 0, 0);
      if (date.getDay() === 0) continue;

      const session = await prisma.attendanceSession.create({
        data: {
          schoolId: school.id,
          classId: classRecord.id,
          date,
          markedById: classRecord.classTeacherId ?? principal.id
        }
      });

      await prisma.attendanceRecord.createMany({
        data: students.map((student, index) => {
          const pattern = (index + dayOffset + classNumber + sectionIndex) % 18;
          const status =
            pattern === 0 ? AttendanceStatus.ABSENT :
            pattern === 1 ? AttendanceStatus.HALF_DAY :
            pattern === 2 ? AttendanceStatus.LATE :
            AttendanceStatus.PRESENT;
          return {
            schoolId: school.id,
            sessionId: session.id,
            studentId: student.id,
            status,
            attendanceValue: attendanceValue(status)
          };
        }),
        skipDuplicates: true
      });
    }

    console.log(`Seeded Class ${classRecord.name}-${classRecord.section}: ${students.length} students`);
  }

  console.log("Seed completed.");
  console.log("Login: principal@smartshala.local / SmartShala@123");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
