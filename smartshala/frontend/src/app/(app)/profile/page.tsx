"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch } from "@/lib/api";
import type { SessionUser } from "@/types";

const fieldClass = "mt-2 min-h-[44px] w-full rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-[14px] font-medium text-[#031526] outline-none transition focus:border-[#2456E6] focus:ring-2 focus:ring-[#2456E6]/10 disabled:bg-[#F3F6F9] disabled:text-[#8A96A3]";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  
  const [passwordError, setPasswordError] = useState("");
  const [passwordNotice, setPasswordNotice] = useState("");

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    academicBackground: ""
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: ""
  });

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      try {
        const response = await apiFetch<{ user: SessionUser }>("/auth/me");
        if (!active) return;
  
        setFormData({
          fullName: response.user.fullName,
          email: response.user.email ?? "",
          phone: response.user.phone ?? "",
          academicBackground: response.user.academicBackground ?? ""
        });
      } catch (err) {
        if (active) setProfileError(err instanceof Error ? err.message : "Unable to load profile");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();
    return () => { active = false; };
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileError("");
    setProfileNotice("");
    try {
      const response = await apiFetch<{ user: SessionUser }>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email.trim() === "" ? "" : formData.email,
          phone: formData.phone,
          academicBackground: formData.academicBackground.trim() === "" ? "" : formData.academicBackground
        })
      });

      setFormData({
        fullName: response.user.fullName,
        email: response.user.email ?? "",
        phone: response.user.phone ?? "",
        academicBackground: response.user.academicBackground ?? ""
      });
      
      // Update local storage user data
      const stored = window.localStorage.getItem("smartshala.user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const updated = { ...parsed, ...response.user };
          window.localStorage.setItem("smartshala.user", JSON.stringify(updated));
          // Dispatch event if needed
          window.dispatchEvent(new Event("smartshala:user-updated"));
        } catch {}
      }

      setProfileNotice("Profile updated successfully.");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Unable to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordError("");
    setPasswordNotice("");
    
    if (passwordData.newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      setSavingPassword(false);
      return;
    }

    try {
      await apiFetch<{ success: boolean }>("/auth/me/password", {
        method: "PATCH",
        body: JSON.stringify(passwordData)
      });
      setPasswordNotice("Password updated successfully.");
      setPasswordData({ currentPassword: "", newPassword: "" });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Unable to update password");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader hideBreadcrumbs title="Your Profile" />
      
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        {/* Profile Details Form */}
        <form className="space-y-5 rounded-[6px] border border-[#C9D3DE] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-6" onSubmit={saveProfile}>
          <h2 className="text-[17px] font-semibold text-[#031526]">Basic Details</h2>
          
          {profileError ? <div className="rounded-[6px] border border-[#FCE3E5] bg-[#FCE3E5] p-3 text-[13px] font-semibold text-[#C8242C]">{profileError}</div> : null}
          {profileNotice ? <div className="rounded-[6px] border border-[#D6F0DF] bg-[#E1F5EA] p-3 text-[13px] font-semibold text-[#0F8A4A]">{profileNotice}</div> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[13px] font-semibold text-[#031526]">Full Name</span>
              <input 
                className={fieldClass} 
                disabled={loading || savingProfile} 
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))} 
                value={formData.fullName} 
                required
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-[#031526]">Email Address</span>
              <input 
                type="email"
                className={fieldClass} 
                disabled={loading || savingProfile} 
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} 
                value={formData.email} 
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[13px] font-semibold text-[#031526]">Phone Number</span>
              <input 
                className={fieldClass} 
                disabled={loading || savingProfile} 
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} 
                value={formData.phone} 
                required
              />
            </label>
            <label className="block">
              <span className="text-[13px] font-semibold text-[#031526]">Academic Background</span>
              <input 
                className={fieldClass} 
                disabled={loading || savingProfile} 
                onChange={(e) => setFormData(prev => ({ ...prev, academicBackground: e.target.value }))} 
                value={formData.academicBackground} 
              />
            </label>
          </div>

          <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[6px] bg-[#2456E6] px-5 text-[14px] font-semibold text-white hover:bg-[#1B45BD] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto" disabled={loading || savingProfile} type="submit">
            {savingProfile ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
            {savingProfile ? "Saving..." : "Save Details"}
          </button>
        </form>

        {/* Change Password Form */}
        <form className="space-y-5 rounded-[6px] border border-[#C9D3DE] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-6" onSubmit={savePassword}>
          <h2 className="text-[17px] font-semibold text-[#031526]">Change Password</h2>
          
          {passwordError ? <div className="rounded-[6px] border border-[#FCE3E5] bg-[#FCE3E5] p-3 text-[13px] font-semibold text-[#C8242C]">{passwordError}</div> : null}
          {passwordNotice ? <div className="rounded-[6px] border border-[#D6F0DF] bg-[#E1F5EA] p-3 text-[13px] font-semibold text-[#0F8A4A]">{passwordNotice}</div> : null}

          <label className="block">
            <span className="text-[13px] font-semibold text-[#031526]">Current Password</span>
            <input 
              className={fieldClass} 
              disabled={loading || savingPassword} 
              onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))} 
              value={passwordData.currentPassword} 
              type="password"
              required
            />
          </label>
          
          <label className="block">
            <span className="text-[13px] font-semibold text-[#031526]">New Password</span>
            <input 
              className={fieldClass} 
              disabled={loading || savingPassword} 
              onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))} 
              value={passwordData.newPassword} 
              type="password"
              required
            />
          </label>

          <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[6px] bg-[#2456E6] px-5 text-[14px] font-semibold text-white hover:bg-[#1B45BD] disabled:cursor-not-allowed disabled:opacity-50" disabled={loading || savingPassword || !passwordData.currentPassword || !passwordData.newPassword} type="submit">
            {savingPassword ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
            {savingPassword ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
