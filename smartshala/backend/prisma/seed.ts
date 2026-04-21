import { Gender, PrismaClient, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const academicYear = "2026-27";
const seedPassword = "SmartShala@123";

async function upsertUser(data: {
  schoolId: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  passwordHash: string;
}) {
  return prisma.user.upsert({
    where: { schoolId_phone: { schoolId: data.schoolId, phone: data.phone } },
    update: {
      fullName: data.fullName,
      email: data.email,
      role: data.role,
      status: UserStatus.ACTIVE,
      isActive: true
    },
    create: {
      schoolId: data.schoolId,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      passwordHash: data.passwordHash,
      role: data.role,
      status: UserStatus.ACTIVE,
      isActive: true
    }
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(seedPassword, 10);

  const school = await prisma.school.upsert({
    where: { code: "DEMO-SCHOOL" },
    update: {
      name: "SmartShala Demo Public School",
      city: "Ahmedabad",
      state: "Gujarat",
      phone: "9876543210"
    },
    create: {
      name: "SmartShala Demo Public School",
      code: "DEMO-SCHOOL",
      city: "Ahmedabad",
      state: "Gujarat",
      phone: "9876543210"
    }
  });

  await upsertUser({
    schoolId: school.id,
    fullName: "Meera Iyer",
    email: "principal@smartshala.local",
    phone: "9000000001",
    role: UserRole.PRINCIPAL,
    passwordHash
  });

  await upsertUser({
    schoolId: school.id,
    fullName: "Amit Shah",
    email: "admin@smartshala.local",
    phone: "9000000002",
    role: UserRole.ADMIN,
    passwordHash
  });

  const teacherA = await upsertUser({
    schoolId: school.id,
    fullName: "Anita Sharma",
    email: "anita@smartshala.local",
    phone: "9000000003",
    role: UserRole.TEACHER,
    passwordHash
  });

  const teacherB = await upsertUser({
    schoolId: school.id,
    fullName: "Rahul Mehta",
    email: "rahul@smartshala.local",
    phone: "9000000004",
    role: UserRole.TEACHER,
    passwordHash
  });

  const classes = await Promise.all([
    prisma.class.upsert({
      where: { schoolId_name_section_academicYear: { schoolId: school.id, name: "6", section: "A", academicYear } },
      update: { classTeacherId: teacherA.id },
      create: { schoolId: school.id, name: "6", section: "A", academicYear, classTeacherId: teacherA.id }
    }),
    prisma.class.upsert({
      where: { schoolId_name_section_academicYear: { schoolId: school.id, name: "7", section: "B", academicYear } },
      update: { classTeacherId: teacherB.id },
      create: { schoolId: school.id, name: "7", section: "B", academicYear, classTeacherId: teacherB.id }
    })
  ]);

  const students = [
    "Aarav Patel",
    "Diya Shah",
    "Vivaan Desai",
    "Anaya Mehta",
    "Ishaan Trivedi",
    "Sara Khan",
    "Kabir Joshi",
    "Meera Nair",
    "Rohan Iyer",
    "Tara Singh",
    "Aryan Rao",
    "Nisha Verma",
    "Dev Kapoor",
    "Kiara Jain",
    "Reyansh Pillai",
    "Pihu Malhotra",
    "Ved Menon",
    "Saanvi Reddy",
    "Krish Bansal",
    "Aisha Qureshi"
  ];

  for (let index = 0; index < students.length; index += 1) {
    const classRecord = classes[index % classes.length];
    const admissionNumber = `ADM-${String(index + 1).padStart(3, "0")}`;

    await prisma.student.upsert({
      where: { schoolId_admissionNumber: { schoolId: school.id, admissionNumber } },
      update: {
        fullName: students[index],
        classId: classRecord.id,
        rollNumber: Math.floor(index / classes.length) + 1,
        isActive: true
      },
      create: {
        schoolId: school.id,
        classId: classRecord.id,
        fullName: students[index],
        admissionNumber,
        rollNumber: Math.floor(index / classes.length) + 1,
        gender: index % 2 === 0 ? Gender.MALE : Gender.FEMALE,
        parentName: `Parent of ${students[index]}`,
        parentPhone: `98${String(70000000 + index).padStart(8, "0")}`,
        address: "Demo address, India"
      }
    });
  }

  console.log("Seed complete");
  console.log(`Principal login: principal@smartshala.local / ${seedPassword}`);
  console.log(`Admin login: admin@smartshala.local / ${seedPassword}`);
  console.log(`Teacher login: anita@smartshala.local / ${seedPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
