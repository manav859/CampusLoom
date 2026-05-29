"use client";

import type { ReactNode } from "react";

type ReportCell = string | number | null | undefined;

export function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCsv(filename: string, rows: Array<Array<ReportCell>>) {
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

function escapeHtml(value: ReportCell) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function exportPdfReport({
  filename,
  rows,
  subtitle,
  title
}: {
  filename: string;
  rows: Array<Array<ReportCell>>;
  subtitle?: string;
  title: string;
}) {
  const printWindow = window.open("", "_blank", "width=960,height=720");
  if (!printWindow) return false;

  const [header = [], ...body] = rows;
  const generatedAt = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
  const safeTitle = escapeHtml(title);
  const safeSubtitle = subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : "";

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(filename)}</title>
  <style>
    @page { margin: 18mm; size: A4 landscape; }
    * { box-sizing: border-box; }
    body { color: #111827; font-family: Arial, sans-serif; margin: 0; }
    header { border-bottom: 1px solid #dce1e8; margin-bottom: 18px; padding-bottom: 12px; }
    h1 { font-size: 22px; margin: 0 0 6px; }
    .subtitle, .meta { color: #5a6573; font-size: 12px; margin: 0; }
    .meta { margin-top: 6px; }
    table { border-collapse: collapse; font-size: 11px; width: 100%; }
    th, td { border: 1px solid #dce1e8; padding: 7px 8px; text-align: left; vertical-align: top; }
    th { background: #0f1419; color: white; font-weight: 700; }
    tr:nth-child(even) td { background: #f7f8fb; }
  </style>
</head>
<body>
  <header>
    <h1>${safeTitle}</h1>
    ${safeSubtitle}
    <p class="meta">Generated ${escapeHtml(generatedAt)}</p>
  </header>
  <table>
    <thead><tr>${header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead>
    <tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>
</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 250);
  return true;
}

export function ReportExportActions({
  disabled,
  onExportCsv,
  onExportPdf
}: {
  disabled?: boolean;
  onExportCsv: () => void;
  onExportPdf: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-primary min-h-10 px-4 text-[13px]" disabled={disabled} onClick={onExportCsv} type="button">Export CSV</button>
      <button className="btn-secondary min-h-10 px-4 text-[13px]" disabled={disabled} onClick={onExportPdf} type="button">Export PDF</button>
    </div>
  );
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
