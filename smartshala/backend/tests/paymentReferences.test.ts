import assert from "node:assert/strict";
import { paymentSchema } from "../src/modules/fees/fees.schemas.js";

const base = {
  studentId: "11111111-1111-4111-8111-111111111111",
  amount: 500
};

const cases = [
  { mode: "UPI", field: "upiTransactionId", value: "UPI123456" },
  { mode: "CHEQUE", field: "chequeNumber", value: "006421" },
  { mode: "DD", field: "ddNumber", value: "841529" },
  { mode: "BANK_TRANSFER", field: "bankReference", value: "NEFT987654" },
  { mode: "ONLINE_GATEWAY", field: "gatewayTransactionId", value: "pay_123456" }
] as const;

for (const testCase of cases) {
  const missing = paymentSchema.safeParse({ ...base, mode: testCase.mode });
  assert.equal(missing.success, false, `${testCase.mode} must require ${testCase.field}`);

  const present = paymentSchema.safeParse({ ...base, mode: testCase.mode, [testCase.field]: `  ${testCase.value}  ` });
  assert.equal(present.success, true, `${testCase.mode} should accept ${testCase.field}`);
  if (present.success) {
    assert.equal(present.data[testCase.field], testCase.value);
  }
}

const cash = paymentSchema.safeParse({ ...base, mode: "CASH" });
assert.equal(cash.success, true, "CASH should not require a reference");

console.log("payment reference validation ok");
