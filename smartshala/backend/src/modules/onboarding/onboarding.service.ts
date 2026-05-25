import { PaymentStatus, PlanType } from "../../../node_modules/@smartshala/master-client/index.js";
import { env } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import { logger } from "../../config/logger.js";
import { masterPrisma } from "../../master-db/masterPrisma.js";
import { createSchoolDatabase } from "../../services/createSchoolDatabase.js";
import { decimalAmount, previewCoupon } from "../../services/coupon.service.js";
import { simulatePayment } from "../../services/payment.service.js";
import { generateUniqueSchoolId } from "../../utils/generateSchoolId.js";

type OnboardingInput = {
  schoolName: string;
  ownerName: string;
  email: string;
  phone: string;
  adminPassword: string;
  address: string;
  numberOfStudents: number;
  numberOfStaff: number;
  planType: "TRIAL" | "STANDARD";
  couponCode?: string;
  termsAccepted: true;
};

export async function onboardSchool(input: OnboardingInput) {
  if (!env.MASTER_DATABASE_URL) throw new AppError(503, "Master database is not configured", "MASTER_DB_NOT_CONFIGURED");

  // Check for duplicate email
  const existingSchool = await masterPrisma.school.findFirst({
    where: { email: input.email.trim().toLowerCase() },
    select: { schoolId: true, schoolName: true }
  });
  if (existingSchool) {
    throw new AppError(409, `A school already exists with this email (${existingSchool.schoolName}). Please use a different email or contact support.`, "DUPLICATE_EMAIL");
  }

  const coupon = await previewCoupon(input.couponCode);
  if (input.couponCode && !coupon.valid) {
    throw new AppError(400, coupon.message, "INVALID_COUPON");
  }

  const schoolId = await generateUniqueSchoolId(async (candidate) => {
    const existing = await masterPrisma.school.findUnique({ where: { schoolId: candidate }, select: { id: true } });
    return Boolean(existing);
  });
  const dbName = `school_${schoolId}`;
  const isTrial = input.planType === "TRIAL";
  const payment = await simulatePayment(coupon.finalAmount, isTrial ? "trial" : "purchase");

  await masterPrisma.onboardingLog.create({
    data: {
      schoolId,
      status: "STARTED",
      message: `Onboarding started for ${input.schoolName}`
    }
  }).catch(() => undefined);

  try {
    const db = await createSchoolDatabase({
      schoolId,
      schoolName: input.schoolName,
      ownerName: input.ownerName,
      email: input.email,
      phone: input.phone,
      dbName,
      adminPassword: input.adminPassword
    });

    const school = await masterPrisma.school.create({
      data: {
        schoolId,
        schoolName: input.schoolName,
        ownerName: input.ownerName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        numberOfStudents: input.numberOfStudents,
        numberOfStaff: input.numberOfStaff,
        planType: isTrial ? PlanType.TRIAL : PlanType.STANDARD,
        paymentStatus: PaymentStatus.PENDING,
        amountPaid: decimalAmount(payment.amountPaid),
        couponCode: coupon.couponCode,
        isTrial,
        trialEndsAt: null,
        isActive: false,
        dbName: db.dbName,
        dbUrl: db.dbUrl,
        directDbUrl: db.directDbUrl
      }
    });

    await masterPrisma.onboardingLog.create({
      data: {
        schoolId,
        status: "PENDING_APPROVAL",
        message: `School database ${db.dbName} created and waiting for super admin approval`
      }
    });

    logger.info({ schoolId, dbName }, "School onboarding pending super admin approval");

    return {
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      loginPath: `/${school.schoolId}/login`,
      apiBasePath: `/${school.schoolId}/api`,
      status: "PENDING_APPROVAL",
      paymentStatus: school.paymentStatus,
      trialEndsAt: school.trialEndsAt,
      amountPaid: Number(school.amountPaid),
      adminLogin: {
        identifier: input.email,
        password: input.adminPassword
      }
    };
  } catch (error) {
    await masterPrisma.onboardingLog.create({
      data: {
        schoolId,
        status: "FAILED",
        message: error instanceof Error ? error.message : "Unknown onboarding failure"
      }
    }).catch(() => undefined);
    logger.error({ err: error, schoolId, dbName }, "School onboarding failed");
    throw error;
  }
}
