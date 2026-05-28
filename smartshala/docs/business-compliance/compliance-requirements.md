# Compliance Requirements

| Requirement | Status |
|------------|--------|
| **DPDP Act (India)** | ⚠️ Not addressed — no consent management, data portability, or DPO designation |
| **Student data protection** | Partial — soft deletes, audit logs, role-based access |
| **GSTIN on receipts** | ✅ Supported — School model has `gstin` field |
| **U-DISE compliance** | ✅ School model has `udiseNumber` field |
| **CBSE/Board affiliation** | ✅ School model has `affiliationBoard` field |
| **Aadhaar/APAAR storage** | ✅ StudentDocument supports AADHAAR and APAAR types |
| **Data encryption at rest** | ⚠️ Managed by Neon PostgreSQL (infrastructure level) |
| **Data encryption in transit** | ✅ SSL/TLS enforced (`sslmode=require`) |
| **Audit trail** | ✅ AuditLog model with before/after JSON snapshots |
| **Password hashing** | ✅ bcrypt with 10 salt rounds |
