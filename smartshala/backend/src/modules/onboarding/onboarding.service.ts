import { PaymentStatus, PlanType } from "../../generated/master-client/index.js";
import { env } from "../../config/env.js";
import { AppError } from "../../core/errors.js";
import { logger } from "../../config/logger.js";
import { masterPrisma } from "../../master-db/masterPrisma.js";
import { createSchoolDatabase } from "../../services/createSchoolDatabase.js";
import { decimalAmount, previewCoupon } from "../../services/coupon.service.js";
import { simulatePayment } from "../../services/payment.service.js";
import { trialEndsFrom } from "../../services/trial.service.js";
import { generateUniqueSchoolId } from "../../utils/generateSchoolId.js";

type OnboardingInput = {
  schoolName: string;
  ownerName: string;
  email: string;
  phone: string;
  address: string;
  numberOfStudents: number;
  numberOfStaff: number;
  planType: "TRIAL" | "STANDARD";
  couponCode?: string;
  termsAccepted: true;
};

export async function onboardSchool(input: OnboardingInput) {
  if (!env.MASTER_DATABASE_URL) throw new AppError(503, "Master database is not configured", "MASTER_DB_NOT_CONFIGURED");

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
      adminPassword: "SmartShala@123"
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
        paymentStatus: payment.status as PaymentStatus,
        amountPaid: decimalAmount(payment.amountPaid),
        couponCode: coupon.couponCode,
        isTrial,
        trialEndsAt: isTrial ? trialEndsFrom() : null,
        isActive: true,
        dbName: db.dbName,
        dbUrl: db.dbUrl,
        directDbUrl: db.directDbUrl
      }
    });

    await masterPrisma.onboardingLog.create({
      data: {
        schoolId,
        status: "ACTIVE",
        message: `School activated with database ${db.dbName}`
      }
    });

    logger.info({ schoolId, dbName }, "School onboarding completed");

    return {
      schoolId: school.schoolId,
      schoolName: school.schoolName,
      loginPath: `/${school.schoolId}/login`,
      apiBasePath: `/${school.schoolId}/api`,
      paymentStatus: school.paymentStatus,
      trialEndsAt: school.trialEndsAt,
      amountPaid: Number(school.amountPaid),
      adminLogin: {
        identifier: input.email,
        password: "SmartShala@123"
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
