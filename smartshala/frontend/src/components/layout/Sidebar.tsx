"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/types";

const adminLinks = [
  ["Dashboard", "/dashboard"],
  ["Students", "/students"],
  ["Teachers", "/teachers"],
  ["Classes", "/classes"],
  ["Attendance", "/dashboard/attendance"],
  ["Reports", "/attendance/reports"],
  ["Fees", "/fees"],
  ["Defaulters", "/fees/defaulters"],
  ["Analytics", "/analytics"],
  ["WhatsApp Logs", "/notifications"],
  ["Settings", "/settings"]
];

const teacherLinks = [
  ["Dashboard", "/teacher"],
  ["Mark Attendance", "/attendance"],
  ["Attendance Reports", "/attendance/reports"],
  ["Students", "/students"],
  ["Analytics", "/analytics"]
];

function isAdminRole(role: Role) {
  return role === "PRINCIPAL" || role === "ADMIN";
}

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const links = isAdminRole(role) ? adminLinks : teacherLinks;

  return (
    <aside className="hidden w-64 shrink-0 border-r border-line bg-panel md:block">
      <div className="border-b border-line px-5 py-5">
        <p className="text-lg font-semibold text-ink">SmartShala</p>
        <p className="text-sm text-neutral-500">{isAdminRole(role) ? "Principal desk" : "Teacher desk"}</p>
      </div>
      <nav className="space-y-1 px-3 py-4">
        {links.map(([label, href]) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                active ? "bg-action text-white" : "text-neutral-700 hover:bg-neutral-100"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
