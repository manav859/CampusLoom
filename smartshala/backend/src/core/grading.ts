export const GRADE_BANDS = [
  { min: 90, grade: "A+" },
  { min: 80, grade: "A" },
  { min: 70, grade: "B+" },
  { min: 60, grade: "B" },
  { min: 50, grade: "C" },
  { min: 40, grade: "D" },
  { min: 0, grade: "F" }
] as const;

export type Grade = (typeof GRADE_BANDS)[number]["grade"];

export function gradeForPercentage(value: number): Grade {
  const percentage = Number.isFinite(value) ? Math.max(0, value) : 0;
  return GRADE_BANDS.find((band) => percentage >= band.min)?.grade ?? "F";
}
