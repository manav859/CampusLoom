"use client";

import { useEffect, useState } from "react";
import { settingsApi, type PeriodTime } from "@/lib/api";

type Row = { startTime: string; endTime: string };

const timeFieldClass = "min-h-[40px] w-full rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-[14px] font-medium text-[#031526] outline-none transition focus:border-[#2456E6] focus:ring-2 focus:ring-[#2456E6]/10 disabled:bg-[#F3F6F9] disabled:text-[#8A96A3]";

function toRows(periods: PeriodTime[]): Record<number, Row> {
  return Object.fromEntries(
    periods.map((period) => [period.periodNumber, { startTime: period.startTime, endTime: period.endTime }])
  );
}

/**
 * The school bell: one start and end time per period, shared by every class
 * and weekday. Teachers see these on Today's Schedule in the teacher app.
 * `periodCount` is the saved Periods Per Day, so rows follow what the server
 * will accept rather than an unsaved edit in the profile form.
 */
export function PeriodTimesSection({ periodCount }: { periodCount: number }) {
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    settingsApi
      .periodTimes()
      .then((result) => {
        if (active) setRows(toRows(result.periods));
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load bell timings");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [periodCount]);

  function updateRow(periodNumber: number, key: keyof Row, value: string) {
    setRows((current) => ({
      ...current,
      [periodNumber]: { ...(current[periodNumber] ?? { startTime: "", endTime: "" }), [key]: value }
    }));
  }

  async function save() {
    setError("");
    setNotice("");

    const periods: PeriodTime[] = [];
    for (let periodNumber = 1; periodNumber <= periodCount; periodNumber++) {
      const startTime = rows[periodNumber]?.startTime ?? "";
      const endTime = rows[periodNumber]?.endTime ?? "";
      if (!startTime && !endTime) continue;
      if (!startTime || !endTime) {
        setError(`Period ${periodNumber} needs both a start and an end time, or neither.`);
        return;
      }
      periods.push({ periodNumber, startTime, endTime });
    }

    setSaving(true);
    try {
      const saved = await settingsApi.updatePeriodTimes(periods);
      setRows(toRows(saved.periods));
      setNotice("Bell timings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save bell timings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[6px] border border-[#C9D3DE] bg-white p-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[17px] font-semibold text-[#031526]">Bell Timings</h2>
          <p className="mt-1 text-[13px] text-[#5A6573]">
            One start and end time per period, the same for every class and weekday. Teachers see these on
            Today&apos;s Schedule in the app. Leave a period blank to show it without a time.
          </p>
        </div>
        <button
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-[6px] bg-[#2456E6] px-5 text-[14px] font-semibold text-white hover:bg-[#1B45BD] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={loading || saving}
          onClick={save}
          type="button"
        >
          {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> : null}
          {saving ? "Saving..." : "Save timings"}
        </button>
      </div>

      {error ? <p className="mt-4 rounded-[6px] bg-[#FCE3E5] px-3 py-2 text-[12px] font-semibold text-[#C8242C]">{error}</p> : null}
      {notice ? <p className="mt-4 rounded-[6px] bg-[#E1F5EA] px-3 py-2 text-[12px] font-semibold text-[#0F8A4A]">{notice}</p> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: periodCount }, (_, index) => index + 1).map((periodNumber) => (
          <div className="flex items-center gap-3 rounded-[6px] border border-[#DCE1E8] px-3 py-2" key={periodNumber}>
            <span className="w-16 shrink-0 text-[13px] font-semibold text-[#031526]">Period {periodNumber}</span>
            <input
              aria-label={`Period ${periodNumber} start time`}
              className={timeFieldClass}
              disabled={loading || saving}
              onChange={(event) => updateRow(periodNumber, "startTime", event.target.value)}
              type="time"
              value={rows[periodNumber]?.startTime ?? ""}
            />
            <span className="text-[13px] text-[#5A6573]">to</span>
            <input
              aria-label={`Period ${periodNumber} end time`}
              className={timeFieldClass}
              disabled={loading || saving}
              onChange={(event) => updateRow(periodNumber, "endTime", event.target.value)}
              type="time"
              value={rows[periodNumber]?.endTime ?? ""}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
