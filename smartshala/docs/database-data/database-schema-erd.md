# Database Schema / ERD

**Database**: PostgreSQL 14+ on Neon (serverless)
**ORM**: Prisma ^5.22.0
**Schema file**: `backend/prisma/schema.prisma` (766 lines)
**Master schema**: `backend/prisma/master/schema.prisma` (120 lines)

#### Tenant Database Models (23 models)

| Model | Table Name | Purpose | Key Relations |
|-------|-----------|---------|---------------|
| `School` | `schools` | Root tenant entity | All other models reference this |
| `User` | `users` | Staff accounts (Principal, Admin, Teacher, Accountant) | → School, classes, subjects |
| `RefreshToken` | `refresh_tokens` | JWT refresh token persistence | → User |
| `Class` | `classes` | Class-section-year combination | → School, Teacher (classTeacher), Students |
| `Student` | `students` | Student records | → School, Class |
| `AuditLog` | `audit_logs` | Immutable audit trail | → School, User (actor) |
| `CommunicationLog` | `communication_logs` | WhatsApp/call/note audit | → School, Student |
| `BehaviourRecord` | `behaviour_records` | Incidents, achievements, counsellor notes | → School, Student, User |
| `StudentDocument` | `student_documents` | Uploaded documents (Aadhaar, certificates, etc.) | → School, Student, User |
| `Subject` | `subjects` | Class subjects with teacher assignment | → School, Class, User (teacher) |
| `TeacherPeriodAssignment` | `teacher_period_assignments` | Timetable (day + period → class + subject) | → School, User, Class, Subject |
| `Exam` | `exams` | Exam definitions (Unit Test, Mid-Term, Final) | → School, Class, Subject |
| `ExamResult` | `exam_results` | Per-student marks with grade and percentage | → School, Student, Exam, Subject |
| `HomeworkRecord` | `homework_records` | Legacy homework tracking | → School, Student, Subject |
| `HomeworkAssignment` | `homework_assignments` | Class-wide homework assignments | → School, Class, Subject, User |
| `HomeworkSubmission` | `homework_submissions` | Per-student submission tracking | → School, Assignment, Student |
| `AttendanceSession` | `attendance_sessions` | One class on one date | → School, Class, User (markedBy) |
| `AttendanceRecord` | `attendance_records` | Per-student attendance | → Session, Student |
| `FeeStructure` | `fee_structures` | Annual/quarterly/monthly/custom fee plans | → School, Class |
| `FeeInstallment` | `fee_installments` | Installment breakdown with due dates | → FeeStructure |
| `StudentFeeAssignment` | `student_fee_assignments` | Student fee ledger (total, paid, pending) | → School, Student, FeeStructure |
| `Payment` | `payments` | Payment records with mode-specific references | → School, Student, Assignment, Installment, User |
| `FeeAdjustment` | `fee_adjustments` | Concessions and discounts | → School, Student, Assignment, User |
| `Receipt` | `receipts` | Auto-numbered receipts linked to payments | → School, Payment |
| `Notification` | `notifications` | WhatsApp notification queue/log | → School, Student, User |

#### Master Database Models (4 models)

| Model | Table Name | Purpose |
|-------|-----------|---------|
| `School` | `schools` | Tenant registry (schoolId, dbUrl, plan, trial, deletion status) |
| `PasswordResetRequest` | `password_reset_requests` | Staff password reset requests for super admin |
| `Coupon` | `coupons` | Discount coupons for onboarding |
| `OnboardingLog` | `onboarding_logs` | Onboarding event audit |

#### Enums (19 enums)

`UserRole` (PRINCIPAL, ADMIN, TEACHER, ACCOUNTANT, PARENT), `UserStatus`, `Gender`, `AttendanceStatus` (PRESENT, ABSENT, LATE, HALF_DAY), `FeeFrequency`, `InstallmentStatus`, `PaymentMode` (CASH, UPI, BANK_TRANSFER, CHEQUE, DD, ONLINE_GATEWAY, OTHER), `FeeComponent`, `FeeAdjustmentType`, `ExamTerm`, `NotificationKind`, `NotificationStatus`, `HomeworkSubmissionStatus`, `CommunicationType`, `CommunicationChannel`, `CommunicationStatus`, `CommunicationMessageType`, `BehaviourType`, `BehaviourSeverity`, `StudentDocumentType` (CERTIFICATE, MEDICAL, AADHAAR, APAAR, BIRTH_CERTIFICATE, CASTE_CERTIFICATE, TRANSFER_CERTIFICATE, BONAFIDE, REPORT_CARD, PHOTO, etc.)
