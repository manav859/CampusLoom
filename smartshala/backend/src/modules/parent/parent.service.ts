import { prisma } from "../../core/prisma.js";
import { parentStudentWhere } from "../../utils/parentPhone.js";

/**
 * The children a signed-in parent may see: every active student in the tenant
 * reachable through the parent's login mobile. The token's phone is the single
 * source of who this parent is.
 */
export async function listChildren(user: Express.UserContext) {
  const phone = user.phone ?? "";
  if (!phone) return { children: [] };

  const students = await prisma.student.findMany({
    where: { ...parentStudentWhere(phone), isActive: true },
    select: {
      id: true,
      fullName: true,
      rollNumber: true,
      admissionNumber: true,
      profilePhotoUrl: true,
      class: { select: { name: true, section: true } }
    },
    orderBy: [{ class: { name: "asc" } }, { rollNumber: "asc" }]
  });

  return {
    children: students.map((student) => ({
      id: student.id,
      fullName: student.fullName,
      rollNumber: student.rollNumber,
      admissionNumber: student.admissionNumber,
      className: student.class ? `${student.class.name} - ${student.class.section}` : null,
      profilePhotoUrl: student.profilePhotoUrl
    }))
  };
}
