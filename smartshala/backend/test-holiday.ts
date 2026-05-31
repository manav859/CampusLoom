import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  try {
    const schoolId = "f47ac10b-58cc-4372-a567-0e02b2c3d479"; // dummy uuid
    const result = await prisma.holiday.findUnique({
      where: {
        schoolId_date: {
          schoolId: schoolId,
          date: new Date()
        }
      }
    });
    console.log("Result:", result);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
