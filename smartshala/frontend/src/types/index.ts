export type Role = "PRINCIPAL" | "ADMIN" | "TEACHER" | "ACCOUNTANT" | "PARENT";

export type SessionUser = {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
  academicBackground?: string;
  role: Role;
  schoolId?: string;
  tenantSchoolId?: string;
  schoolName: string;
};

export type Kpi = {
  label: string;
  value: string | number;
  helper?: string;
  formula?: string;
  href?: string;
  tone?: "neutral" | "good" | "warn" | "danger" | "teal" | "purple" | "amber" | "green" | "red";
};
