import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Finding a class to delete...");
    const cls = await prisma.class.findFirst();
    if (!cls) {
      console.log("No class found.");
      return;
    }
    console.log("Attempting to delete class:", cls.id);
    await prisma.class.delete({ where: { id: cls.id } });
    console.log("Class deleted successfully.");
  } catch (error: any) {
    console.log("Error constructor:", error.constructor.name);
    console.log("Error code:", error.code);
    console.log("Error message:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
