export type PaymentPreview = {
  status: "PAID" | "TRIAL";
  amountPaid: number;
  providerReference: string | null;
};

export async function simulatePayment(amount: number, mode: "trial" | "purchase"): Promise<PaymentPreview> {
  if (mode === "trial") {
    return {
      status: "TRIAL",
      amountPaid: 0,
      providerReference: null
    };
  }

  return {
    status: "PAID",
    amountPaid: amount,
    providerReference: `sim_${Date.now()}`
  };
}
