# Payment Flow Documentation

**Payment is offline / manual** — no online payment gateway is integrated.

| Step | Action |
|------|--------|
| 1 | Admin/Accountant opens student fee ledger |
| 2 | Clicks "Record Payment" |
| 3 | Enters: amount, payment mode (Cash/UPI/Cheque/DD/Bank Transfer/Online Gateway), reference details |
| 4 | Backend: Creates Payment → Updates StudentFeeAssignment → Creates Receipt → (Optional) Queues WhatsApp notification |
| 5 | Receipt PDF can be downloaded or shared via WhatsApp |
| 6 | Fee adjustments (concessions/discounts) can be applied separately |

**Payment modes**: Cash, UPI (transaction ID), Bank Transfer (bank reference), Cheque (cheque number), DD (DD number), Online Gateway (gateway transaction ID), Other.

> ⚠️ **Razorpay/Cashfree integration is planned but not implemented.** Payment simulation is used for onboarding.
