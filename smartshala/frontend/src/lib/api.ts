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
    if (response.status === 401 && typeof window !== "undefined" && !path.includes("/auth/")) {
      window.localStorage.removeItem("smartshala.accessToken");
      window.localStorage.removeItem("smartshala.refreshToken");
      window.location.href = "/login";
    }
    if (payload?.error?.code === "VALIDATION_ERROR" && payload.error.details) {
      const details = payload.error.details.fieldErrors;
      const firstError = Object.entries(details).map(([field, msgs]) => `${field}: ${(msgs as any)[0]}`).join(", ");
      throw new Error(`Validation failed: ${firstError}`);
    }
    throw new Error(payload?.error?.message ?? "Request failed");
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiFormFetch<T>(path: string, body: FormData, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);

  if (options.auth !== false && typeof window !== "undefined") {
    const token = window.localStorage.getItem("smartshala.accessToken");
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...options,
    method: options.method ?? "POST",
    headers,
    body,
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    if (response.status === 401 && typeof window !== "undefined" && !path.includes("/auth/")) {
      window.localStorage.removeItem("smartshala.accessToken");
      window.localStorage.removeItem("smartshala.refreshToken");
      window.location.href = "/login";
    }
    if (payload?.error?.code === "VALIDATION_ERROR" && payload.error.details) {
      const details = payload.error.details.fieldErrors;
      const firstError = Object.entries(details).map(([field, msgs]) => `${field}: ${(msgs as any)[0]}`).join(", ");
      throw new Error(`Validation failed: ${firstError}`);
    }
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
    date: string;
    amount: string | number;
    mode: "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "OTHER";
    paidAt: string;
    receiptId: string | null;
    receiptNo?: string;
    feeStructureName?: string;
    balanceAfter: number;
    receipt?: { id: string; receiptNo: string } | null;
  }[];
  transactionLedger: {
    id: string;
    date: string;
    amount: number;
    mode: "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "OTHER";
    receiptId: string | null;
    receiptNo: string | null;
    assignmentId: string;
    feeStructureId: string;
    feeStructureName: string;
    balanceAfter: number;
  }[];
};

export type PaymentResult = {
  payment: { id: string; amount: string | number; mode: string; paidAt: string };
  receipt: { id: string; receiptNo: string };
  ledger: { total: number; paid: number; balance: number; balanceAmount: number; status: string };
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
  lastAbsentDate: string | null;
  currentRank: number | null;
  performanceRate: number | null;
  examAverage: number | null;
  homeworkCompletion: number | null;
  attendancePercentage: number;
  performanceClassification: "Excellent" | "Good" | "Needs Attention" | "At Risk" | null;
  feeBalance: number;
  academicAnalytics: {
    exams: {
      id: string;
      examName: string;
      subject: string;
      marks: string;
      percentage: number;
      classAverage: number;
      grade: string;
      rank: number | null;
      examDate: string;
    }[];
    trend: {
      examName: string;
      examDate: string;
      student: number;
      classAverage: number;
    }[];
    subjects: {
      subject: string;
      studentAverage: number;
      classAverage: number;
      homeworkCompletion: number;
    }[];
  };
  homeworkAnalytics: {
    completionPercentage: number | null;
    counts: {
      total: number;
      onTime: number;
      late: number;
      missing: number;
    };
    currentStreak: number;
    subjects: {
      subject: string;
      total: number;
      onTime: number;
      late: number;
      missing: number;
      completionPercentage: number;
    }[];
    assignments: {
      id: string;
      title: string;
      subject: string;
      assignedDate: string;
      dueDate: string;
      status: "ON_TIME" | "LATE" | "MISSING" | "PENDING";
      marks: number | null;
      maxMarks: number | null;
      teacherNote: string | null;
      submittedAt: string | null;
    }[];
  };
  attendanceAnalytics: {
    records: {
      date: string;
      status: AttendanceReadStatus;
    }[];
    calendar: {
      date: string;
      status: AttendanceReadStatus | "HOLIDAY" | "UNMARKED";
    }[];
    metrics: {
      attendancePercentage: number;
      totalDays: number;
      absences: number;
      late: number;
      remainingBefore75: number;
    };
    cbseWarning: boolean;
    repeatedWeekdayAbsences: {
      weekday: string;
      count: number;
      dates: string[];
    }[];
  };
  communicationAudit: {
    id: string;
    type: "WHATSAPP" | "MANUAL_NOTE" | "CALL";
    channel: "WHATSAPP" | "PHONE" | "IN_PERSON" | "INTERNAL";
    summary: string;
    status: "QUEUED" | "SENT" | "FAILED" | "COMPLETED" | "MISSED" | "NOTE";
    timestamp: string;
    source: "notification" | "communication_log";
    reference: string | null;
  }[];
  behaviourAnalytics: {
    canViewCounsellorNotes: boolean;
    counts: {
      incidents: number;
      achievements: number;
      counsellorNotes: number;
      total: number;
    };
    records: {
      id: string;
      type: "INCIDENT" | "ACHIEVEMENT" | "COUNSELLOR_NOTE";
      title: string;
      summary: string;
      severity: "LOW" | "MEDIUM" | "HIGH" | "POSITIVE" | "NOTE";
      occurredAt: string;
      isRestricted: boolean;
      actionTaken: string | null;
      createdBy: {
        id: string;
        fullName: string;
        role: "PRINCIPAL" | "ADMIN" | "TEACHER";
      } | null;
    }[];
  };
  documents: {
    id: string;
    type: "CERTIFICATE" | "MEDICAL" | "PARENT_ID" | "AGREEMENT";
    name: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
    uploadedBy: {
      id: string;
      fullName: string;
      role: "PRINCIPAL" | "ADMIN" | "TEACHER";
    };
  }[];
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
      mode: "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "OTHER";
      paidAt: string;
      receipt?: { id: string; receiptNo: string } | null;
    }[];
  }[];
  attendanceRecords: {
    id: string;
    status: AttendanceReadStatus;
    session: { date: string; classId: string };
  }[];
};

export type BehaviourRecordPayload = {
  type: "INCIDENT" | "ACHIEVEMENT" | "COUNSELLOR_NOTE";
  title: string;
  summary: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "POSITIVE" | "NOTE";
  occurredAt?: string;
  isRestricted?: boolean;
  actionTaken?: string;
};

export type StudentDocumentUploadPayload = {
  type: "CERTIFICATE" | "MEDICAL" | "PARENT_ID" | "AGREEMENT";
  name?: string;
  file: File;
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
    apiFetch<PaymentResult>("/fees/payment", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  downloadReceiptPdf: async (receiptId: string) => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.accessToken") : null;
    const response = await fetch(`${env.apiBaseUrl}/fees/receipts/${receiptId}/pdf`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) throw new Error("Failed to download receipt");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${receiptId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
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
  get: (studentId: string) => apiFetch<StudentDetail>(`/students/${studentId}`),
  uploadDocument: (studentId: string, payload: StudentDocumentUploadPayload) => {
    const formData = new FormData();
    formData.append("type", payload.type);
    if (payload.name) formData.append("name", payload.name);
    formData.append("file", payload.file);
    return apiFormFetch<StudentDetail["documents"][number]>(`/students/${studentId}/documents`, formData);
  },
  downloadDocument: async (studentId: string, documentId: string, filename: string) => {
    const token = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.accessToken") : null;
    const response = await fetch(`${env.apiBaseUrl}/students/${studentId}/documents/${documentId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    if (!response.ok) throw new Error("Failed to download document");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  createBehaviourRecord: (studentId: string, payload: BehaviourRecordPayload) =>
    apiFetch<StudentDetail["behaviourAnalytics"]["records"][number]>(`/students/${studentId}/behaviour`, {
      method: "POST",
      body: JSON.stringify(payload)
    })
};
