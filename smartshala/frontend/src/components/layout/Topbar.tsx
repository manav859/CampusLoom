"use client";

import { useRouter } from "next/navigation";
import type { SessionUser } from "@/types";

export function Topbar({ user }: { user: SessionUser }) {
  const router = useRouter();

  function logout() {
    window.localStorage.removeItem("smartshala.accessToken");
    window.localStorage.removeItem("smartshala.refreshToken");
    window.localStorage.removeItem("smartshala.user");
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-panel/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{user.schoolName}</p>
          <p className="font-semibold text-ink">{user.fullName}</p>
        </div>
        <button className="focus-ring rounded-lg border border-line px-3 py-2 text-sm font-medium hover:bg-neutral-50" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  );
}

