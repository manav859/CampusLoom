import { writeFileSync } from "node:fs";
import { generateInvoicePdf, amountInWords, type InvoicePdfData } from "../src/modules/billing/invoice-pdf.js";

/** Renders the tax invoice against fixture data so the layout can be eyeballed
 *  without a database. `npx tsx scripts/pdf-preview.ts out.pdf [inter]` */
const interState = process.argv[3] === "inter";

const data: InvoicePdfData = {
  seller: {
    name: "SmartShala Technologies Private Limited",
    address: "3rd Floor, Palladium Tower, S.G. Highway, Ahmedabad, Gujarat 380015",
    email: "billing@smartshala.in",
    phone: "+91 79 4800 1200",
    gstin: "24AABCS1429B1ZP",
    pan: "AABCS1429B",
    stateName: "Gujarat",
    stateCode: "24"
  },
  school: {
    schoolId: "SS000042",
    schoolName: "Noble Public School",
    ownerName: "Rakesh Mehta",
    email: "office@noblepublic.edu.in",
    phone: "+91 98250 11223",
    address: "Plot 14, Sector 8, Gandhinagar, Gujarat 382008",
    gstin: interState ? "27AAACN2082C1Z8" : "24AAACN2082C1ZQ",
    stateName: interState ? "Maharashtra" : "Gujarat",
    stateCode: interState ? "27" : "24"
  },
  invoice: {
    number: "SS-INV-2026-000184",
    status: "DUE",
    currency: "INR",
    planName: "Growth Annual",
    planCode: "GROWTH_Y",
    sacCode: "998434",
    subtotalMinor: 12500000,
    discountMinor: 1250000,
    taxMinor: 2025000,
    totalMinor: 13275000,
    amountPaidMinor: 0,
    couponCode: "EARLY10",
    periodStart: new Date("2026-04-01"),
    periodEnd: new Date("2027-03-31"),
    issuedAt: new Date("2026-09-09"),
    dueAt: new Date("2026-09-16"),
    paidAt: null,
    notes: "Purchase order PO-2026-118 dated 02 Sep 2026."
  },
  payments: [
    {
      status: "FAILED",
      method: "upi",
      reference: "pay_QkT81mZaXc0192",
      amountMinor: 13275000,
      refundedMinor: 0,
      at: new Date("2026-09-08T11:04:00Z")
    }
  ]
};

const target = process.argv[2] ?? "invoice-preview.pdf";
const buffer = await generateInvoicePdf(data);
writeFileSync(target, buffer);
console.log(`${target} — ${buffer.length} bytes`);
console.log(amountInWords(data.invoice.totalMinor, "INR"));
