"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { invalidateCachePrefix } from "@/lib/prefetchCache";
import {
  academicYearsApi,
  classesApi,
  type AcademicYear,
  type ClassStudent,
  type RolloverPreview,
  type RolloverResult
} from "@/lib/api";

type MappingState = {
  action: "PROMOTE" | "GRADUATE";
  targetName: string;
  targetSection: string;
  heldBack: Set<string>;
};

const statusTone: Record<AcademicYear["status"], string> = {
  ACTIVE: "bg-[#E1F5EA] text-[#0F8A4A]",
  UPCOMING: "bg-[#EEF3FF] text-[#2456E6]",
  CLOSED: "bg-[#F2F5F8] text-[#5A6573]"
};

function formatMoney(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function toDateInput(value: string) {
  return value ? value.slice(0, 10) : "";
}

export function AcademicYearSection() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [open, setOpen] = useState(false);

  async function loadYears() {
    const list = await academicYearsApi.list().catch(() => []);
    setYears(list);
  }

  useEffect(() => {
    loadYears();
  }, []);

  return (
    <section className="rounded-[6px] border border-[#C9D3DE] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[17px] font-semibold text-[#031526]">Academic Year</h2>
          <p className="mt-1 text-[13px] text-[#5A6573]">Promote students, carry forward dues, and start the next year without a break.</p>
        </div>
        <button
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-[#2456E6] px-5 text-[14px] font-semibold text-white hover:bg-[#1B45BD]"
          onClick={() => setOpen(true)}
          type="button"
        >
          Start New Academic Year
        </button>
      </div>

      <div className="mt-4 divide-y divide-[#ECEFF3] rounded-[6px] border border-[#ECEFF3]">
        {years.length === 0 ? (
          <p className="px-4 py-3 text-[13px] text-[#8C96A3]">No academic years yet.</p>
        ) : (
          years.map((year) => (
            <div className="flex items-center justify-between gap-3 px-4 py-3" key={year.id}>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold text-[#1d1d1f]">{year.name}</span>
                {year.isCurrent ? (
                  <span className="rounded-full bg-[#2456E6] px-2 py-0.5 text-[10px] font-bold text-white">Current</span>
                ) : null}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${statusTone[year.status]}`}>{year.status}</span>
              </div>
              <span className="text-[12px] font-medium text-[#6E7885]">{year._count?.classes ?? 0} classes</span>
            </div>
          ))
        )}
      </div>

      {open ? <RolloverWizard onClose={() => setOpen(false)} onComplete={loadYears} /> : null}
    </section>
  );
}

function RolloverWizard({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [preview, setPreview] = useState<RolloverPreview | null>(null);
  const [loadError, setLoadError] = useState("");

  const [targetName, setTargetName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [mappings, setMappings] = useState<Record<string, MappingState>>({});

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [studentsByClass, setStudentsByClass] = useState<Record<string, ClassStudent[]>>({});

  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RolloverResult | null>(null);

  useEffect(() => {
    academicYearsApi
      .rolloverPreview()
      .then((data) => {
        setPreview(data);
        setTargetName(data.targetName);
        setStartDate(toDateInput(data.targetDates.startDate));
        setEndDate(toDateInput(data.targetDates.endDate));
        setMappings(
          Object.fromEntries(
            data.classes.map((proposal) => [
              proposal.sourceClassId,
              {
                action: proposal.proposedAction,
                targetName: proposal.proposedTargetName ?? "",
                targetSection: proposal.proposedTargetSection,
                heldBack: new Set<string>()
              }
            ])
          )
        );
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Unable to prepare rollover"));
  }, []);

  function updateMapping(id: string, patch: Partial<MappingState>) {
    setMappings((current) => ({ ...current, [id]: { ...current[id], ...patch } }));
  }

  async function toggleExpand(classId: string) {
    if (expandedId === classId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(classId);
    if (!studentsByClass[classId]) {
      const students = await classesApi.students(classId).catch(() => []);
      setStudentsByClass((current) => ({ ...current, [classId]: students }));
    }
  }

  function toggleHeldBack(classId: string, studentId: string) {
    setMappings((current) => {
      const next = new Set(current[classId].heldBack);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return { ...current, [classId]: { ...current[classId], heldBack: next } };
    });
  }

  const promoteRowsInvalid = preview
    ? preview.classes.some((proposal) => {
        const mapping = mappings[proposal.sourceClassId];
        return mapping?.action === "PROMOTE" && (!mapping.targetName.trim() || !mapping.targetSection.trim());
      })
    : true;

  const summary = (() => {
    if (!preview) return { promoted: 0, heldBack: 0, graduated: 0, newClasses: 0 };
    let promoted = 0;
    let heldBack = 0;
    let graduated = 0;
    const keys = new Set<string>();
    for (const proposal of preview.classes) {
      const mapping = mappings[proposal.sourceClassId];
      if (!mapping) continue;
      const held = mapping.heldBack.size;
      heldBack += held;
      if (held > 0) keys.add(`${proposal.name}|${proposal.section}`);
      if (mapping.action === "PROMOTE") {
        promoted += Math.max(0, proposal.studentCount - held);
        keys.add(`${mapping.targetName.trim()}|${mapping.targetSection.trim()}`);
      } else {
        graduated += Math.max(0, proposal.studentCount - held);
      }
    }
    return { promoted, heldBack, graduated, newClasses: keys.size };
  })();

  async function commit() {
    if (!preview) return;
    setCommitting(true);
    setError("");
    try {
      const payload = {
        targetYear: {
          name: targetName.trim(),
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          endDate: endDate ? new Date(endDate).toISOString() : undefined
        },
        mappings: preview.classes.map((proposal) => {
          const mapping = mappings[proposal.sourceClassId];
          return {
            sourceClassId: proposal.sourceClassId,
            action: mapping.action,
            ...(mapping.action === "PROMOTE"
              ? { targetName: mapping.targetName.trim(), targetSection: mapping.targetSection.trim() }
              : {}),
            heldBackStudentIds: Array.from(mapping.heldBack)
          };
        }),
        setCurrent: true
      };
      const rollover = await academicYearsApi.rolloverCommit(payload);
      // Make the new year the active selection and refresh cached class lists.
      window.localStorage.setItem("smartshala.academicYearId", rollover.targetYear.id);
      window.dispatchEvent(
        new CustomEvent("smartshala:academic-year", {
          detail: { academicYearId: rollover.targetYear.id, academicYear: rollover.targetYear.name, readOnly: false }
        })
      );
      invalidateCachePrefix("classes:");
      setResult(rollover);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rollover failed");
    } finally {
      setCommitting(false);
    }
  }

  if (typeof window === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#ECEFF3] px-5 py-4">
          <h3 className="text-[16px] font-semibold text-[#031526]">Start New Academic Year</h3>
          <button aria-label="Close" className="text-[#8C96A3] hover:text-[#2A3340]" onClick={onClose} type="button">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 18 18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadError ? (
            <p className="rounded-[6px] bg-[#FCE3E5] px-3 py-2 text-[13px] font-semibold text-[#C8242C]">{loadError}</p>
          ) : !preview ? (
            <p className="py-8 text-center text-[13px] text-[#8C96A3]">Preparing rollover…</p>
          ) : result ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#E1F5EA] text-[#0F8A4A]">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-[15px] font-semibold text-[#031526]">{result.targetYear.name} is now active</p>
              <p className="mt-2 text-[13px] text-[#5A6573]">
                {result.classesCreated} classes created · {result.studentsPromoted} promoted · {result.studentsHeldBack} held back ·{" "}
                {result.studentsGraduated} graduated · {formatMoney(result.arrearsCarried)} dues carried forward
              </p>
            </div>
          ) : step === 1 ? (
            <div className="space-y-4">
              <p className="text-[13px] text-[#5A6573]">
                Rolling over from <span className="font-semibold text-[#2A3340]">{preview.currentYear.name}</span>. Outstanding dues of{" "}
                <span className="font-semibold text-[#2A3340]">{formatMoney(preview.arrears.totalPending)}</span> across {preview.arrears.studentCount}{" "}
                student(s) will carry forward.
              </p>
              <Field label="New academic year">
                <input className={inputClass} onChange={(event) => setTargetName(event.target.value)} placeholder="2026-27" value={targetName} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start date">
                  <input className={inputClass} onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
                </Field>
                <Field label="End date">
                  <input className={inputClass} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
                </Field>
              </div>
            </div>
          ) : step === 2 ? (
            <div className="space-y-2">
              {preview.classes.map((proposal) => {
                const mapping = mappings[proposal.sourceClassId];
                if (!mapping) return null;
                const students = studentsByClass[proposal.sourceClassId] ?? [];
                return (
                  <div className="rounded-[8px] border border-[#ECEFF3] p-3" key={proposal.sourceClassId}>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="min-w-[88px] text-[13px] font-semibold text-[#1d1d1f]">
                        {proposal.name}-{proposal.section}
                        <span className="ml-1 text-[11px] font-medium text-[#8C96A3]">({proposal.studentCount})</span>
                      </span>
                      <CustomSelect
                        ariaLabel={`Action for ${proposal.name}-${proposal.section}`}
                        className="w-[120px]"
                        onChange={(value) => updateMapping(proposal.sourceClassId, { action: value as MappingState["action"] })}
                        options={[
                          { label: "Promote", value: "PROMOTE" },
                          { label: "Graduate", value: "GRADUATE" }
                        ]}
                        value={mapping.action}
                      />
                      {mapping.action === "PROMOTE" ? (
                        <div className="flex items-center gap-1.5 text-[12px] text-[#8C96A3]">
                          <span>→</span>
                          <input
                            aria-label="Target grade"
                            className={`${inputClass} h-9 w-16`}
                            onChange={(event) => updateMapping(proposal.sourceClassId, { targetName: event.target.value })}
                            placeholder="Grade"
                            value={mapping.targetName}
                          />
                          <input
                            aria-label="Target section"
                            className={`${inputClass} h-9 w-14`}
                            onChange={(event) => updateMapping(proposal.sourceClassId, { targetSection: event.target.value })}
                            placeholder="Sec"
                            value={mapping.targetSection}
                          />
                        </div>
                      ) : (
                        <span className="text-[12px] font-medium text-[#B95A00]">Students leave the school</span>
                      )}
                      <button
                        className="ml-auto text-[12px] font-semibold text-[#2456E6] hover:underline"
                        onClick={() => toggleExpand(proposal.sourceClassId)}
                        type="button"
                      >
                        {mapping.heldBack.size > 0 ? `${mapping.heldBack.size} held back` : "Hold back…"}
                      </button>
                    </div>

                    {expandedId === proposal.sourceClassId ? (
                      <div className="mt-3 max-h-44 overflow-y-auto rounded-[6px] bg-[#F8F9FC] p-2">
                        {students.length === 0 ? (
                          <p className="px-2 py-1 text-[12px] text-[#8C96A3]">No students.</p>
                        ) : (
                          students.map((student) => (
                            <label className="flex items-center gap-2 px-2 py-1 text-[13px] text-[#2A3340]" key={student.id}>
                              <input
                                checked={mapping.heldBack.has(student.id)}
                                onChange={() => toggleHeldBack(proposal.sourceClassId, student.id)}
                                type="checkbox"
                              />
                              {student.fullName}
                            </label>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[13px] text-[#5A6573]">Review before starting {targetName}:</p>
              <ul className="space-y-1.5 rounded-[8px] bg-[#F8F9FC] p-4 text-[13px] text-[#2A3340]">
                <SummaryRow label="New classes created" value={`${summary.newClasses}`} />
                <SummaryRow label="Students promoted" value={`${summary.promoted}`} />
                <SummaryRow label="Students held back" value={`${summary.heldBack}`} />
                <SummaryRow label="Students graduated" value={`${summary.graduated}`} />
                <SummaryRow label="Dues carried forward" value={formatMoney(preview.arrears.totalPending)} />
              </ul>
              {error ? <p className="rounded-[6px] bg-[#FCE3E5] px-3 py-2 text-[12px] font-semibold text-[#C8242C]">{error}</p> : null}
            </div>
          )}
        </div>

        {preview && !loadError ? (
          <div className="flex items-center justify-between gap-3 border-t border-[#ECEFF3] px-5 py-4">
            {result ? (
              <button className={primaryBtn} onClick={onClose} type="button">
                Done
              </button>
            ) : (
              <>
                <button
                  className="min-h-11 rounded-[6px] border border-[#C2C9D4] bg-white px-5 text-[14px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB]"
                  onClick={() => (step === 1 ? onClose() : setStep((step - 1) as 1 | 2))}
                  type="button"
                >
                  {step === 1 ? "Cancel" : "Back"}
                </button>
                {step < 3 ? (
                  <button
                    className={primaryBtn}
                    disabled={step === 1 ? !targetName.trim() : promoteRowsInvalid}
                    onClick={() => setStep((step + 1) as 2 | 3)}
                    type="button"
                  >
                    Next
                  </button>
                ) : (
                  <button className={primaryBtn} disabled={committing} onClick={commit} type="button">
                    {committing ? "Starting…" : `Start ${targetName}`}
                  </button>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

const inputClass =
  "min-h-10 w-full rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-[14px] font-medium text-[#031526] outline-none focus:border-[#2456E6] focus:ring-2 focus:ring-[#2456E6]/10";
const primaryBtn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[6px] bg-[#2456E6] px-5 text-[14px] font-semibold text-white hover:bg-[#1B45BD] disabled:cursor-not-allowed disabled:opacity-50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#8C96A3]">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-[#5A6573]">{label}</span>
      <span className="font-semibold text-[#1d1d1f]">{value}</span>
    </li>
  );
}
