"use client";

import { useEffect, useMemo, useState } from "react";

function currentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  return now.getMonth() >= 3 ? `${year}-${String(year + 1).slice(-2)}` : `${year - 1}-${String(year).slice(-2)}`;
}

function yearOptions(current: string) {
  const startYear = Number(current.slice(0, 4));
  if (!Number.isFinite(startYear)) return [current];
  return [0, -1, -2].map((offset) => {
    const year = startYear + offset;
    return `${year}-${String(year + 1).slice(-2)}`;
  });
}

export function AcademicYearSwitcher() {
  const current = useMemo(() => currentAcademicYear(), []);
  const options = useMemo(() => yearOptions(current), [current]);
  const [selected, setSelected] = useState(current);

  useEffect(() => {
    const stored = window.localStorage.getItem("smartshala.academicYear");
    if (stored && options.includes(stored)) setSelected(stored);
  }, [options]);

  function updateYear(next: string) {
    setSelected(next);
    window.localStorage.setItem("smartshala.academicYear", next);
    window.dispatchEvent(new CustomEvent("smartshala:academic-year", { detail: { academicYear: next, readOnly: next !== current } }));
  }

  const readOnly = selected !== current;

  return (
    <label className="hidden min-w-[168px] flex-col gap-1 md:flex">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">Academic year</span>
      <span className="flex items-center gap-2">
        <select
          aria-label="Academic year"
          className="h-9 rounded-lg border border-[#DCE1E8] bg-white px-2 text-[12px] font-semibold text-[#1d1d1f] shadow-sm"
          onChange={(event) => updateYear(event.target.value)}
          value={selected}
        >
          {options.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        {readOnly ? (
          <span className="rounded-full bg-[#FFF2DC] px-2 py-1 text-[10px] font-bold text-[#B95A00]">Read-only</span>
        ) : null}
      </span>
    </label>
  );
}
