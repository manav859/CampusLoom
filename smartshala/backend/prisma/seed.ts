import { PrismaClient, FeeFrequency, Gender, PaymentMode, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("SmartShala@123", 10);

  const school = await prisma.school.upsert({
    where: { code: "DEMO-SCHOOL" },
    update: {},
    create: {
      name: "SmartShala Demo Public School",
      code: "DEMO-SCHOOL",
      city: "Ahmedabad",
      state: "Gujarat",
      phone: "9876543210"
    }
  });

  const admin = await prisma.user.upsert({
    where: { schoolId_phone: { schoolId: school.id, phone: "9000000001" } },
    update: {},
    create: {
      schoolId: school.id,
      fullName: "Principal Admin",
      email: "principal@smartshala.local",
      phone: "9000000001",
      passwordHash,
      role: UserRole.ADMIN
    }
  });

  const teacherA = await prisma.user.upsert({
    where: { schoolId_phone: { schoolId: school.id, phone: "9000000002" } },
    update: {},
    create: {
      schoolId: school.id,
      fullName: "Anita Sharma",
      email: "anita@smartshala.local",
      phone: "9000000002",
      passwordHash,
      role: UserRole.TEACHER
    }
  });

  const teacherB = await prisma.user.upsert({
    where: { schoolId_phone: { schoolId: school.id, phone: "9000000003" } },
    update: {},
    create: {
      schoolId: school.id,
      fullName: "Rahul Mehta",
      email: "rahul@smartshala.local",
      phone: "9000000003",
      passwordHash,
      role: UserRole.TEACHER
    }
  });

  const classes = await Promise.all([
    prisma.class.upsert({
      where: { schoolId_name_section_academicYear: { schoolId: school.id, name: "6", section: "A", academicYear: "2026-27" } },
      update: { classTeacherId: teacherA.id },
      create: { schoolId: school.id, name: "6", section: "A", academicYear: "2026-27", classTeacherId: teacherA.id }
    }),
    prisma.class.upsert({
      where: { schoolId_name_section_academicYear: { schoolId: school.id, name: "7", section: "A", academicYear: "2026-27" } },
      update: { classTeacherId: teacherA.id },
      create: { schoolId: school.id, name: "7", section: "A", academicYear: "2026-27", classTeacherId: teacherA.id }
    }),
    prisma.class.upsert({
      where: { schoolId_name_section_academicYear: { schoolId: school.id, name: "8", section: "B", academicYear: "2026-27" } },
      update: { classTeacherId: teacherB.id },
      create: { schoolId: school.id, name: "8", section: "B", academicYear: "2026-27", classTeacherId: teacherB.id }
    })
  ]);

  const firstNames = [
    "Aarav",
    "Diya",
    "Vivaan",
    "Anaya",
    "Ishaan",
    "Sara",
    "Kabir",
    "Meera",
    "Rohan",
    "Tara",
    "Aryan",
    "Nisha",
    "Dev",
    "Kiara",
    "Reyansh",
    "Pihu",
    "Ved",
    "Saanvi",
    "Krish",
    "Aisha",
    "Yash",
    "Riya",
    "Om",
    "Jiya",
    "Parth",
    "Avni",
    "Neil",
    "Myra",
    "Rudra",
    "Ira"
  ];

  const students = [];
  for (let index = 0; index < firstNames.length; index += 1) {
    const classRecord = classes[index % classes.length];
    const admissionNumber = `ADM-${String(index + 1).padStart(3, "0")}`;
    students.push(
      await prisma.student.upsert({
        where: { schoolId_admissionNumber: { schoolId: school.id, admissionNumber } },
        update: {},
        create: {
          schoolId: school.id,
          classId: classRecord.id,
          fullName: `${firstNames[index]} Patel`,
          admissionNumber,
          rollNumber: Math.floor(index / classes.length) + 1,
          gender: index % 2 === 0 ? Gender.MALE : Gender.FEMALE,
          parentName: `Parent ${firstNames[index]}`,
          parentPhone: `98${String(70000000 + index).padStart(8, "0")}`,
          alternatePhone: `97${String(70000000 + index).padStart(8, "0")}`,
          address: "Demo address, India"
        }
      })
    );
  }

  for (const classRecord of classes) {
    const existingStructure = await prisma.feeStructure.findFirst({
      where: {
        schoolId: school.id,
        classId: classRecord.id,
        name: `Annual Fee ${classRecord.name}-${classRecord.section}`,
        academicYear: "2026-27"
      },
      include: { installments: true }
    });

    const structure =
      existingStructure ??
      (await prisma.feeStructure.create({
        data: {
          schoolId: school.id,
          classId: classRecord.id,
          name: `Annual Fee ${classRecord.name}-${classRecord.section}`,
          academicYear: "2026-27",
          frequency: FeeFrequency.QUARTERLY,
          totalAmount: 24000,
          installments: {
            create: [
              { name: "Q1", dueDate: new Date("2026-06-10"), amount: 6000, sortOrder: 1 },
              { name: "Q2", dueDate: new Date("2026-09-10"), amount: 6000, sortOrder: 2 },
              { name: "Q3", dueDate: new Date("2026-12-10"), amount: 6000, sortOrder: 3 },
              { name: "Q4", dueDate: new Date("2027-03-10"), amount: 6000, sortOrder: 4 }
            ]
          }
        },
        include: { installments: true }
      }));

    const classStudents = students.filter((student) => student.classId === classRecord.id);
    for (const student of classStudents) {
      const assignment = await prisma.studentFeeAssignment.upsert({
        where: { studentId_feeStructureId: { studentId: student.id, feeStructureId: structure.id } },
        update: {},
        create: {
          schoolId: school.id,
          studentId: student.id,
          feeStructureId: structure.id,
          totalAmount: 24000,
          pendingAmount: 24000
        }
      });

      if (student.admissionNumber.endsWith("001") || student.admissionNumber.endsWith("004")) {
        const existingReceipt = await prisma.receipt.findFirst({
          where: { schoolId: school.id, receiptNo: `SEED-${student.admissionNumber}` }
        });
        if (existingReceipt) continue;

        const payment = await prisma.payment.create({
          data: {
            schoolId: school.id,
            studentId: student.id,
            assignmentId: assignment.id,
            installmentId: structure.installments[0]?.id,
            amount: 6000,
            mode: PaymentMode.UPI,
            recordedById: admin.id,
            notes: "Seed payment"
          }
        });
        await prisma.receipt.create({
          data: { schoolId: school.id, paymentId: payment.id, receiptNo: `SEED-${student.admissionNumber}` }
        });
        await prisma.studentFeeAssignment.update({
          where: { id: assignment.id },
          data: { paidAmount: 6000, pendingAmount: 18000, status: "PARTIAL" }
        });
      }
    }
  }

  console.log("Seed complete");
  console.log("Admin login: principal@smartshala.local / SmartShala@123");
  console.log("Teacher login: anita@smartshala.local / SmartShala@123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
