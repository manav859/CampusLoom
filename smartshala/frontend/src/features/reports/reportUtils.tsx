"use client";

import type { ReactNode } from "react";

export function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function percent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return `${Math.round(value)}%`;
}

export function ReportTable({
  children,
  empty,
  isEmpty,
  minWidth = "min-w-[860px]",
  colSpan
}: {
  children: ReactNode;
  empty: string;
  isEmpty: boolean;
  minWidth?: string;
  colSpan: number;
}) {
  return (
    <div className="overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white shadow-[var(--shadow-card)]">
      <div className="overflow-x-auto">
        <table className={`w-full border-collapse text-left text-[13px] text-[#001B33] ${minWidth}`}>
          {children}
          {isEmpty ? (
            <tbody>
              <tr>
                <td className="px-5 py-12 text-center text-[#86868b]" colSpan={colSpan}>
                  {empty}
                </td>
              </tr>
            </tbody>
          ) : null}
        </table>
      </div>
    </div>
  );
}
