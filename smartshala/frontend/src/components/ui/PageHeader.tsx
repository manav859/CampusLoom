"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Breadcrumb = {
  href?: string;
  label: string;
};

type PageHeaderProps = {
  action?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  eyebrow?: string;
  title?: string;
};

const labelMap: Record<string, string> = {
  analytics: "Analytics",
  attendance: "Attendance",
  classes: "Classes",
  dashboard: "Dashboard",
  defaulters: "Defaulters",
  fees: "Fees",
  ledger: "Ledger",
  mark: "Mark attendance",
  new: "New",
  notifications: "WhatsApp logs",
  reports: "Reports",
  settings: "Settings",
  students: "Students",
  teacher: "Teacher",
  teachers: "Teachers"
};

function humanSegment(segment: string) {
  if (/^[0-9a-f-]{12,}$/i.test(segment)) return "Detail";
  return labelMap[segment] ?? segment.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function breadcrumbsFromPath(pathname: string): Breadcrumb[] {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((segment, index) => ({
    href: index < segments.length - 1 ? `/${segments.slice(0, index + 1).join("/")}` : undefined,
    label: humanSegment(segment)
  }));
}

export function PageHeader({ title, eyebrow, action, breadcrumbs }: PageHeaderProps) {
  const pathname = usePathname();
  const crumbs = breadcrumbs ?? breadcrumbsFromPath(pathname);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        {crumbs.length > 1 ? (
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-caption font-semibold text-[#5A6573]">
            {crumbs.map((crumb, index) => (
              <span className="inline-flex items-center gap-1.5" key={`${crumb.label}-${index}`}>
                {index > 0 ? <span className="text-[#A0A7B2]">/</span> : null}
                {crumb.href ? (
                  <Link className="text-[#2456E6] hover:underline" href={crumb.href}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-[#5A6573]">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        {eyebrow ? <p className="type-kpi-label text-[#86868b]">{eyebrow}</p> : null}
        {title ? <h1 className="type-h1 text-[#0F1419]">{title}</h1> : null}
      </div>
      {action ? <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">{action}</div> : null}
    </div>
  );
}
