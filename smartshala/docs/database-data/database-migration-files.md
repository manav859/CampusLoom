# Database Migration Files

29 migrations in `backend/prisma/migrations/` (chronological):

| Migration | Description |
|-----------|-------------|
| `20260421000000_day1_foundation` | Core schema: School, User, Class, Student, Attendance, Fees, Payments, Receipts, Notifications |
| `20260423000000_fee_management_indexes` | Performance indexes for fee queries |
| `20260501000000_student_performance_metric` | Performance rate, classification fields |
| `20260501001000_academic_analytics_models` | Exam, ExamResult, Subject models |
| `20260501002000_homework_tracking` | HomeworkAssignment, HomeworkSubmission |
| `20260502000000_communication_logs` | CommunicationLog model |
| `20260502001000_behaviour_tracking` | BehaviourRecord model |
| `20260502002000_student_document_storage` | StudentDocument model |
| `20260502003000_role_based_access` | Role-based query indexes |
| `20260502004000_teacher_homework_management` | Homework management enhancements |
| `20260503000000_teacher_marks_module` | Marks module refinements |
| `20260503003000_teacher_communication_module` | Communication enhancements |
| `20260504001000_subject_teacher_assignments` | Subject-teacher link |
| `20260504002000_teacher_period_assignments` | Timetable model |
| `20260506000000_homework_assignment_owner` | `assignedById` on HomeworkAssignment |
| `20260508000000_performance_indexes` | Query optimization indexes |
| `20260514000000_payment_references` | UPI, cheque, DD, gateway reference fields |
| `20260514001000_half_day_attendance` | Half-day attendance value (0.5) |
| `20260514002000_whatsapp_template_types` | Communication message type enum |
| `20260515000000_audit_logs` | AuditLog model |
| `20260515001000_guardian_details` | Mother, father, guardian detail fields |
| `20260516000000_exam_term` | ExamTerm enum (UNIT_TEST, MID_TERM, FINAL, etc.) |
| `20260516001000_school_profile_fields` | GSTIN, U-DISE, affiliation board, logo |
| `20260516002000_fee_adjustments` | FeeAdjustment model (concessions/discounts) |
| `20260518010000_class_form_metadata` | Class metadata (stream, medium, max strength) |
| `20260520000000_weekday_timetable_settings` | Timetable period count setting |
| `20260522093000_transport_fee` | Transport fee fields |
| `20260525000000_notification_sent_by` | Notification sender tracking |
| `20260525000001_student_profile_photo` | Student photo URL field |

Master DB migrations at `backend/prisma/master/migrations/`.

**Run Migrations**: `cd backend && npx prisma migrate dev`
**Deploy Migrations**: `cd backend && npx prisma migrate deploy`
