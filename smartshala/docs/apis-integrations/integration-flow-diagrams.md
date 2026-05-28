# Integration Flow Diagrams

#### School Onboarding Flow
```
User fills form on /onboard
         │
         ▼
POST /api/onboarding
         │
         ├── Validate input (Zod)
         ├── Check coupon (if provided)
         ├── Generate 8-char school ID
         ├── Neon API: Create database "school_{id}"
         ├── Prisma: Run tenant migrations
         ├── Seed principal account
         ├── Master DB: Create School record
         ├── Master DB: Log onboarding event
         └── Return: { schoolId, loginUrl }
                     │
                     ▼
            Redirect to /:schoolId/login
```

#### Payment & Receipt Flow
```
Admin records payment
         │
         ▼
POST /api/fees/payments
         │
         ├── Validate payment data (amount, mode, references)
         ├── Update StudentFeeAssignment (paidAmount, pendingAmount, status)
         ├── Create Payment record
         ├── Generate receipt number (REC-YYYY-NNNNN)
         ├── Create Receipt record
         ├── (Optional) Queue WhatsApp receipt notification
         └── Return: { payment, receipt, ledger, receiptNotificationQueued }
                     │
                     ▼
            Frontend shows receipt + download PDF option
```
