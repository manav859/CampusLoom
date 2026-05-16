import { prisma } from "../../core/prisma.js";

export type SchoolProfileInput = {
  name: string;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  gstin?: string | null;
  udiseNumber?: string | null;
  affiliationBoard?: string | null;
  logoUrl?: string | null;
};

const schoolProfileSelect = {
  id: true,
  name: true,
  code: true,
  city: true,
  state: true,
  phone: true,
  gstin: true,
  udiseNumber: true,
  affiliationBoard: true,
  logoUrl: true
} as const;

export async function getSchoolProfile(schoolId: string) {
  return prisma.school.findUniqueOrThrow({
    where: { id: schoolId },
    select: schoolProfileSelect
  });
}

export async function updateSchoolProfile(schoolId: string, input: SchoolProfileInput) {
  return prisma.school.update({
    where: { id: schoolId },
    data: input,
    select: schoolProfileSelect
  });
}
