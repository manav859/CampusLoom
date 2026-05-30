import { prisma } from "./core/prisma.js";
import { getStudentReportCardPdf } from "./modules/students/report-card.service.js";
import fs from "fs/promises";
import path from "path";

async function test() {
  try {
    console.log("Searching for a student...");
    const student = await prisma.student.findFirst({
      include: {
        school: true
      }
    });

    if (!student) {
      console.log("No student found in DB.");
      return;
    }

    console.log(`Generating report card for student: ${student.fullName} (ID: ${student.id})`);
    
    // Construct dummy UserContext matching Express.UserContext
    const mockUser: Express.UserContext = {
      id: "mock-teacher-id",
      schoolId: student.schoolId,
      role: "PRINCIPAL",
      phone: student.parentPhone, // mock
      fullName: "Test User"
    };

    const pdfBuffer = await getStudentReportCardPdf(mockUser, student.id);
    const outputPath = path.resolve(process.cwd(), "test-report-card.pdf");
    
    await fs.writeFile(outputPath, pdfBuffer);
    console.log(`Success! PDF saved to ${outputPath}`);
  } catch (error) {
    console.error("Test failed with error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

test();
