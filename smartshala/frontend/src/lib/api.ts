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
  dashboard: () => apiFetch<AttendanceDashboard>("/attendance/dashboard")
};
