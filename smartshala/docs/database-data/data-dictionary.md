# Data Dictionary

| Field Pattern | Type | Usage |
|--------------|------|-------|
| `*Id` | UUID (String) | All primary keys are UUIDs |
| `schoolId` | UUID (FK) | Tenant isolation — every business record carries this |
| `*Amount` / `totalAmount` / `paidAmount` | Decimal(12,2) | Currency values in INR |
| `attendanceValue` | Decimal(3,2) | `1.00` = Present/Late, `0.50` = Half Day, `0.00` = Absent |
| `percentage` | Decimal(5,2) | Exam/attendance percentages |
| `marksObtained` / `maxMarks` | Decimal(6,2) | Exam marks |
| `*Hash` (passwordHash, tokenHash) | String | bcrypt hashed values |
| `createdAt` / `updatedAt` | DateTime | Auto-managed timestamps |
| `isActive` | Boolean | Soft delete flag |
| `status` | Enum | State machine (PENDING → PARTIAL → PAID, etc.) |
