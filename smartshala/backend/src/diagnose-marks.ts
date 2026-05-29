import { prisma } from "./core/prisma.js";
import { marksContext, listExams } from "./modules/marks/marks.service.js";
import { UserRole } from "@prisma/client";

async function run() {
  try {
    console.log("Connecting database...");
    const principal = await prisma.user.findFirst({
      where: { role: UserRole.PRINCIPAL }
    });
    if (!principal) {
      console.log("No principal found!");
      return;
    }
    console.log("Found principal user:", principal.email, "School ID:", principal.schoolId);

    console.log("Running marksContext...");
    const contextResult = await marksContext(principal);
    console.log("Context loaded successfully! Number of classes:", contextResult.classes.length);

    console.log("Running listExams...");
    const examsResult = await listExams(principal, {});
    console.log("Exams loaded successfully! Number of exams:", examsResult.length);
  } catch (err) {
    console.error("DIAGNOSTIC FAILED:", err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
