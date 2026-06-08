"use client";

import { useEffect, useState } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { academicYearsApi, type AcademicYear } from "@/lib/api";

const STORAGE_KEY = "smartshala.academicYearId";

export function AcademicYearSwitcher() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    let active = true;
    academicYearsApi
      .list()
      .then((list) => {
        if (!active) return;
        setYears(list);
        const current = list.find((year) => year.isCurrent) ?? list[0];
        const stored = window.localStorage.getItem(STORAGE_KEY);
        setSelectedId(stored && list.some((year) => year.id === stored) ? stored : current?.id ?? "");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  function updateYear(nextId: string) {
    setSelectedId(nextId);
    const year = years.find((item) => item.id === nextId);
    window.localStorage.setItem(STORAGE_KEY, nextId);
    window.dispatchEvent(
      new CustomEvent("smartshala:academic-year", {
        detail: { academicYearId: nextId, academicYear: year?.name ?? "", readOnly: !year?.isCurrent }
      })
    );
  }

  if (years.length === 0) return null;

  const selected = years.find((year) => year.id === selectedId);
  const readOnly = selected ? !selected.isCurrent : false;
  const yearSelectOptions = years.map((year) => ({ label: year.name, value: year.id }));

  return (
    <div className="hidden items-center md:flex">
      <div className="flex items-center gap-2">
        <CustomSelect
          ariaLabel="Academic year"
          className="w-[104px]"
          onChange={updateYear}
          options={yearSelectOptions}
          value={selectedId}
        />
        {readOnly ? (
          <span className="rounded-full bg-[#FFF2DC] px-2 py-1 text-[10px] font-bold text-[#B95A00]">Read-only</span>
        ) : null}
      </div>
    </div>
  );
}
