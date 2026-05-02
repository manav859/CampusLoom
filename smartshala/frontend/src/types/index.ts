export type Role = "PRINCIPAL" | "ADMIN" | "TEACHER" | "ACCOUNTANT" | "PARENT";

export type SessionUser = {
  id: string;
  fullName: string;
  role: Role;
  schoolName: string;
};

export type Kpi = {
  label: string;
  value: string | number;
  tone?: "neutral" | "good" | "warn" | "danger" | "teal" | "purple" | "amber" | "green" | "red";
};
