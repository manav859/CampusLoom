import { env } from "./env";
import { tenantApiBase, withSchoolPath } from "./tenant";
import { tokenStore } from "./tokenStore";
import type { Role, SessionUser } from "@/types";

type ApiOptions = RequestInit & {
  auth?: boolean;
};

/**
 * Exchange the httpOnly refresh cookie for a fresh access token.
 * The cookie is sent automatically via credentials: "include".
 * Returns the new access token, or null if the session cannot be restored.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const response = await fetch(`${tenantApiBase(env.apiBaseUrl, "/auth/refresh")}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      cache: "no-store"
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    return typeof data?.accessToken === "string" ? data.accessToken : null;
  } catch {
    return null;
  }
}

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/**
 * A tenant whose subscription lapsed gets 402 on everything except auth and
 * billing. Send the principal to the page where they can actually fix it, and
 * everyone else to the lockout notice.
 */
function handleSuspendedTenant() {
  if (typeof window === "undefined") return;
  let role: string | undefined;
  try {
    const stored = window.localStorage.getItem("smartshala.user");
    if (stored) role = JSON.parse(stored)?.role;
  } catch {
    // Fall through to the generic lockout page.
  }

  const target = role === "PRINCIPAL" ? withSchoolPath("/billing") : "/school-inactive";
  if (window.location.pathname === target) return;
  window.location.href = target;
}

function retryDelay(attempt: number, response?: Response) {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.min(seconds * 1000, 2000);

    const date = Date.parse(retryAfter);
    if (!Number.isNaN(date)) return Math.min(Math.max(date - Date.now(), 0), 2000);
  }

  return Math.min(250 * 2 ** attempt, 1500);
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2): Promise<Response> {
  let attempt = 0;
  const method = (options.method ?? "GET").toUpperCase();
  const canRetry = method === "GET" || method === "HEAD";

  while (true) {
    try {
      const response = await fetch(url, options);
      if (!canRetry || !RETRYABLE_STATUSES.has(response.status) || attempt >= maxRetries) {
        return response;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt, response)));
    } catch (error) {
      if (!canRetry || attempt >= maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt)));
    }
    attempt++;
  }
}


/**
 * Streaming sibling of apiFetch: returns the raw Response so the caller can read
 * response.body (e.g. a Server-Sent Events stream). Adds the Bearer token and
 * tenant prefix exactly like apiFetch, and performs a single silent token
 * refresh on 401. Unlike apiFetch it does NOT parse the body or throw on non-2xx
 * — the caller inspects response.status / response.body itself.
 */
export async function apiStream(path: string, options: ApiOptions = {}): Promise<Response> {
  const url = `${tenantApiBase(env.apiBaseUrl, path)}${path}`;

  const send = (token: string | null) => {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (options.auth !== false && token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store"
    });
  };

  let response = await send(tokenStore.get());

  if (response.status === 401 && typeof window !== "undefined" && !path.includes("/auth/")) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      tokenStore.set(newToken);
      response = await send(newToken);
    } else {
      tokenStore.clear();
      window.location.href = "/login";
      throw new Error("Session expired");
    }
  }

  return response;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const url = `${tenantApiBase(env.apiBaseUrl, path)}${path}`;

  const send = (token: string | null) => {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (options.auth !== false && token) headers.set("Authorization", `Bearer ${token}`);
    return fetchWithRetry(url, {
      ...options,
      headers,
      credentials: "include",
      cache: "no-store"
    });
  };

  let response = await send(tokenStore.get());

  // Silent refresh: on a 401 from a protected (non-auth) request, exchange the
  // refresh cookie for a new access token and retry the original request once.
  if (
    response.status === 401 &&
    typeof window !== "undefined" &&
    !path.includes("/auth/")
  ) {
    const peek = await response.clone().json().catch(() => null);
    if (peek?.error?.code !== "INVALID_PASSWORD") {
      const newToken = await refreshAccessToken();
      if (newToken) {
        tokenStore.set(newToken);
        response = await send(newToken);
      } else {
        tokenStore.clear();
        window.location.href = "/login";
        throw new Error("Session expired");
      }
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    if (response.status === 402 && payload?.error?.code === "SCHOOL_INACTIVE") {
      handleSuspendedTenant();
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
  const url = `${tenantApiBase(env.apiBaseUrl, path)}${path}`;

  const send = (token: string | null) => {
    const headers = new Headers(options.headers);
    if (options.auth !== false && token) headers.set("Authorization", `Bearer ${token}`);
    return fetchWithRetry(url, {
      ...options,
      method: options.method ?? "POST",
      headers,
      body,
      credentials: "include",
      cache: "no-store"
    });
  };

  let response = await send(tokenStore.get());

  if (
    response.status === 401 &&
    typeof window !== "undefined" &&
    !path.includes("/auth/")
  ) {
    const peek = await response.clone().json().catch(() => null);
    if (peek?.error?.code !== "INVALID_PASSWORD") {
      const newToken = await refreshAccessToken();
      if (newToken) {
        tokenStore.set(newToken);
        response = await send(newToken);
      } else {
        tokenStore.clear();
        window.location.href = "/login";
        throw new Error("Session expired");
      }
    }
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
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
      user: SessionUser;
    }>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ identifier, password })
    }),
  forgotPassword: (identifier: string) =>
    apiFetch<{ message: string; supportPhone: string; supportEmail: string }>("/auth/forgot-password", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ identifier })
    }),
  me: () => apiFetch<{ user: SessionUser }>("/auth/me"),
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" })
};

/// A school day is one of three things: the student came, did not come, or was
/// excused. LEAVE is that excused absence, worth nothing towards attendance.
export type AttendanceMarkStatus = "PRESENT" | "ABSENT" | "LEAVE";
/// Marking and reading offer the same three states; the alias is kept because
/// the attendance views refer to the read side by this name.
export type AttendanceReadStatus = AttendanceMarkStatus;

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

export type ClassStats = {
  attendancePercent: number | null;
  marksAveragePercent: number | null;
  feeCollectionPercent: number | null;
  attendanceWindowDays: number;
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
    leave: number;
    attended: number;
  };
};

export type AttendanceRoster = {
  date: string;
  className?: string;
  canEdit: boolean;
  session: { id: string; date: string } | null;
  students: {
    id: string;
    fullName: string;
    rollNumber: number | null;
    defaultStatus: AttendanceReadStatus;
    savedStatus?: AttendanceReadStatus;
  }[];
  isHoliday?: boolean;
  holidayReason?: string;
};

export type ClassMonthlyAttendance = {
  classId: string;
  className: string;
  month: string;
  totalStudents: number;
  days: {
    date: string;
    marked: boolean;
    total: number;
    present: number;
    attended: number;
    absent: number;
    leave: number;
    percentage: number;
    isHoliday?: boolean;
    holidayReason?: string;
  }[];
};

export type Holiday = {
  id: string;
  date: string;
  reason: string;
};

export type AttendanceDashboard = {
  totalClasses: number;
  markedClasses: number;
  pendingClasses: number;
  attendancePercentage: number;
  students: {
    present: number;
    absent: number;
    leave?: number;
    attended?: number;
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
  marked: boolean;
  present: number;
  absent: number;
  leave: number;
  attended: number;
  total: number;
  percentage: number;
  classTeacherName: string | null;
};

export type DailyAttendanceRow = {
  classId: string;
  className: string;
  totalStudents: number;
  marked: boolean;
  present: number;
  attended: number;
  absent: number;
  leave: number;
  attendancePercentage: number;
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
  sentBy?: {
    id: string;
    fullName: string;
    role: Role;
  } | null;
};

export type NotificationStats = {
  sentToday: number;
  failedCount: number;
  todaysUsage: number;
  creditsRemaining: number;
};

export type PaymentMode = "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "DD" | "ONLINE_GATEWAY" | "OTHER";
export type FeeComponent = "SCHOOL_FEE" | "TRANSPORTATION_FEE";

export type PaymentReferencePayload = {
  upiTransactionId?: string | null;
  chequeNumber?: string | null;
  ddNumber?: string | null;
  gatewayTransactionId?: string | null;
  bankReference?: string | null;
};

export type FeeAssignmentSummary = {
  id: string;
  studentId: string;
  totalAmount: string | number;
  transportFeeAmount?: string | number;
  paidAmount: string | number;
  pendingAmount: string | number;
  currentOutstanding?: number;
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
  totalOverdue: number;
  dueToDate: number;
  currentCollected: number;
  currentOutstanding: number;
  overdueInstallments: number;
  defaulterCount: number;
  topDefaulters: FeeAssignmentSummary[];
};

export type FeeStructure = {
  id: string;
  name: string;
  academicYear: string;
  frequency: "ANNUAL" | "QUARTERLY" | "MONTHLY" | "CUSTOM" | "BIANNUAL";
  totalAmount: string | number;
  dueDate?: string | null;
  isActive: boolean;
  class?: { id: string; name: string; section: string; academicYear?: string } | null;
  installments?: { id: string; name: string; dueDate: string; amount: string | number; sortOrder: number }[];
  _count?: { assignments: number };
};

export type FeeDefaulter = {
  studentId: string;
  name: string;
  class: string;
  feeStructureId?: string;
  feeStructure?: string;
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
  dueToDate: number;
  currentOutstanding: number;
  currentCollected: number;
  upcomingDue: number;
  status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
  assignments: {
    id: string;
    feeStructureId: string;
    transportFeeAmount?: string | number;
    total: number;
    paid: number;
    balance: number;
    currentlyDue: number;
    currentOutstanding: number;
    status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
    feeStructure: { name: string; dueDate?: string | null };
  }[];
  payments: {
    id: string;
    date: string;
    amount: string | number;
    feeComponent?: FeeComponent;
    mode: PaymentMode;
    upiTransactionId?: string | null;
    chequeNumber?: string | null;
    ddNumber?: string | null;
    gatewayTransactionId?: string | null;
    bankReference?: string | null;
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
    feeComponent?: FeeComponent;
    mode: PaymentMode;
    upiTransactionId?: string | null;
    chequeNumber?: string | null;
    ddNumber?: string | null;
    gatewayTransactionId?: string | null;
    bankReference?: string | null;
    receiptId: string | null;
    receiptNo: string | null;
    assignmentId: string;
    feeStructureId: string;
    feeStructureName: string;
    balanceAfter: number;
  }[];
  adjustments: {
    id: string;
    type: "CONCESSION" | "DISCOUNT";
    amount: number;
    reason: string;
    createdAt: string;
    assignmentId: string;
    feeStructureName: string;
    recordedBy: { id: string; fullName: string } | null;
  }[];
};

export type PaymentResult = {
  payment: { id: string; amount: string | number; feeComponent?: FeeComponent; mode: PaymentMode; paidAt: string } & PaymentReferencePayload;
  receipt: { id: string; receiptNo: string };
  ledger: { total: number; paid: number; balance: number; balanceAmount: number; status: string };
  receiptNotificationQueued?: boolean;
};

export type FeeAdjustmentResult = {
  adjustment: StudentFeeLedger["adjustments"][number];
  ledger: { total: number; paid: number; balance: number; balanceAmount: number; status: string };
};

export type StudentDetail = {
  id: string;
  classId: string;
  fullName: string;
  admissionNumber: string;
  rollNumber: number | null;
  dateOfBirth: string | null;
  gender: "MALE" | "FEMALE" | "OTHER" | null;
  profilePhotoUrl: string | null;
  parentName: string;
  parentPhone: string;
  alternatePhone: string | null;
  fatherName: string | null;
  fatherPhone: string | null;
  fatherOccupation: string | null;
  motherName: string | null;
  motherPhone: string | null;
  motherOccupation: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianOccupation: string | null;
  address: string | null;
  transportRequired?: boolean;
  transportFeeAmount?: string | number;
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
      pending: number;
    };
    currentStreak: number;
    classAverageStreak: number;
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
      status: "ON_TIME" | "LATE" | "MISSING" | "NOT_SUBMITTED" | "PENDING";
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
      leaves: number;
      attended: number;
      remainingBefore75: number;
      classAverageAttendance: number | null;
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
    recipientPhone?: string | null;
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
        role: "PRINCIPAL" | "ADMIN" | "TEACHER" | "ACCOUNTANT" | "PARENT";
      } | null;
    }[];
  };
  documents: {
    id: string;
    type: "CERTIFICATE" | "MEDICAL" | "PARENT_ID" | "AGREEMENT" | "AADHAAR" | "APAAR" | "BIRTH_CERTIFICATE" | "CASTE_CERTIFICATE" | "TRANSFER_CERTIFICATE" | "BONAFIDE" | "REPORT_CARD" | "PHOTO";
    name: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
    uploadedBy: {
      id: string;
      fullName: string;
      role: "PRINCIPAL" | "ADMIN" | "TEACHER" | "ACCOUNTANT" | "PARENT";
    };
  }[];
  editHistory: {
    id: string;
    action: string;
    summary: string;
    createdAt: string;
    beforeJson?: Record<string, unknown> | null;
    afterJson?: Record<string, unknown> | null;
    actor: {
      id: string;
      fullName: string;
      role: "PRINCIPAL" | "ADMIN" | "TEACHER" | "ACCOUNTANT" | "PARENT";
    } | null;
  }[];
  access: {
    role: "PRINCIPAL" | "ADMIN" | "TEACHER" | "ACCOUNTANT" | "PARENT";
    allowedTabs: Array<"academic" | "homework" | "attendance" | "fees" | "communication" | "behaviour" | "documents">;
  };
  siblings?: { id: string; fullName: string; class: { name: string; section: string }; profilePhotoUrl: string | null }[];
  class: { name: string; section: string };
  feeAssignments: {
    id: string;
    totalAmount: string | number;
    transportFeeAmount?: string | number;
    paidAmount: string | number;
    pendingAmount: string | number;
    status: "PENDING" | "PARTIAL" | "PAID" | "OVERDUE";
    feeStructure: { id: string; name: string; totalAmount: string | number };
    payments: {
      id: string;
      amount: string | number;
      feeComponent?: FeeComponent;
      mode: PaymentMode;
      upiTransactionId?: string | null;
      chequeNumber?: string | null;
      ddNumber?: string | null;
      gatewayTransactionId?: string | null;
      bankReference?: string | null;
      paidAt: string;
      receipt?: { id: string; receiptNo: string } | null;
    }[];
  }[];
  attendanceRecords: {
    id: string;
    status: AttendanceReadStatus;
    attendanceValue?: string | number | null;
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
  type: "CERTIFICATE" | "MEDICAL" | "PARENT_ID" | "AGREEMENT" | "AADHAAR" | "APAAR" | "BIRTH_CERTIFICATE" | "CASTE_CERTIFICATE" | "TRANSFER_CERTIFICATE" | "BONAFIDE" | "REPORT_CARD" | "PHOTO";
  name?: string;
  file: File;
};

export type HomeworkContext = {
  classes: {
    id: string;
    name: string;
    section: string;
    studentCount: number;
    subjects: { id: string; name: string }[];
  }[];
};

export type HomeworkAssignment = {
  id: string;
  classId: string;
  className: string;
  subjectId: string | null;
  subject: string;
  title: string;
  description: string | null;
  assignedDate: string;
  dueDate: string;
  status: "OPEN" | "OVERDUE" | "COMPLETED";
  submittedCount: number;
  lateCount: number;
  notSubmittedCount: number;
  totalStudents: number;
};

export type HomeworkSubmissionStatus = "ON_TIME" | "LATE" | "MISSING" | "NOT_SUBMITTED";

export type HomeworkAssignmentDetail = HomeworkAssignment & {
  submissions: {
    id: string;
    studentId: string;
    studentName: string;
    admissionNumber: string;
    rollNumber: number | null;
    status: HomeworkSubmissionStatus;
    marks: number | null;
    teacherNote: string | null;
    submittedAt: string | null;
  }[];
};

export type CreateHomeworkAssignmentPayload = {
  classId: string;
  subjectId?: string;
  subject?: string;
  title: string;
  description?: string;
  assignedDate?: string;
  dueDate: string;
};

export type MarksContext = {
  classes: {
    id: string;
    name: string;
    section: string;
    subjects: { id: string; name: string }[];
    students: { id: string; fullName: string; rollNumber: number | null }[];
  }[];
};

export type MarksExam = {
  id: string;
  classId: string | null;
  className: string;
  subjectId: string | null;
  subject: string;
  name: string;
  term: "UNIT_TEST" | "CLASS_TEST" | "MID_TERM" | "FINAL" | "TERM_1" | "TERM_2";
  maxMarks: number;
  passingMarks?: number | null;
  description?: string | null;
  date: string;
  status: "SCHEDULED" | "MARKS_ENTERED";
  enteredCount: number;
  pendingCount: number;
  classAverage: number;
};

export type MarksExamDetail = MarksExam & {
  students: {
    studentId: string;
    fullName: string;
    admissionNumber: string;
    rollNumber: number | null;
    result: {
      resultId: string;
      marks: number;
      percentage: number;
      grade: string;
      isAbsent: boolean;
    } | null;
  }[];
};

export type CreateMarksExamPayload = {
  classId: string;
  subjectId: string;
  name: string;
  term: MarksExam["term"];
  maxMarks: number;
  passingMarks?: number;
  description?: string;
  date: string;
  results: { studentId: string; marks: number; isAbsent?: boolean }[];
};

export type CommunicationMessageType =
  | "ATTENDANCE_ALERT"
  | "ABSENCE_NOTIFICATION"
  | "FEE_REMINDER"
  | "EXAM_ANNOUNCEMENT"
  | "PTM_INVITE"
  | "HOLIDAY_NOTICE"
  | "GENERIC_NOTICE"
  | "BIRTHDAY_WISH"
  | "HOMEWORK_REMINDER"
  | "CUSTOM";

export type CommunicationContext = {
  classes: {
    id: string;
    name: string;
    section: string;
    students: {
      id: string;
      fullName: string;
      admissionNumber: string;
      rollNumber: number | null;
      parentName: string;
      parentPhone: string;
    }[];
  }[];
};

export type TeacherCommunicationLog = {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  rollNumber: number | null;
  classId: string;
  className: string;
  message: string;
  type: CommunicationMessageType;
  status: "QUEUED" | "SENT" | "FAILED" | "COMPLETED" | "MISSED" | "NOTE";
  timestamp: string;
};

export type SendTeacherMessagePayload = {
  targetType: "STUDENT" | "CLASS";
  studentId?: string;
  classId?: string;
  type: CommunicationMessageType;
  message: string;
};

export type SendTeacherMessageResult = {
  targetType: "STUDENT" | "CLASS";
  count: number;
  logs: TeacherCommunicationLog[];
};

export type SchoolProfile = {
  id: string;
  name: string;
  code: string;
  city: string | null;
  state: string | null;
  phone: string | null;
  udiseNumber: string | null;
  affiliationBoard: string | null;
  logoUrl: string | null;
  timetablePeriodCount: number;
};

export type SchoolProfilePayload = Pick<SchoolProfile, "name" | "city" | "state" | "phone" | "udiseNumber" | "affiliationBoard" | "logoUrl" | "timetablePeriodCount">;

/** One period of the school bell, as 24-hour "HH:mm" wall-clock times. */
export type PeriodTime = { periodNumber: number; startTime: string; endTime: string };

export type PeriodTimes = { periodCount: number; periods: PeriodTime[] };

export type DatabaseDeletionStatus = {
  schoolId: string;
  dbName: string;
  deletionStatus: "NONE" | "PENDING" | "CANCELLED" | "DELETED" | "FAILED";
  deletionRequestedAt: string | null;
  deletionScheduledAt: string | null;
  deletionCancelledAt: string | null;
  deletionExecutedAt: string | null;
};

export type ActivityLog = {
  id: string;
  schoolId: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  summary: string;
  beforeJson: Record<string, unknown> | null;
  afterJson: Record<string, unknown> | null;
  createdAt: string;
  actor: {
    id: string;
    fullName: string;
    role: Role;
    phone?: string | null;
    email?: string | null;
  } | null;
};

export type ActivityLogResponse = {
  items: ActivityLog[];
  meta: {
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
  stats: {
    todayCount: number;
    totalCount: number;
    actorCount: number;
    entityTypes: { label: string; count: number }[];
    actions: { label: string; count: number }[];
  };
  filters: {
    actors: { id: string; fullName: string; role: Role }[];
    actions: string[];
    entityTypes: string[];
  };
};

function normalizeActivityLogResponse(response: ActivityLogResponse): ActivityLogResponse {
  const itemCount = Array.isArray(response.items) ? response.items.length : 0;
  const metaTotal = Number(response.meta?.total ?? 0);
  const statsTotal = Number(response.stats?.totalCount ?? 0);
  const total = Math.max(metaTotal, statsTotal, itemCount);
  const limit = Number(response.meta?.limit ?? 10) || 10;

  return {
    ...response,
    meta: {
      ...response.meta,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit))
    },
    stats: {
      ...response.stats,
      totalCount: total
    }
  };
}

export const classesApi = {
  list: (options?: { scope?: "classTeacher"; academicYearId?: string }) => {
    const params = new URLSearchParams();
    if (options?.scope) params.set("scope", options.scope);
    if (options?.academicYearId) params.set("academicYearId", options.academicYearId);
    const query = params.toString();
    return apiFetch<ClassSummary[]>(`/classes${query ? `?${query}` : ""}`);
  },
  students: (classId: string) => apiFetch<ClassStudent[]>(`/classes/${classId}/students`),
  stats: (classId: string) => apiFetch<ClassStats>(`/classes/${classId}/stats`)
};

export type AcademicYearStatus = "UPCOMING" | "ACTIVE" | "CLOSED";

export type AcademicYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: AcademicYearStatus;
  _count?: { classes: number };
};

export type RolloverClassProposal = {
  sourceClassId: string;
  name: string;
  section: string;
  studentCount: number;
  classTeacher: { id: string; fullName: string } | null;
  classTeacherId: string | null;
  proposedAction: "PROMOTE" | "GRADUATE";
  proposedTargetName: string | null;
  proposedTargetSection: string;
};

export type RolloverPreview = {
  currentYear: AcademicYear;
  targetName: string;
  targetDates: { startDate: string; endDate: string };
  classes: RolloverClassProposal[];
  arrears: { totalPending: number; studentCount: number };
};

export type RolloverMapping = {
  sourceClassId: string;
  action: "PROMOTE" | "GRADUATE";
  targetName?: string;
  targetSection?: string;
  classTeacherId?: string | null;
  heldBackStudentIds?: string[];
};

export type RolloverCommitPayload = {
  targetYear: { name: string; startDate?: string; endDate?: string };
  mappings: RolloverMapping[];
  setCurrent: boolean;
};

export type RolloverResult = {
  targetYear: AcademicYear;
  classesCreated: number;
  studentsPromoted: number;
  studentsHeldBack: number;
  studentsGraduated: number;
  arrearsCarried: number;
};

export const academicYearsApi = {
  list: () => apiFetch<AcademicYear[]>("/academic-years"),
  current: () => apiFetch<AcademicYear | null>("/academic-years/current"),
  create: (payload: { name: string; startDate: string; endDate: string }) =>
    apiFetch<AcademicYear>("/academic-years", { method: "POST", body: JSON.stringify(payload) }),
  rolloverPreview: (targetName?: string) =>
    apiFetch<RolloverPreview>("/academic-years/rollover/preview", { method: "POST", body: JSON.stringify({ targetName }) }),
  rolloverCommit: (payload: RolloverCommitPayload) =>
    apiFetch<RolloverResult>("/academic-years/rollover/commit", { method: "POST", body: JSON.stringify(payload) })
};

export const marksApi = {
  context: () => apiFetch<MarksContext>("/marks/context"),
  exams: (classId?: string) => {
    const params = new URLSearchParams();
    if (classId) params.set("classId", classId);
    const query = params.toString();
    return apiFetch<MarksExam[]>(`/marks/exams${query ? `?${query}` : ""}`);
  },
  exam: (examId: string) => apiFetch<MarksExamDetail>(`/marks/exams/${examId}`),
  createExam: (payload: CreateMarksExamPayload) =>
    apiFetch<MarksExam>("/marks/exams", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateExamResult: (examId: string, payload: { studentId: string; marks: number; isAbsent?: boolean }) =>
    apiFetch<MarksExamDetail["students"][number]>(`/marks/exams/${examId}/results`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    })
};

export const homeworkApi = {
  context: () => apiFetch<HomeworkContext>("/homework/context"),
  assignments: (classId?: string) => {
    const params = new URLSearchParams();
    if (classId) params.set("classId", classId);
    const query = params.toString();
    return apiFetch<HomeworkAssignment[]>(`/homework/assignments${query ? `?${query}` : ""}`);
  },
  createAssignment: (payload: CreateHomeworkAssignmentPayload) =>
    apiFetch<HomeworkAssignment>("/homework/assignments", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  assignment: (assignmentId: string) => apiFetch<HomeworkAssignmentDetail>(`/homework/assignments/${assignmentId}`),
  updateSubmission: (
    assignmentId: string,
    payload: { studentId: string; status: HomeworkSubmissionStatus; marks?: number | null; teacherNote?: string | null; submittedAt?: string | null }
  ) =>
    apiFetch<HomeworkAssignmentDetail["submissions"][number]>(`/homework/assignments/${assignmentId}/submissions`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  nudge: (assignmentId: string, studentId?: string) =>
    apiFetch<{ pending: number; sent: number }>(`/homework/assignments/${assignmentId}/nudge`, {
      method: "POST",
      body: JSON.stringify(studentId ? { studentId } : {})
    })
};

export const communicationApi = {
  context: () => apiFetch<CommunicationContext>("/communication/context"),
  messages: (classId?: string) => {
    const params = new URLSearchParams();
    if (classId) params.set("classId", classId);
    const query = params.toString();
    return apiFetch<TeacherCommunicationLog[]>(`/communication/messages${query ? `?${query}` : ""}`);
  },
  sendMessage: (payload: SendTeacherMessagePayload) =>
    apiFetch<SendTeacherMessageResult>("/communication/messages", {
      method: "POST",
      body: JSON.stringify(payload)
    })
};

export const settingsApi = {
  schoolProfile: () => apiFetch<SchoolProfile>("/settings/school-profile"),
  updateSchoolProfile: (payload: SchoolProfilePayload) =>
    apiFetch<SchoolProfile>("/settings/school-profile", {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  periodTimes: () => apiFetch<PeriodTimes>("/settings/period-times"),
  updatePeriodTimes: (periods: PeriodTime[]) =>
    apiFetch<PeriodTimes>("/settings/period-times", {
      method: "PUT",
      body: JSON.stringify({ periods })
    }),
  databaseDeletionStatus: () => apiFetch<DatabaseDeletionStatus>("/settings/database-deletion"),
  verifyDatabaseDeletionPassword: (password: string) =>
    apiFetch<{ verified: true }>("/settings/database-deletion/verify-password", {
      method: "POST",
      body: JSON.stringify({ password })
    }),
  requestDatabaseDeletion: (password: string) =>
    apiFetch<DatabaseDeletionStatus>("/settings/database-deletion/request", {
      method: "POST",
      body: JSON.stringify({ password })
    }),
  cancelDatabaseDeletion: (password: string) =>
    apiFetch<DatabaseDeletionStatus>("/settings/database-deletion/cancel", {
      method: "POST",
      body: JSON.stringify({ password })
    })
};

export const activityApi = {
  logs: (params?: { action?: string; actorId?: string; dateFrom?: string; dateTo?: string; entityType?: string; excludeEntityType?: string; limit?: number; page?: number; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.action) query.set("action", params.action);
    if (params?.actorId) query.set("actorId", params.actorId);
    if (params?.dateFrom) query.set("dateFrom", params.dateFrom);
    if (params?.dateTo) query.set("dateTo", params.dateTo);
    if (params?.entityType) query.set("entityType", params.entityType);
    if (params?.excludeEntityType) query.set("excludeEntityType", params.excludeEntityType);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.page) query.set("page", String(params.page));
    if (params?.search) query.set("search", params.search);
    const qs = query.toString();
    return apiFetch<ActivityLogResponse>(`/activity-logs${qs ? `?${qs}` : ""}`).then(normalizeActivityLogResponse);
  }
};

export const attendanceApi = {
  classToday: (classId: string) => apiFetch<ClassTodayAttendance>(`/attendance/class/${classId}/today`),
  roster: (classId: string, date: string) => {
    const params = new URLSearchParams({ classId, date });
    return apiFetch<AttendanceRoster>(`/attendance/roster?${params.toString()}`);
  },
  classMonth: (classId: string, month: string) => {
    const params = new URLSearchParams({ month });
    return apiFetch<ClassMonthlyAttendance>(`/attendance/class/${classId}/month?${params.toString()}`);
  },
  mark: (payload: { classId: string; date: string; records: { studentId: string; status: AttendanceMarkStatus }[] }) =>
    apiFetch("/attendance/mark", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  dashboard: (range?: { dateFrom?: string; dateTo?: string }) => {
    const params = new URLSearchParams();
    if (range?.dateFrom) params.set("dateFrom", range.dateFrom);
    if (range?.dateTo) params.set("dateTo", range.dateTo);
    const query = params.toString();
    return apiFetch<AttendanceDashboard>(`/attendance/dashboard${query ? `?${query}` : ""}`);
  },
  classesTodayReport: (range?: { dateFrom?: string; dateTo?: string }) => {
    const params = new URLSearchParams();
    if (range?.dateFrom) params.set("dateFrom", range.dateFrom);
    if (range?.dateTo) params.set("dateTo", range.dateTo);
    const query = params.toString();
    return apiFetch<ClassesTodayReportRow[]>(`/attendance/report/classes-today${query ? `?${query}` : ""}`);
  },
  daily: () => apiFetch<DailyAttendanceRow[]>("/attendance/daily"),
  nudgePendingTeachers: (range?: { dateFrom?: string; dateTo?: string }) => {
    const params = new URLSearchParams();
    if (range?.dateFrom) params.set("dateFrom", range.dateFrom);
    if (range?.dateTo) params.set("dateTo", range.dateTo);
    const query = params.toString();
    return apiFetch<{ pendingCount: number; sentCount: number }>(`/attendance/report/nudge-pending${query ? `?${query}` : ""}`, { method: "POST" });
  },
  listHolidays: (month: string) => {
    const params = new URLSearchParams({ month });
    return apiFetch<Holiday[]>(`/attendance/holidays?${params.toString()}`);
  },
  createHoliday: (date: string, reason: string) =>
    apiFetch<Holiday>("/attendance/holidays", {
      method: "POST",
      body: JSON.stringify({ date, reason })
    }),
  updateHoliday: (id: string, payload: { date: string; reason: string }) =>
    apiFetch<Holiday>(`/attendance/holidays/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteHoliday: (id: string) =>
    apiFetch<void>(`/attendance/holidays/${id}`, {
      method: "DELETE"
    })
};

export const feesApi = {
  dashboard: () => apiFetch<FeesDashboard>("/fees/dashboard"),
  defaulters: () => apiFetch<FeeDefaulter[]>("/fees/defaulters"),
  structures: () => apiFetch<FeeStructure[]>("/fees/structures"),
  updateStructure: (id: string, payload: Partial<Pick<FeeStructure, "name" | "academicYear" | "frequency" | "isActive">> & { totalAmount?: number; classId?: string | null; dueDate?: string }) =>
    apiFetch<FeeStructure>(`/fees/structures/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  duplicateStructure: (id: string) =>
    apiFetch<FeeStructure>(`/fees/structures/${id}/duplicate`, {
      method: "POST"
    }),
  archiveStructure: (id: string) =>
    apiFetch<FeeStructure>(`/fees/structures/${id}/archive`, {
      method: "POST"
    }),
  studentLedger: (studentId: string) => apiFetch<StudentFeeLedger>(`/fees/student/${studentId}`),
  recordPayment: (payload: { studentId: string; amount: number; feeComponent?: FeeComponent; mode: PaymentMode; paidAt?: string; sendReceiptOnWhatsApp?: boolean } & PaymentReferencePayload) =>
    apiFetch<PaymentResult>("/fees/payment", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  applyAdjustment: (payload: { studentId?: string; assignmentId?: string; type: "CONCESSION" | "DISCOUNT"; amount: number; reason: string }) =>
    apiFetch<FeeAdjustmentResult>("/fees/adjustments", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  receiptPdfBlob: async (receiptId: string) => {
    const token = tokenStore.get();
    const response = await fetch(`${tenantApiBase(env.apiBaseUrl)}/fees/receipts/${receiptId}/pdf`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    if (!response.ok) throw new Error("Failed to download receipt");
    return response.blob();
  },
  previewReceiptPdf: async (receiptId: string) => {
    const blob = await feesApi.receiptPdfBlob(receiptId);
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      URL.revokeObjectURL(url);
      throw new Error("Browser blocked receipt preview");
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  downloadReceiptPdf: async (receiptId: string, receiptNo?: string) => {
    const blob = await feesApi.receiptPdfBlob(receiptId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = receiptNo ? `receipt-${receiptNo}.pdf` : `receipt-${receiptId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  sendReceiptWhatsApp: (receiptId: string) =>
    apiFetch<{ success: boolean; receiptId: string; receiptNo: string; parentPhone: string }>(`/fees/receipts/${receiptId}/send-whatsapp`, {
      method: "POST"
    })
};

export const usersApi = {
  createAccountant: (payload: { fullName: string; email: string; password: string }) =>
    apiFetch<{ id: string; fullName: string; email: string; role: "ACCOUNTANT"; status: "ACTIVE" | "INACTIVE" }>("/users/accountants", {
      method: "POST",
      body: JSON.stringify(payload)
    })
};

export const whatsappApi = {
  logs: () => apiFetch<NotificationLog[]>("/wa/logs"),
  stats: (range?: { dateFrom?: string; dateTo?: string }) => {
    const params = new URLSearchParams();
    if (range?.dateFrom) params.set("dateFrom", range.dateFrom);
    if (range?.dateTo) params.set("dateTo", range.dateTo);
    const query = params.toString();
    return apiFetch<NotificationStats>(`/wa/stats${query ? `?${query}` : ""}`);
  },
  send: (payload: { phone: string; message: string }) =>
    apiFetch<{ success: boolean }>("/wa/send", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  retry: (id: string) => apiFetch<{ success: boolean }>(`/wa/logs/${id}/retry`, { method: "POST" }),
  delete: (id: string) => apiFetch<{ success: boolean }>(`/wa/logs/${id}`, { method: "DELETE" }),
  clear: () => apiFetch<{ success: boolean; count: number }>("/wa/logs", { method: "DELETE" })
};

export type StudentSearchItem = {
  id: string;
  fullName: string;
  admissionNumber: string;
  class?: { name: string; section: string } | null;
};

export type TeacherSearchItem = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
};

export const studentsApi = {
  get: (studentId: string) => apiFetch<StudentDetail>(`/students/${studentId}`),
  search: (term: string) =>
    apiFetch<{ items: StudentSearchItem[] }>(`/students?search=${encodeURIComponent(term)}&limit=5`),
  importStudents: (students: Array<Record<string, unknown>>) =>
    apiFetch<{ importedCount: number; students: StudentDetail[] }>("/students/import", {
      method: "POST",
      body: JSON.stringify({ students })
    }),
  uploadDocument: (studentId: string, payload: StudentDocumentUploadPayload) => {
    const formData = new FormData();
    formData.append("type", payload.type);
    if (payload.name) formData.append("name", payload.name);
    formData.append("file", payload.file);
    return apiFormFetch<StudentDetail["documents"][number]>(`/students/${studentId}/documents`, formData);
  },
  downloadDocument: async (studentId: string, documentId: string, filename: string) => {
    const token = tokenStore.get();
    const response = await fetch(`${tenantApiBase(env.apiBaseUrl)}/students/${studentId}/documents/${documentId}/download`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    if (!response.ok) throw new Error("Failed to download document");

    // S3 mode: backend returns a presigned URL as JSON. Navigate to it directly
    // (the object's Content-Disposition forces a download). Local-dev mode:
    // backend streams the file bytes, so fall back to a blob download.
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const { downloadUrl } = (await response.json()) as { downloadUrl: string };
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

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
  deleteDocument: (studentId: string, documentId: string) =>
    apiFetch<{ id: string }>(`/students/${studentId}/documents/${documentId}`, {
      method: "DELETE"
    }),
  createBehaviourRecord: (studentId: string, payload: BehaviourRecordPayload) =>
    apiFetch<StudentDetail["behaviourAnalytics"]["records"][number]>(`/students/${studentId}/behaviour`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateBehaviourAction: (studentId: string, recordId: string, payload: { actionTaken: string }) =>
    apiFetch<StudentDetail["behaviourAnalytics"]["records"][number]>(`/students/${studentId}/behaviour/${recordId}/action`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  reportCardPdfBlob: async (studentId: string) => {
    const token = tokenStore.get();
    const response = await fetch(`${tenantApiBase(env.apiBaseUrl, `/students/${studentId}/report-card/pdf`)}/students/${studentId}/report-card/pdf`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    if (!response.ok) throw new Error("Failed to download report card");
    return response.blob();
  },
  previewReportCardPdf: async (studentId: string) => {
    const blob = await studentsApi.reportCardPdfBlob(studentId);
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      URL.revokeObjectURL(url);
      throw new Error("Browser blocked report card preview");
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
  downloadReportCardPdf: async (studentId: string, studentName: string) => {
    const blob = await studentsApi.reportCardPdfBlob(studentId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-card-${studentName.toLowerCase().replace(/\s+/g, "-")}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

/** One weekly period in a teacher's timetable, as the profile renders it. */
export type TeacherPeriodAssignment = {
  id: string;
  dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";
  periodNumber: number;
  classId: string | null;
  subjectId: string | null;
  className: string;
  subjectName: string;
};

/** The full teacher record behind the Teacher Profile page. */
export type TeacherDetail = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string;
  status: string;
  academicBackground: string | null;
  createdAt: string;
  timetablePeriodCount: number;
  periodAssignments: TeacherPeriodAssignment[];
  classTeacherFor: { id: string; name: string; section: string }[];
};

export const teachersApi = {
  search: (term: string) =>
    apiFetch<{ items: TeacherSearchItem[] }>(`/users/teachers?search=${encodeURIComponent(term)}&limit=5`),
  get: (id: string) => apiFetch<TeacherDetail>(`/users/teachers/${id}`)
};

// --- Billing -----------------------------------------------------------------

export type BillingInterval = "MONTH" | "YEAR";
export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
export type InvoiceStatus = "DRAFT" | "DUE" | "PAID" | "VOID" | "REFUNDED";
export type PaymentState = "CREATED" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED";

export type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: string;
  interval: BillingInterval;
  intervalCount: number;
  trialDays: number;
  maxStudents: number | null;
  maxStaff: number | null;
  features: Record<string, boolean>;
  isActive: boolean;
  isPublic: boolean;
  sortOrder: number;
};

export type PaymentRow = {
  id: string;
  provider: string;
  gatewayMode: "MOCK" | "LIVE";
  providerOrderId: string | null;
  providerPaymentId: string | null;
  status: PaymentState;
  amountMinor: number;
  currency: string;
  method: string | null;
  failureReason: string | null;
  refundedMinor: number;
  capturedAt: string | null;
  createdAt: string;
};

export type Invoice = {
  id: string;
  number: string;
  schoolId: string;
  planCode: string;
  planName: string;
  status: InvoiceStatus;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  amountPaidMinor: number;
  couponCode: string | null;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  notes: string | null;
  payments: PaymentRow[];
};

export type BillingOverview = {
  school: { schoolId: string; schoolName: string; email: string; phone: string };
  subscription: {
    id: string;
    status: SubscriptionStatus;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    gracePeriodEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    daysRemaining: number;
    isExpired: boolean;
    couponCode: string | null;
  };
  plan: Plan;
  pricing: {
    listPriceMinor: number;
    effectivePriceMinor: number;
    isCustomPrice: boolean;
  };
  usage: {
    students: number;
    staff: number;
    maxStudents: number | null;
    maxStaff: number | null;
    studentsOverLimit: boolean;
    staffOverLimit: boolean;
  };
  openInvoice: Invoice | null;
  invoices: Invoice[];
  totals: { paidMinor: number; currency: string };
  gateway: { mode: "MOCK" | "LIVE"; keyId: string };
};

export type PriceQuote = {
  planCode: string;
  planName: string;
  currency: string;
  subtotalMinor: number;
  listPriceMinor: number;
  isCustomPrice: boolean;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxPercent: number;
  couponCode: string | null;
  couponValid: boolean;
  couponMessage: string;
};

export type CheckoutSession = {
  mode: "MOCK" | "LIVE";
  keyId: string;
  orderId: string;
  paymentId: string;
  amountMinor: number;
  currency: string;
  invoice: {
    id: string;
    number: string;
    planCode: string;
    planName: string;
    subtotalMinor: number;
    discountMinor: number;
    taxMinor: number;
    totalMinor: number;
    periodStart: string;
    periodEnd: string;
  };
  school: { schoolId: string; schoolName: string; email: string; phone: string };
};

export type MockPayResult = {
  status: "success";
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export const billingApi = {
  overview: () => apiFetch<BillingOverview>("/billing/overview"),
  plans: () => apiFetch<Plan[]>("/billing/plans"),
  quote: (planCode: string, couponCode?: string) =>
    apiFetch<PriceQuote>(
      `/billing/quote?planCode=${encodeURIComponent(planCode)}${couponCode ? `&couponCode=${encodeURIComponent(couponCode)}` : ""}`
    ),
  invoice: (invoiceId: string) => apiFetch<Invoice>(`/billing/invoices/${invoiceId}`),
  downloadInvoicePdf: async (invoiceId: string, invoiceNumber: string) => {
    const token = tokenStore.get();
    const path = `/billing/invoices/${invoiceId}/pdf`;
    const response = await fetch(`${tenantApiBase(env.apiBaseUrl, path)}${path}`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    if (!response.ok) throw new Error("Failed to download invoice");
    const url = URL.createObjectURL(await response.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${invoiceNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  checkout: (planCode: string, couponCode?: string | null) =>
    apiFetch<CheckoutSession>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ planCode, couponCode: couponCode || null })
    }),
  confirm: (payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    apiFetch<{ status: "PAID"; alreadyCaptured: boolean; invoice: Invoice }>("/billing/checkout/confirm", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  setAutoRenew: (autoRenew: boolean) =>
    apiFetch<unknown>("/billing/auto-renew", { method: "PATCH", body: JSON.stringify({ autoRenew }) }),
  /** Mock-gateway only: stands in for the Razorpay checkout popup. */
  mockPay: (orderId: string, outcome: "success" | "failure", method: string) =>
    apiFetch<MockPayResult>("/billing/mock-gateway/pay", {
      method: "POST",
      body: JSON.stringify({ orderId, outcome, method })
    })
};

export function formatMinor(minor: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(minor / 100);
}

export type SalarySlipStatus = "PENDING" | "PAID";

/** A recorded monthly pay slip. Money is in rupees; netPay = basic + allowances - deductions. */
export type SalarySlip = {
  id: string;
  userId: string;
  month: string;
  basicPay: number;
  allowances: number;
  deductions: number;
  netPay: number;
  status: SalarySlipStatus;
  paidOn: string | null;
  note: string | null;
  updatedAt: string;
};

export type SalarySlipPayload = {
  userId: string;
  month: string;
  basicPay: number;
  allowances: number;
  deductions: number;
  status: SalarySlipStatus;
  paidOn?: string | null;
  note?: string | null;
};

export type PayrollMonth = {
  month: string;
  items: {
    user: { id: string; fullName: string; role: Role; phone: string };
    canEdit: boolean;
    slip: SalarySlip | null;
  }[];
  summary: { staff: number; recorded: number; paid: number; pending: number; totalNetPay: number };
};

export type MySalarySlips = {
  items: SalarySlip[];
  summary: { latest: SalarySlip | null; paidThisYear: number; year: number };
};

export const payrollApi = {
  mySlips: () => apiFetch<MySalarySlips>("/payroll/me/slips"),
  month: (month: string) => apiFetch<PayrollMonth>(`/payroll/slips?month=${encodeURIComponent(month)}`),
  save: (payload: SalarySlipPayload) =>
    apiFetch<SalarySlip>("/payroll/slips", { method: "PUT", body: JSON.stringify(payload) }),
  remove: (id: string) => apiFetch<void>(`/payroll/slips/${id}`, { method: "DELETE" })
};

export type TransportVehicle = {
  id: string;
  registrationNumber: string;
  capacity: number;
  driverName: string | null;
  driverPhone: string | null;
};

export type TransportStop = {
  id: string;
  sequence: number;
  name: string;
  pickupTime: string | null;
  dropTime: string | null;
};

export type TransportOverview = {
  summary: { routes: number; vehicles: number; studentsOnTransport: number; seats: number };
  routes: { id: string; name: string; vehicle: TransportVehicle | null; stops: TransportStop[]; studentCount: number }[];
  vehicles: (TransportVehicle & { routes: { id: string; name: string }[] })[];
};

export type TransportRouteDetail = {
  id: string;
  name: string;
  vehicle: TransportVehicle | null;
  stops: TransportStop[];
  students: {
    id: string;
    fullName: string;
    admissionNumber: string;
    parentPhone: string;
    transportRequired: boolean;
    className: string;
    stopId: string | null;
  }[];
};

export type TransportVehiclePayload = {
  registrationNumber: string;
  capacity: number;
  driverName: string | null;
  driverPhone: string | null;
};

/** Stops in travel order; a stop sent with its id keeps its riders. */
export type TransportRoutePayload = {
  name: string;
  vehicleId: string | null;
  stops: { id?: string; name: string; pickupTime: string | null; dropTime: string | null }[];
};

export type TransportReportStudent = {
  id: string;
  fullName: string;
  admissionNumber: string;
  parentPhone: string;
  className: string;
};

export type TransportReport = {
  summary: {
    routes: number;
    studentsOnTransport: number;
    routesOverCapacity: number;
    routesWithoutVehicle: number;
    needsRoute: number;
    notMarked: number;
  };
  routes: {
    id: string;
    name: string;
    vehicle: TransportVehicle | null;
    students: number;
    capacity: number | null;
    occupancy: number | null;
    overCapacity: boolean;
    withoutStop: number;
    stops: (TransportStop & { students: number })[];
  }[];
  needsRoute: TransportReportStudent[];
  notMarked: (TransportReportStudent & { routeName: string | null })[];
};

export const transportApi = {
  overview: () => apiFetch<TransportOverview>("/transport"),
  report: () => apiFetch<TransportReport>("/transport/report"),
  route: (id: string) => apiFetch<TransportRouteDetail>(`/transport/routes/${id}`),
  createVehicle: (payload: TransportVehiclePayload) =>
    apiFetch<TransportVehicle>("/transport/vehicles", { method: "POST", body: JSON.stringify(payload) }),
  updateVehicle: (id: string, payload: TransportVehiclePayload) =>
    apiFetch<TransportVehicle>(`/transport/vehicles/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  removeVehicle: (id: string) => apiFetch<void>(`/transport/vehicles/${id}`, { method: "DELETE" }),
  createRoute: (payload: TransportRoutePayload) =>
    apiFetch<TransportRouteDetail>("/transport/routes", { method: "POST", body: JSON.stringify(payload) }),
  updateRoute: (id: string, payload: TransportRoutePayload) =>
    apiFetch<TransportRouteDetail>(`/transport/routes/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  removeRoute: (id: string) => apiFetch<void>(`/transport/routes/${id}`, { method: "DELETE" }),
  assign: (payload: { studentIds: string[]; routeId: string; stopId: string | null }) =>
    apiFetch<{ assigned: number }>("/transport/assignments", { method: "POST", body: JSON.stringify(payload) }),
  unassign: (studentId: string) => apiFetch<void>(`/transport/assignments/${studentId}`, { method: "DELETE" })
};

/** The same punch the teacher app's Swipe To Punch records. */
export type PunchStatus = {
  date: string;
  /** ON_BREAK: punched in earlier, paused, not done for the day. */
  state: "NOT_PUNCHED_IN" | "PUNCHED_IN" | "ON_BREAK" | "PUNCHED_OUT";
  punchInAt: string | null;
  punchOutAt: string | null;
  workedMinutes: number;
  breakMinutes: number;
};

export type MySchedulePeriod = {
  periodNumber: number;
  className: string;
  subjectName: string;
  startTime: string | null;
  endTime: string | null;
};

export const teacherDayApi = {
  punchStatus: () => apiFetch<PunchStatus>("/staff-attendance/me/today"),
  // Punch in also resumes from a break and re-opens a day punched out by mistake.
  punchIn: () => apiFetch<PunchStatus>("/staff-attendance/me/punch-in", { method: "POST" }),
  startBreak: () => apiFetch<PunchStatus>("/staff-attendance/me/break", { method: "POST" }),
  punchOut: () => apiFetch<PunchStatus>("/staff-attendance/me/punch-out", { method: "POST" }),
  schedule: () => apiFetch<{ dayOfWeek: string; periods: MySchedulePeriod[] }>("/users/me/schedule")
};

export type StaffDayStatus = "PRESENT" | "ON_LEAVE" | "NOT_PUNCHED_IN";

/** One break between two work sessions. */
export type StaffBreak = { startAt: string; endAt: string | null; minutes: number };

/** Every active teacher on one day, not-in first — the principal app's Teacher Attendance. */
export type StaffDay = {
  date: string;
  isSunday: boolean;
  holiday: string | null;
  total: number;
  present: number;
  onLeave: number;
  notPunchedIn: number;
  staff: Array<{
    id: string;
    fullName: string;
    phone: string;
    status: StaffDayStatus;
    leaveType: string | null;
    punchInAt: string | null;
    punchOutAt: string | null;
    onBreak: boolean;
    /** This day's breaks, in the order they were taken. `endAt` is null while
     * one is still running. A break left open on a past day is left out. */
    breaks: StaffBreak[];
    /** The sum of `breaks`, so the two always agree. */
    breakMinutes: number;
    /** Whether the day's first punch-in carried a selfie. The image itself is
     * fetched on demand, so a day list never signs a URL nobody opens. */
    hasSelfie: boolean;
    /** Null for a punch left open on a past day: its hours are unknown. */
    workedMinutes: number | null;
  }>;
};

/** One staff member's month of working days — the app's Teacher Profile tiles. */
export type StaffMonthDayStatus =
  | "PRESENT"
  | "ABSENT"
  | "LEAVE"
  | "HOLIDAY"
  | "SUNDAY"
  | "TODAY"
  | "FUTURE"
  | "NONE";

export type StaffMonthSummary = {
  month: string;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  absentDays: number;
  /** Null when the month has no working days yet, so there is nothing to divide by. */
  percentage: number | null;
  /** One entry per calendar day of the month, for the profile's calendar grid. */
  days: { date: string; status: StaffMonthDayStatus }[];
};

export const staffAttendanceApi = {
  day: (date: string) => apiFetch<StaffDay>(`/staff-attendance/day?date=${encodeURIComponent(date)}`),
  userSummary: (userId: string, month: string) =>
    apiFetch<StaffMonthSummary>(`/staff-attendance/users/${userId}/summary?month=${encodeURIComponent(month)}`),
  /** Resolves to a URL an <img> can load. `revoke` is true when that URL is an
   * object URL the caller owns and must release. */
  punchSelfie: async (userId: string, date: string): Promise<{ url: string; revoke: boolean }> => {
    const token = tokenStore.get();
    const response = await fetch(
      `${tenantApiBase(env.apiBaseUrl)}/staff-attendance/users/${userId}/selfie?date=${encodeURIComponent(date)}`,
      { credentials: "include", headers: token ? { Authorization: `Bearer ${token}` } : undefined }
    );
    if (!response.ok) throw new Error("Could not open this selfie");

    // S3 mode returns a presigned URL as JSON; local mode streams the image.
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const { url } = (await response.json()) as { url: string };
      return { url, revoke: false };
    }
    return { url: URL.createObjectURL(await response.blob()), revoke: true };
  }
};

export const leaveTypes = ["CASUAL", "SICK", "EARNED", "MATERNITY", "UNPAID", "OTHER"] as const;
export type LeaveType = (typeof leaveTypes)[number];
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

/** One leave request, the same row both apps render. */
export type LeaveRequest = {
  id: string;
  type: LeaveType;
  status: LeaveStatus;
  fromDate: string;
  toDate: string;
  /** Inclusive, so a single-day leave is 1. */
  days: number;
  reason: string;
  attachmentName: string | null;
  hasAttachment: boolean;
  appliedOn: string;
  decidedAt: string | null;
  decisionNote: string | null;
  applicant: { id: string; fullName: string; role: Role; phone: string };
  decidedBy: { id: string; fullName: string } | null;
};

/** School-wide counts, so the tiles cannot drift out of step with the list. */
export type LeaveSummary = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
};

export type LeavePage = {
  items: LeaveRequest[];
  total: number;
  hasMore: boolean;
  summary: LeaveSummary;
};

export type LeaveListQuery = {
  status?: LeaveStatus;
  search?: string;
  userId?: string;
  limit?: number;
  offset?: number;
};

function leaveQuery({ status, search, userId, limit = 20, offset = 0 }: LeaveListQuery) {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  if (userId) params.set("userId", userId);
  return params.toString();
}

export const leaveApi = {
  /** Every request in the school — the principal's Leave Approval queue. */
  schoolRequests: (query: LeaveListQuery = {}) => apiFetch<LeavePage>(`/leave/requests?${leaveQuery(query)}`),
  myRequests: (query: LeaveListQuery = {}) => apiFetch<LeavePage>(`/leave/requests/me?${leaveQuery(query)}`),
  apply: (payload: { type: LeaveType; fromDate: string; toDate: string; reason: string; attachment?: File | null }) => {
    const formData = new FormData();
    formData.append("type", payload.type);
    formData.append("fromDate", payload.fromDate);
    formData.append("toDate", payload.toDate);
    formData.append("reason", payload.reason);
    if (payload.attachment) formData.append("attachment", payload.attachment);
    return apiFormFetch<LeaveRequest>("/leave/requests", formData);
  },
  decide: (id: string, payload: { status: "APPROVED" | "REJECTED"; note?: string }) =>
    apiFetch<LeaveRequest>(`/leave/requests/${id}/decision`, { method: "PATCH", body: JSON.stringify(payload) }),
  cancel: (id: string) => apiFetch<LeaveRequest>(`/leave/requests/${id}/cancel`, { method: "PATCH" }),
  /**
   * Same split as student documents: S3 answers with a presigned URL to open,
   * the local dev fallback streams the bytes.
   */
  downloadAttachment: async (id: string, fileName: string) => {
    const token = tokenStore.get();
    const path = `/leave/requests/${id}/attachment`;
    const response = await fetch(`${tenantApiBase(env.apiBaseUrl, path)}${path}`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
    if (!response.ok) throw new Error("Failed to download attachment");

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const { downloadUrl } = (await response.json()) as { downloadUrl: string };
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
};

/** A child-leave request raised by a parent from the Parent app. */
export type StudentLeaveRequest = {
  id: string;
  fromDate: string;
  toDate: string;
  /** Inclusive, so a single-day leave is 1. */
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
  requestedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  decidedBy: { id: string; fullName: string } | null;
  student: {
    id: string;
    fullName: string;
    rollNumber: string | null;
    admissionNumber: string;
    className: string | null;
  };
};

export type StudentLeavePage = {
  items: StudentLeaveRequest[];
  total: number;
  hasMore: boolean;
  summary: Record<LeaveStatus, number>;
};

export const studentLeaveApi = {
  /** The office queue of parent-raised child-leave requests. */
  requests: (query: { status?: LeaveStatus; limit?: number; offset?: number } = {}) => {
    const params = new URLSearchParams({
      limit: String(query.limit ?? 20),
      offset: String(query.offset ?? 0)
    });
    if (query.status) params.set("status", query.status);
    return apiFetch<StudentLeavePage>(`/student-leave/requests?${params.toString()}`);
  },
  decide: (id: string, payload: { status: "APPROVED" | "REJECTED"; note?: string }) =>
    apiFetch<StudentLeaveRequest>(`/student-leave/requests/${id}/decision`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    })
};

// --- Inventory ---------------------------------------------------------------

export type InventoryItemType = "CONSUMABLE" | "ASSET";
export type InventoryTxnType = "PURCHASE" | "ISSUE" | "ADJUSTMENT";

export type InventoryCategory = { id: string; name: string; itemCount: number };

export type InventoryVendor = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  notes: string | null;
  purchaseCount: number;
};

export type InventoryItem = {
  id: string;
  name: string;
  sku: string | null;
  type: InventoryItemType;
  unit: string;
  quantity: number;
  reorderLevel: number;
  lastUnitCost: number | null;
  stockValue: number | null;
  lowStock: boolean;
  location: string | null;
  notes: string | null;
  isActive: boolean;
  category: { id: string; name: string } | null;
};

export type InventoryTransaction = {
  id: string;
  type: InventoryTxnType;
  quantityDelta: number;
  balanceAfter: number;
  unitCost: number | null;
  totalCost: number | null;
  invoiceNumber: string | null;
  issuedTo: string | null;
  reason: string | null;
  note: string | null;
  occurredAt: string;
  vendor: { id: string; name: string } | null;
  recordedBy: { id: string; fullName: string; role: Role } | null;
  item: { id: string; name: string; unit: string };
};

export type InventoryItemDetail = InventoryItem & { transactions: InventoryTransaction[] };

export type InventoryOverview = {
  summary: {
    items: number;
    consumables: number;
    assets: number;
    lowStock: number;
    outOfStock: number;
    stockValue: number;
    vendors: number;
  };
  lowStockItems: InventoryItem[];
  recentTransactions: InventoryTransaction[];
};

export type InventoryReport = {
  range: { from: string | null; to: string | null };
  summary: {
    items: number;
    stockValue: number;
    lowStock: number;
    purchaseCount: number;
    purchaseSpend: number;
    issueCount: number;
    issuedUnits: number;
  };
  stockByCategory: { categoryId: string | null; name: string; items: number; quantity: number; stockValue: number }[];
  purchasesByVendor: { vendorId: string | null; name: string; purchases: number; spend: number }[];
  topIssuedItems: { itemId: string; name: string; unit: string; quantity: number }[];
  lowStockItems: InventoryItem[];
};

export type InventoryItemPayload = {
  name: string;
  categoryId: string | null;
  sku: string | null;
  type: InventoryItemType;
  unit: string;
  reorderLevel: number;
  location: string | null;
  notes: string | null;
  isActive?: boolean;
  openingQuantity?: number;
  openingUnitCost?: number | null;
};

export type InventoryVendorPayload = {
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address: string | null;
  notes: string | null;
};

export type InventoryTransactionPayload = {
  type: InventoryTxnType;
  quantity?: number;
  quantityDelta?: number;
  unitCost?: number | null;
  totalCost?: number | null;
  vendorId?: string | null;
  invoiceNumber?: string | null;
  issuedTo?: string | null;
  reason?: string | null;
  note?: string | null;
  occurredAt?: string;
};

export type InventoryItemFilters = {
  search?: string;
  categoryId?: string;
  type?: InventoryItemType;
  lowStock?: boolean;
  includeInactive?: boolean;
};

export type InventoryTransactionFilters = {
  type?: InventoryTxnType;
  itemId?: string;
  vendorId?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export const inventoryApi = {
  overview: () => apiFetch<InventoryOverview>("/inventory"),
  report: (range?: { from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (range?.from) params.set("from", range.from);
    if (range?.to) params.set("to", range.to);
    const query = params.toString();
    return apiFetch<InventoryReport>(`/inventory/report${query ? `?${query}` : ""}`);
  },

  categories: () => apiFetch<InventoryCategory[]>("/inventory/categories"),
  createCategory: (payload: { name: string }) =>
    apiFetch<{ id: string; name: string }>("/inventory/categories", { method: "POST", body: JSON.stringify(payload) }),
  updateCategory: (id: string, payload: { name: string }) =>
    apiFetch<{ id: string; name: string }>(`/inventory/categories/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  removeCategory: (id: string) => apiFetch<void>(`/inventory/categories/${id}`, { method: "DELETE" }),

  vendors: () => apiFetch<InventoryVendor[]>("/inventory/vendors"),
  createVendor: (payload: InventoryVendorPayload) =>
    apiFetch<InventoryVendor>("/inventory/vendors", { method: "POST", body: JSON.stringify(payload) }),
  updateVendor: (id: string, payload: InventoryVendorPayload) =>
    apiFetch<InventoryVendor>(`/inventory/vendors/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  removeVendor: (id: string) => apiFetch<void>(`/inventory/vendors/${id}`, { method: "DELETE" }),

  items: (filters: InventoryItemFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.categoryId) params.set("categoryId", filters.categoryId);
    if (filters.type) params.set("type", filters.type);
    if (filters.lowStock) params.set("lowStock", "true");
    if (filters.includeInactive) params.set("includeInactive", "true");
    const query = params.toString();
    return apiFetch<InventoryItem[]>(`/inventory/items${query ? `?${query}` : ""}`);
  },
  item: (id: string) => apiFetch<InventoryItemDetail>(`/inventory/items/${id}`),
  createItem: (payload: InventoryItemPayload) =>
    apiFetch<InventoryItem>("/inventory/items", { method: "POST", body: JSON.stringify(payload) }),
  updateItem: (id: string, payload: InventoryItemPayload) =>
    apiFetch<InventoryItem>(`/inventory/items/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  removeItem: (id: string) => apiFetch<void>(`/inventory/items/${id}`, { method: "DELETE" }),
  recordTransaction: (itemId: string, payload: InventoryTransactionPayload) =>
    apiFetch<{ item: InventoryItem; transaction: InventoryTransaction }>(`/inventory/items/${itemId}/transactions`, {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  transactions: (filters: InventoryTransactionFilters = {}) => {
    const params = new URLSearchParams();
    if (filters.type) params.set("type", filters.type);
    if (filters.itemId) params.set("itemId", filters.itemId);
    if (filters.vendorId) params.set("vendorId", filters.vendorId);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    if (filters.limit) params.set("limit", String(filters.limit));
    const query = params.toString();
    return apiFetch<InventoryTransaction[]>(`/inventory/transactions${query ? `?${query}` : ""}`);
  }
};
