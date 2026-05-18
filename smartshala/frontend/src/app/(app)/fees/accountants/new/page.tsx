"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormSection, openInvalidFormSection } from "@/components/ui/FormSection";
import { SideModal } from "@/components/ui/SideModal";
import { usersApi } from "@/lib/api";

export default function NewAccountantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: ""
  });

  useEffect(() => {
    const storedUser = typeof window !== "undefined" ? window.localStorage.getItem("smartshala.user") : null;
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user.role !== "ADMIN" && user.role !== "PRINCIPAL") {
          router.replace("/fees");
        }
      } catch (error) {
        console.error(error);
      }
    }
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      await usersApi.createAccountant(formData);
      router.push("/fees");
      router.refresh();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Failed to add accountant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SideModal eyebrow="Fees" onClose={() => router.back()} title="Add accountant">
      {errorMsg ? (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-[rgba(255,59,48,0.2)] bg-[rgba(255,59,48,0.1)] p-4 text-[13px] font-medium text-[#d70015]">
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {errorMsg}
        </div>
      ) : null}

      <form onInvalid={openInvalidFormSection} onSubmit={handleSubmit} className="space-y-5">
        <div>
          <FormSection title="Basic Details" defaultOpen>
            <div className="space-y-1.5">
          <label className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Full name</label>
          <input
            className="glass-input w-full"
            minLength={2}
            onChange={(event) => setFormData({ ...formData, fullName: event.target.value })}
            placeholder="e.g. Accounts Officer"
            required
            value={formData.fullName}
          />
            </div>
          </FormSection>

          <FormSection title="Login Details">
            <div className="space-y-5">
        <div className="space-y-1.5">
          <label className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Email address</label>
          <input
            className="glass-input w-full"
            onChange={(event) => setFormData({ ...formData, email: event.target.value })}
            placeholder="accounts@school.com"
            required
            type="email"
            value={formData.email}
          />
          <p className="ml-1 text-[12px] font-medium text-[#5A6573]">This email is used on the login page.</p>
        </div>

        <div className="space-y-1.5">
          <label className="ml-1 text-[13px] font-semibold text-[#1d1d1f]">Initial password</label>
          <input
            className="glass-input w-full"
            minLength={6}
            onChange={(event) => setFormData({ ...formData, password: event.target.value })}
            placeholder="Set an initial password"
            required
            type="password"
            value={formData.password}
          />
        </div>
            </div>
          </FormSection>

          <FormSection title="Access Details">
            <div className="rounded-xl border border-[#DCE1E8] bg-white px-4 py-3 text-[12px] font-medium leading-5 text-[#5A6573]">
          Accountants can open fees, students list, search students, record payments, download receipts, and send receipt WhatsApp messages.
            </div>
          </FormSection>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[rgba(0,0,0,0.06)] pt-4">
          <button
            className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#f5f5f7]"
            onClick={() => router.back()}
            type="button"
          >
            Cancel
          </button>
          <button className="btn-primary rounded-xl px-8 py-2.5 disabled:opacity-50" disabled={loading} type="submit">
            {loading ? "Adding..." : "Add Accountant"}
          </button>
        </div>
      </form>
    </SideModal>
  );
}
