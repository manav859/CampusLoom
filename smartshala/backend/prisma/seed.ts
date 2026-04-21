import {
  PrismaClient,
  UserRole,
  UserStatus,
  Gender,
  AttendanceStatus,
  FeeFrequency,
  InstallmentStatus,
  PaymentMode,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const academicYear = "2025-26";
const seedPassword = "SmartShala@123";

// Name arrays for generating realistic Indian names
const firstNames = [
  "Aarav", "Vihaan", "Vivaan", "Ananya", "Diya", "Advik", "Kabir", "Anika", "Navya", "Aryan",
  "Reyansh", "Shruti", "Riya", "Rohan", "Yash", "Arjun", "Aditya", "Prisha", "Aarna", "Ishaan",
  "Ansh", "Ayush", "Dev", "Dhruv", "Kartik", "Kiran", "Kunal", "Manish", "Neha", "Nidhi",
  "Pooja", "Priya", "Rahul", "Raj", "Ravi", "Ritu", "Sanjay", "Sneha", "Swati", "Tarun",
  "Varun", "Vikas", "Amit", "Anil", "Asha", "Ashok", "Bina", "Chitra", "Deepa", "Dinesh",
  "Ganesh", "Geeta", "Harish", "Hema", "Jay", "Jyoti", "Kavita", "Mahesh", "Meena", "Mohan",
  "Nitin", "Prakash", "Rajesh", "Ramesh", "Sunil", "Suresh", "Vijay", "Vinod"
];
const lastNames = [
  "Sharma", "Singh", "Kumar", "Patel", "Gupta", "Reddy", "Shah", "Rao", "Joshi", "Nair",
  "Iyer", "Mehta", "Trivedi", "Khan", "Menon", "Pillai", "Jain", "Verma", "Kapoor", "Malhotra",
  "Qureshi", "Bansal", "Agarwal", "Yadav", "Das", "Banerjee", "Bose", "Chatterjee", "Roy",
  "Sen", "Dutta", "Deshmukh", "Kulkarni", "Patil", "Bhat", "Gowda", "Hegde"
];

function getRandomName() {
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${first} ${last}`;
}

async function main() {
  try {
    const passwordHash = await bcrypt.hash(seedPassword, 10);
    console.log("Seeding started...");

    // 1. Create or Fetch School
    const school = await prisma.school.upsert({
      where: { code: "DEMO-SCHOOL" },
      update: {
        name: "SmartShala Demo Public School",
      },
      create: {
        name: "SmartShala Demo Public School",
        code: "DEMO-SCHOOL",
        city: "Bangalore",
        state: "Karnataka",
        phone: "8888888888",
      },
    });
    console.log("School ready: " + school.name);

    // Clean up existing data for this school to allow re-running seed cleanly without FK errors
    console.log("Cleaning up old generated data in strict relationships order...");
    await prisma.receipt.deleteMany({ where: { schoolId: school.id } });
    await prisma.notification.deleteMany({ where: { schoolId: school.id } });
    
    await prisma.attendanceRecord.deleteMany({ where: { schoolId: school.id } });
    await prisma.attendanceSession.deleteMany({ where: { schoolId: school.id } });
    
    await prisma.payment.deleteMany({ where: { schoolId: school.id } });
    await prisma.studentFeeAssignment.deleteMany({ where: { schoolId: school.id } });
    await prisma.feeInstallment.deleteMany({ where: { feeStructure: { schoolId: school.id } } });
    await prisma.feeStructure.deleteMany({ where: { schoolId: school.id } });
    
    await prisma.student.deleteMany({ where: { schoolId: school.id } });
    await prisma.class.deleteMany({ where: { schoolId: school.id } });

    // IMPORTANT: Delete users exactly as required
    await prisma.user.deleteMany({ where: { schoolId: school.id } });

    // 2. Create Principal & Admin
    const principal = await prisma.user.upsert({
      where: { 
        schoolId_email: { 
          schoolId: school.id, 
          email: "principal@smartshala.local" 
        } 
      },
      update: {},
      create: {
        schoolId: school.id,
        fullName: "Dr. Vinay Kumar",
        email: "principal@smartshala.local",
        phone: "9100000001",
        role: UserRole.PRINCIPAL,
        passwordHash,
        status: UserStatus.ACTIVE,
      },
    });

    const admin = await prisma.user.upsert({
      where: { 
        schoolId_email: { 
          schoolId: school.id, 
          email: "admin@smartshala.local" 
        } 
      },
      update: {},
      create: {
        schoolId: school.id,
        fullName: "Admin User",
        email: "admin@smartshala.local",
        phone: "9100000002",
        role: UserRole.ADMIN,
        passwordHash,
        status: UserStatus.ACTIVE,
      },
    });

    // 3. Create Teachers (14)
    const teachers = [];
    for (let i = 1; i <= 14; i++) {
      const email = `teacher${i}@smartshala.local`;
      const t = await prisma.user.upsert({
        where: { 
          schoolId_email: { 
            schoolId: school.id, 
            email 
          } 
        },
        update: {},
        create: {
          schoolId: school.id,
          fullName: getRandomName(),
          email,
          phone: `91000001${i.toString().padStart(2, "0")}`,
          role: UserRole.TEACHER,
          passwordHash,
          status: UserStatus.ACTIVE,
        },
      });
      teachers.push(t);
    }
    console.log("Teachers created: " + teachers.length);

    // 4. Create Classes (1-12, A&B -> 24 classes)
    const classes = [];
    let teacherIndex = 0;
    for (let i = 1; i <= 12; i++) {
      for (const section of ["A", "B"]) {
        const cls = await prisma.class.create({
          data: {
            schoolId: school.id,
            name: i.toString(),
            section,
            academicYear,
            classTeacherId: teachers[teacherIndex % teachers.length].id,
          },
        });
        classes.push(cls);
        teacherIndex++;
      }
    }
    console.log("Classes created: " + classes.length);

    let admissionNumberCounter = 1000;

    // 5. Build everything else Class by Class
    for (const cls of classes) {
      // 5a. Create Fee Structure for this class
      const totalAmount = Math.floor(Math.random() * 30000) + 20000; // 20k to 50k
      const frequency = Math.random() > 0.5 ? FeeFrequency.ANNUAL : FeeFrequency.MONTHLY;
      
      const feeStructure = await prisma.feeStructure.create({
        data: {
          schoolId: school.id,
          classId: cls.id,
          name: `Class ${cls.name} Fees`,
          academicYear,
          frequency,
          totalAmount,
        },
      });

      const numInstallments = frequency === FeeFrequency.ANNUAL ? 4 : 10;
      const amountPerInstallment = totalAmount / numInstallments;
      const installments = [];
      
      for (let ins = 1; ins <= numInstallments; ins++) {
        const installment = await prisma.feeInstallment.create({
          data: {
            feeStructureId: feeStructure.id,
            name: `Installment ${ins}`,
            dueDate: new Date(2025, 3 + ins, 10), // Starting around April
            amount: amountPerInstallment,
            sortOrder: ins,
          },
        });
        installments.push(installment);
      }

      // 5b. Create 30 students for this class
      const studentsData = [];
      for (let roll = 1; roll <= 30; roll++) {
        const fullName = getRandomName();
        studentsData.push({
          schoolId: school.id,
          classId: cls.id,
          fullName,
          admissionNumber: `ADM${admissionNumberCounter++}`,
          rollNumber: roll,
          parentName: `Parent of ${fullName}`,
          parentPhone: `92${Math.floor(Math.random() * 90000000 + 10000000)}`,
          isActive: true,
          gender: Math.random() > 0.5 ? Gender.MALE : Gender.FEMALE,
        });
      }

      // Batch insert students
      await prisma.student.createMany({
        data: studentsData,
        skipDuplicates: true,
      });

      // Fetch the inserted students to get their IDs
      const classStudents = await prisma.student.findMany({
        where: { classId: cls.id },
      });

      // 5c. Assign fees & Payments
      for (const student of classStudents) {
        const statusRand = Math.random();
        let status = InstallmentStatus.PENDING;
        let paidAmount = 0;

        if (statusRand > 0.7) {
          status = InstallmentStatus.PAID;
          paidAmount = totalAmount;
        } else if (statusRand > 0.4) {
          status = InstallmentStatus.PARTIAL;
          paidAmount = totalAmount / 2;
        }

        const pendingAmount = totalAmount - paidAmount;

        const assignment = await prisma.studentFeeAssignment.create({
          data: {
            schoolId: school.id,
            studentId: student.id,
            feeStructureId: feeStructure.id,
            totalAmount,
            paidAmount,
            pendingAmount,
            status,
          },
        });

        // Create Payment entry if partially or fully paid
        if (paidAmount > 0) {
          await prisma.payment.create({
            data: {
              schoolId: school.id,
              studentId: student.id,
              assignmentId: assignment.id,
              recordedById: admin.id,
              amount: paidAmount,
              mode: PaymentMode.UPI,
              paidAt: new Date(),
            },
          });
        }
      }

      // 5d. Attendance for last 7 days
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        // Normalize date to 00:00:00
        const date = new Date();
        date.setDate(date.getDate() - dayOffset);
        date.setHours(0, 0, 0, 0);

        // Create unique session
        try {
          const session = await prisma.attendanceSession.create({
            data: {
              schoolId: school.id,
              classId: cls.id,
              date,
              markedById: cls.classTeacherId || teachers[0].id,
            },
          });

          // Batch insert attendance records
          const attendanceRecords = classStudents.map((st) => {
            const isAbsent = Math.random() < 0.15; // 15% absent
            return {
              schoolId: school.id,
              sessionId: session.id,
              studentId: st.id,
              status: isAbsent ? AttendanceStatus.ABSENT : AttendanceStatus.PRESENT,
            };
          });

          await prisma.attendanceRecord.createMany({
            data: attendanceRecords,
            skipDuplicates: true,
          });
        } catch (err: any) {
          // Ignore unique constraint violation
          if (err.code !== 'P2002') throw err;
        }
      }

      console.log(`Class ${cls.name}-${cls.section} seeded with ${classStudents.length} students, fees, and attendance.`);
    }

    console.log("==========================================");
    console.log("🎉 Seed completed successfully!");
    console.log("==========================================");
  } catch (error) {
    console.error("==========================================");
    console.error("❌ Error naturally generating seed data:");
    console.error(error);
    console.error("==========================================");
    process.exit(1);
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
