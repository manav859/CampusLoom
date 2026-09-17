"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { transportApi, type TransportReport } from "@/lib/api";
import { downloadCsv, exportPdfReport, percent, ReportExportActions, ReportTable } from "@/features/reports/reportUtils";

export default function TransportReportPage() {
  const [data, setData] = useState<TransportReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    transportApi
      .report()
      .then((report) => {
        if (active) setData(report);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load the transport report");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function reportRows() {
    return [
      ["Route", "Vehicle", "Driver", "Driver phone", "Students", "Seats", "Occupancy", "Without a stop"],
      ...(data?.routes ?? []).map((route) => [
        route.name,
        route.vehicle?.registrationNumber ?? "-",
        route.vehicle?.driverName ?? "-",
        route.vehicle?.driverPhone ?? "-",
        route.students,
        route.capacity ?? "-",
        percent(route.occupancy),
        route.withoutStop
      ])
    ];
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const summary = data?.summary;
  const tiles = [
    { label: "Routes", value: summary?.routes ?? 0, bg: "bg-[#E5F7FF]" },
    { label: "Students on Transport", value: summary?.studentsOnTransport ?? 0, bg: "bg-[#EAF9EB]" },
    { label: "Over Capacity", value: summary?.routesOverCapacity ?? 0, bg: "bg-[#FCE3E5]" },
    { label: "Need a Route", value: summary?.needsRoute ?? 0, bg: "bg-[#FFF0E8]" }
  ];

  if (error) return <div className="rounded-xl bg-[#ff3b30]/10 p-4 text-[13px] font-medium text-[#d70015]">{error}</div>;

  return (
    <div className="space-y-6">
      <PageHeader
        hideBreadcrumbs
        title="Transport Report"
        action={
          <ReportExportActions
            disabled={loading || !data?.routes.length}
            onExportCsv={() => downloadCsv(`transport-${stamp}.csv`, reportRows())}
            onExportPdf={() => exportPdfReport({ filename: `transport-${stamp}.pdf`, rows: reportRows(), title: "Transport" })}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {tiles.map((tile) => (
          <div className={`rounded-[8px] px-5 py-4 ${tile.bg}`} key={tile.label}>
            <p className="truncate text-[14px] font-medium text-[#6F7480]">{tile.label}</p>
            <p className="mt-1.5 text-[26px] font-bold text-[#111827] [font-variant-numeric:tabular-nums]">{loading ? "—" : tile.value}</p>
          </div>
        ))}
      </div>

      <ReportTable colSpan={6} empty={loading ? "Loading routes..." : "No routes yet."} isEmpty={loading || !data?.routes.length}>
        {!loading && data?.routes.length ? (
          <>
            <thead className="table-head">
              <tr>
                <th className="px-5 py-3.5 font-semibold whitespace-nowrap">Route</th>
                <th className="px-5 py-3.5 font-semibold whitespace-nowrap">Vehicle</th>
                <th className="px-5 py-3.5 font-semibold whitespace-nowrap">Driver</th>
                <th className="px-5 py-3.5 font-semibold text-center whitespace-nowrap">Students / Seats</th>
                <th className="px-5 py-3.5 font-semibold whitespace-nowrap">Stops</th>
                <th className="px-5 py-3.5 font-semibold text-center whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF1F5]">
              {data.routes.map((route) => (
                <tr className="table-row align-top" key={route.id}>
                  <td className="px-5 py-4 font-semibold text-[#1d1d1f] whitespace-nowrap">{route.name}</td>
                  <td className="px-5 py-4 text-[#5A6573] whitespace-nowrap">{route.vehicle?.registrationNumber ?? "-"}</td>
                  <td className="px-5 py-4 text-[#5A6573] whitespace-nowrap">
                    {route.vehicle?.driverName ?? "-"}
                    {route.vehicle?.driverPhone ? <span className="block text-[12px]">{route.vehicle.driverPhone}</span> : null}
                  </td>
                  <td className="px-5 py-4 text-center text-[#5A6573] [font-variant-numeric:tabular-nums]">
                    {route.students} / {route.capacity ?? "-"}
                    {route.occupancy !== null ? <span className="block text-[12px]">{percent(route.occupancy)}</span> : null}
                  </td>
                  <td className="px-5 py-4 text-[12px] text-[#5A6573]">
                    {route.stops.length
                      ? route.stops.map((stop) => `${stop.name} (${stop.students})`).join(" → ")
                      : "-"}
                    {route.withoutStop ? <span className="block">{route.withoutStop} without a stop</span> : null}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {route.overCapacity ? (
                      <StatusPill label="Over capacity" tone="danger" />
                    ) : !route.vehicle ? (
                      <StatusPill label="No vehicle" tone="warn" />
                    ) : (
                      <StatusPill label="OK" tone="good" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </>
        ) : null}
      </ReportTable>

      <StudentList
        copy="Their record says they need transport, but they are not on any route."
        rows={(data?.needsRoute ?? []).map((row) => ({ ...row, extra: "" }))}
        title={`Need a Route (${summary?.needsRoute ?? 0})`}
      />
      <StudentList
        copy="They ride a route, but their record says they don't need transport, so no transport fee is charged."
        rows={(data?.notMarked ?? []).map((row) => ({ ...row, extra: row.routeName ?? "" }))}
        title={`On a Route, Not Marked (${summary?.notMarked ?? 0})`}
      />
    </div>
  );
}

function StudentList({
  copy,
  rows,
  title
}: {
  copy: string;
  rows: { id: string; fullName: string; admissionNumber: string; className: string; parentPhone: string; extra: string }[];
  title: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white">
      <div className="border-b border-[#DCE1E8] px-4 py-3">
        <h2 className="text-[15px] font-semibold text-[#0F1419]">{title}</h2>
        <p className="text-[12px] text-[#5A6573]">{copy}</p>
      </div>
      <div className="divide-y divide-[#EEF1F5]">
        {rows.map((row) => (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5" key={row.id}>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-semibold text-[#0F1419]">{row.fullName}</p>
              <p className="truncate text-[12px] text-[#5A6573]">{row.className} · {row.admissionNumber}{row.extra ? ` · ${row.extra}` : ""}</p>
            </div>
            <span className="shrink-0 text-[12px] text-[#5A6573]">{row.parentPhone}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
