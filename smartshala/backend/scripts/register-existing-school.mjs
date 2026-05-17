import "dotenv/config";
import { PrismaClient } from "../node_modules/@smartshala/master-client/index.js";

const required = (value, name) => {
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const master = new PrismaClient();

const schoolId = required(process.env.EXISTING_SCHOOL_ID, "EXISTING_SCHOOL_ID").toUpperCase();
const schoolName = process.env.EXISTING_SCHOOL_NAME ?? "SmartShala Existing School";
const dbName = process.env.EXISTING_SCHOOL_DB_NAME ?? `school_${schoolId}`;
const dbUrl = required(process.env.EXISTING_SCHOOL_DATABASE_URL ?? process.env.DATABASE_URL, "EXISTING_SCHOOL_DATABASE_URL");
const directDbUrl = process.env.EXISTING_SCHOOL_DIRECT_URL ?? process.env.DIRECT_URL;

await master.school.upsert({
  where: { schoolId },
  update: {
    schoolName,
    dbName,
    dbUrl,
    directDbUrl,
    isActive: true
  },
  create: {
    schoolId,
    schoolName,
    ownerName: process.env.EXISTING_SCHOOL_OWNER ?? "Principal",
    email: process.env.EXISTING_SCHOOL_EMAIL ?? "principal@smartshala.local",
    phone: process.env.EXISTING_SCHOOL_PHONE ?? "9876504001",
    address: process.env.EXISTING_SCHOOL_ADDRESS ?? "Ahmedabad",
    numberOfStudents: Number(process.env.EXISTING_SCHOOL_STUDENTS ?? 720),
    numberOfStaff: Number(process.env.EXISTING_SCHOOL_STAFF ?? 30),
    planType: "STANDARD",
    paymentStatus: "PAID",
    amountPaid: 20000,
    isTrial: false,
    isActive: true,
    dbName,
    dbUrl,
    directDbUrl
  }
});

await master.onboardingLog.create({
  data: {
    schoolId,
    status: "EXISTING_REGISTERED",
    message: `Registered existing database ${dbName} as tenant ${schoolId}`
  }
});

await master.$disconnect();
console.log(`Existing school registered: ${schoolId}`);
