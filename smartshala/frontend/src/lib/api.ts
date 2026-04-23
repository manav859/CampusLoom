import { env } from "./env";
import type { SessionUser } from "@/types";

type ApiOptions = RequestInit & {
  auth?: boolean;
};

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (options.auth !== false && typeof window !== "undefined") {
    const token = window.localStorage.getItem("smartshala.accessToken");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...options,
    headers,
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message ?? "Request failed");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const authApi = {
  register: (payload: { name: string; email: string; phone: string; password: string; schoolName?: string }) =>
    apiFetch<{
      accessToken: string;
      refreshToken: string;
      user: SessionUser;
    }>("/auth/register", {
      method: "POST",
      auth: false,
      body: JSON.stringify(payload)
    }),
  login: (identifier: string, password: string) =>
    apiFetch<{
      accessToken: string;
      refreshToken: string;
      user: SessionUser;
    }>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ identifier, password })
    }),
  me: () => apiFetch<{ user: SessionUser }>("/auth/me"),
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" })
};

export type AttendanceMarkStatus = "PRESENT" | "ABSENT";
export type AttendanceReadStatus = "PRESENT" | "ABSENT" | "LATE";

export type ClassSummary = {
  id: string;
  name: string;
  section: string;
  academicYear: string;
  _count?: { students: number };
};

export type ClassStudent = {
  id: string;
  fullName: string;
  rollNumber: number | null;
};

export type ClassTodayAttendance = {
  classId: string;
  date: string;
  marked: boolean;
  attendance: {
    studentId: string;
    name: string;
    rollNumber: number | null;
    status: AttendanceReadStatus;
  }[];
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
  };
};

export type AttendanceDashboard = {
  totalClasses: number;
  markedClasses: number;
  pendingClasses: number;
  attendancePercentage: number;
  students: {
    present: number;
    absent: number;
  };
  alerts: {
    type: "MISSING_ATTENDANCE";
    classId: string;
    className: string;
  }[];
};

export type ClassesTodayReportRow = {
  classId: string;
  className: string;
  present: number;
  absent: number;
  late: number;
  total: number;
  percentage: number;
};

export type NotificationLog = {
  id: string;
  kind: "ABSENCE" | "LOW_ATTENDANCE" | "FEE_REMINDER" | "OVERDUE_FEE" | "PAYMENT_RECEIPT" | "MONTHLY_REPORT" | "SCHOOL_ALERT";
  recipientPhone: string;
  message: string;
  status: "QUEUED" | "SENT" | "FAILED";
  sentAt: string | null;
  createdAt: string;
  student?: {
    id: string;
    fullName: string;
    admissionNumber: string;
  } | null;
};

export type FeeAssignmentSummary = {
  id: string;
  studentId: string;
  totalAmount: string | number;
  paidAmount: string | number;
  pendingAmount: string | number;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  student: {
    id: string;
    fullName: string;
    parentPhone?: string;
    class: { name: string; section: string };
  };
  feeStructure: {
    id: string;
    name: string;
    totalAmount: string | number;
  };
};

export type FeesDashboard = {
  totalDue: number;
  totalCollected: number;
  totalPending: number;
  overdueInstallments: number;
  topDefaulters: FeeAssignmentSummary[];
};

export type FeeDefaulter = {
  studentId: string;
  name: string;
  class: string;
  balance: number;
  balanceAmount: number;
  daysOverdue: number;
  dueDate?: string;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
};

export type StudentFeeLedger = {
  student: {
    id: string;
    fullName: string;
    admissionNumber: string;
    class: { name: string; section: string };
  };
  total: number;
  paid: number;
  balance: number;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  assignments: {
    id: string;
    feeStructureId: string;
    total: number;
    paid: number;
    balance: number;
    status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
    feeStructure: { name: string };
  }[];
  payments: {
    id: string;
    amount: string | number;
    mode: "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "OTHER";
    paidAt: string;
    receiptNo?: string;
    feeStructureName?: string;
  }[];
};

export type StudentDetail = {
  id: string;
  fullName: string;
  admissionNumber: string;
  rollNumber: number | null;
  parentName: string;
  parentPhone: string;
  alternatePhone: string | null;
  address: string | null;
  isActive: boolean;
  joiningDate: string;
  class: { name: string; section: string };
  feeAssignments: {
    id: string;
    totalAmount: string | number;
    paidAmount: string | number;
    pendingAmount: string | number;
    status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
    feeStructure: { id: string; name: string; totalAmount: string | number };
    payments: {
      id: string;
      amount: string | number;
      paidAt: string;
      receipt?: { receiptNo: string } | null;
    }[];
  }[];
  attendanceRecords: {
    id: string;
    status: AttendanceReadStatus;
    session: { date: string; classId: string };
  }[];
};

export const classesApi = {
  list: () => apiFetch<ClassSummary[]>("/classes"),
  students: (classId: string) => apiFetch<ClassStudent[]>(`/classes/${classId}/students`)
};

export const attendanceApi = {
  classToday: (classId: string) => apiFetch<ClassTodayAttendance>(`/attendance/class/${classId}/today`),
  mark: (payload: { classId: string; date: string; records: { studentId: string; status: AttendanceMarkStatus }[] }) =>
    apiFetch("/attendance/mark", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  dashboard: () => apiFetch<AttendanceDashboard>("/attendance/dashboard"),
  classesTodayReport: () => apiFetch<ClassesTodayReportRow[]>("/attendance/report/classes-today")
};

export const feesApi = {
  dashboard: () => apiFetch<FeesDashboard>("/fees/dashboard"),
  defaulters: () => apiFetch<FeeDefaulter[]>("/fees/defaulters"),
  studentLedger: (studentId: string) => apiFetch<StudentFeeLedger>(`/fees/student/${studentId}`),
  recordPayment: (payload: { studentId: string; amount: number; mode: "CASH" | "UPI" | "CHEQUE" }) =>
    apiFetch("/fees/payment", {
      method: "POST",
      body: JSON.stringify(payload)
    })
};

export const whatsappApi = {
  logs: () => apiFetch<NotificationLog[]>("/wa/logs"),
  send: (payload: { phone: string; message: string }) =>
    apiFetch<{ success: boolean }>("/wa/send", {
      method: "POST",
      body: JSON.stringify(payload)
    })
};

export const studentsApi = {
  get: (studentId: string) => apiFetch<StudentDetail>(`/students/${studentId}`)
};
