"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  classesApi,
  transportApi,
  type ClassStudent,
  type ClassSummary,
  type TransportOverview,
  type TransportRouteDetail,
  type TransportVehicle
} from "@/lib/api";

type VehicleDraft = { id?: string; registrationNumber: string; capacity: string; driverName: string; driverPhone: string };
type StopDraft = { id?: string; name: string; pickupTime: string; dropTime: string };
type RouteDraft = { id?: string; name: string; vehicleId: string; stops: StopDraft[] };

const fieldClass = "min-h-11 w-full rounded-[6px] border border-[#C9D3DE] bg-white px-3 text-[14px] font-medium text-[#031526] outline-none transition focus:border-[#2456E6] focus:ring-2 focus:ring-[#2456E6]/10";
const primaryButton = "min-h-10 rounded-[6px] bg-[#2456E6] px-4 text-[13px] font-semibold text-white hover:bg-[#1B45BD] disabled:opacity-50";
const secondaryButton = "min-h-10 rounded-[6px] border border-[#C2C9D4] bg-white px-4 text-[13px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB] disabled:opacity-50";
const smallButton = "min-h-9 shrink-0 rounded-[6px] border border-[#C2C9D4] bg-white px-3 text-[12px] font-semibold text-[#2A3340] hover:bg-[#F7F8FB] disabled:opacity-50";

function vehicleLabel(vehicle: TransportVehicle | null) {
  if (!vehicle) return "No vehicle";
  return vehicle.driverName ? `${vehicle.registrationNumber} · ${vehicle.driverName}` : vehicle.registrationNumber;
}

function stopTimes(stop: { pickupTime: string | null; dropTime: string | null }) {
  return [stop.pickupTime && `Pickup ${stop.pickupTime}`, stop.dropTime && `Drop ${stop.dropTime}`].filter(Boolean).join(" · ");
}

function errorText(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export default function TransportPage() {
  const [data, setData] = useState<TransportOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState<TransportRouteDetail | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const [vehicleDraft, setVehicleDraft] = useState<VehicleDraft | null>(null);
  const [routeDraft, setRouteDraft] = useState<RouteDraft | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await transportApi.overview());
    } catch (err) {
      setError(errorText(err, "Unable to load transport"));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRoute = useCallback(async (id: string) => {
    setRouteLoading(true);
    try {
      setRoute(await transportApi.route(id));
    } catch (err) {
      setError(errorText(err, "Unable to load the route"));
    } finally {
      setRouteLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedId) loadRoute(selectedId);
    else setRoute(null);
  }, [loadRoute, selectedId]);

  async function refresh(message: string) {
    setNotice(message);
    await load();
    if (selectedId) await loadRoute(selectedId);
  }

  async function run(action: () => Promise<void>, fallback: string) {
    setSaving(true);
    setFormError("");
    try {
      await action();
    } catch (err) {
      setFormError(errorText(err, fallback));
    } finally {
      setSaving(false);
    }
  }

  // ------------------------------------------------------------ vehicles

  function openVehicle(vehicle?: TransportVehicle) {
    setFormError("");
    setVehicleDraft(
      vehicle
        ? {
            id: vehicle.id,
            registrationNumber: vehicle.registrationNumber,
            capacity: String(vehicle.capacity),
            driverName: vehicle.driverName ?? "",
            driverPhone: vehicle.driverPhone ?? ""
          }
        : { registrationNumber: "", capacity: "", driverName: "", driverPhone: "" }
    );
  }

  function saveVehicle() {
    const draft = vehicleDraft;
    if (!draft) return;
    const capacity = Number(draft.capacity);
    if (draft.registrationNumber.trim().length < 4) return setFormError("Enter the registration number.");
    if (!Number.isInteger(capacity) || capacity < 1) return setFormError("Capacity is a whole number of seats, at least 1.");
    if (draft.driverPhone && !/^\d{10}$/.test(draft.driverPhone.trim())) return setFormError("Use a 10-digit driver phone number.");

    const payload = {
      registrationNumber: draft.registrationNumber,
      capacity,
      driverName: draft.driverName.trim() || null,
      driverPhone: draft.driverPhone.trim() || null
    };
    run(async () => {
      if (draft.id) await transportApi.updateVehicle(draft.id, payload);
      else await transportApi.createVehicle(payload);
      setVehicleDraft(null);
      await refresh(draft.id ? "Vehicle saved." : "Vehicle added.");
    }, "Unable to save the vehicle");
  }

  function removeVehicle() {
    const draft = vehicleDraft;
    if (!draft?.id) return;
    if (!window.confirm(`Delete vehicle ${draft.registrationNumber}? Routes using it will have no vehicle.`)) return;
    run(async () => {
      await transportApi.removeVehicle(draft.id!);
      setVehicleDraft(null);
      await refresh("Vehicle deleted.");
    }, "Unable to delete the vehicle");
  }

  // -------------------------------------------------------------- routes

  function openRoute(detail?: TransportRouteDetail) {
    setFormError("");
    setRouteDraft(
      detail
        ? {
            id: detail.id,
            name: detail.name,
            vehicleId: detail.vehicle?.id ?? "",
            stops: detail.stops.map((stop) => ({
              id: stop.id,
              name: stop.name,
              pickupTime: stop.pickupTime ?? "",
              dropTime: stop.dropTime ?? ""
            }))
          }
        : { name: "", vehicleId: "", stops: [{ name: "", pickupTime: "", dropTime: "" }] }
    );
  }

  function updateStop(index: number, patch: Partial<StopDraft>) {
    if (!routeDraft) return;
    setRouteDraft({ ...routeDraft, stops: routeDraft.stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)) });
  }

  function moveStop(index: number, delta: number) {
    if (!routeDraft) return;
    const stops = [...routeDraft.stops];
    const target = index + delta;
    if (target < 0 || target >= stops.length) return;
    [stops[index], stops[target]] = [stops[target], stops[index]];
    setRouteDraft({ ...routeDraft, stops });
  }

  function saveRoute() {
    const draft = routeDraft;
    if (!draft) return;
    if (draft.name.trim().length < 2) return setFormError("Give the route a name.");
    const stops = draft.stops.filter((stop) => stop.id || stop.name.trim() || stop.pickupTime || stop.dropTime);
    if (stops.some((stop) => stop.name.trim().length < 2)) return setFormError("Name every stop.");

    const payload = {
      name: draft.name.trim(),
      vehicleId: draft.vehicleId || null,
      stops: stops.map((stop) => ({
        ...(stop.id ? { id: stop.id } : {}),
        name: stop.name.trim(),
        pickupTime: stop.pickupTime || null,
        dropTime: stop.dropTime || null
      }))
    };
    run(async () => {
      const saved = draft.id ? await transportApi.updateRoute(draft.id, payload) : await transportApi.createRoute(payload);
      setRouteDraft(null);
      setSelectedId(saved.id);
      await refresh(draft.id ? "Route saved." : "Route added.");
    }, "Unable to save the route");
  }

  function removeRoute() {
    const draft = routeDraft;
    if (!draft?.id) return;
    if (!window.confirm(`Delete ${draft.name}? Its students will have no route. Their fees do not change.`)) return;
    run(async () => {
      await transportApi.removeRoute(draft.id!);
      setRouteDraft(null);
      setSelectedId(null);
      await refresh("Route deleted.");
    }, "Unable to delete the route");
  }

  async function unassign(student: TransportRouteDetail["students"][number]) {
    if (!window.confirm(`Take ${student.fullName} off this route?`)) return;
    try {
      await transportApi.unassign(student.id);
      await refresh(`${student.fullName} removed from the route.`);
    } catch (err) {
      setError(errorText(err, "Unable to remove the student"));
    }
  }

  const summary = data?.summary;
  const tiles = [
    { label: "Routes", value: summary?.routes ?? 0, bg: "bg-[#E5F7FF]" },
    { label: "Vehicles", value: summary?.vehicles ?? 0, bg: "bg-[#F1E4FF]" },
    { label: "Students on Transport", value: summary?.studentsOnTransport ?? 0, bg: "bg-[#EAF9EB]" },
    { label: "Seats", value: summary?.seats ?? 0, bg: "bg-[#FFF0E8]" }
  ];

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">School Management</p>
          <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-[#1d1d1f]">Transport</h1>
          <p className="mt-1 text-[13px] text-[#5A6573]">Vehicles, routes with their stops, and which students ride them. Assigning a route does not change any fee.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={`${secondaryButton} inline-flex items-center`} href="/reports/transport">Transport Report</Link>
          <button className={secondaryButton} onClick={() => openVehicle()} type="button">Add Vehicle</button>
          <button className={primaryButton} onClick={() => openRoute()} type="button">Add Route</button>
        </div>
      </div>

      {error ? <div className="rounded-[8px] bg-[#FCE3E5] px-4 py-3 text-[13px] font-semibold text-[#C8242C]">{error}</div> : null}
      {notice ? (
        <div className="flex items-center justify-between rounded-[8px] bg-[#E1F5EA] px-4 py-3 text-[13px] font-semibold text-[#0F8A4A]">
          <span>{notice}</span>
          <button className="underline-offset-2 hover:underline" onClick={() => setNotice("")} type="button">Dismiss</button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {tiles.map((tile) => (
          <div className={`rounded-[8px] px-5 py-4 shadow-[0_1px_2px_rgba(15,20,25,0.04)] ${tile.bg}`} key={tile.label}>
            <p className="truncate text-[14px] font-medium text-[#6F7480]">{tile.label}</p>
            <p className="mt-1.5 truncate text-[22px] font-bold text-[#111827] [font-variant-numeric:tabular-nums] sm:text-[26px]">{loading ? "—" : tile.value}</p>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white">
        <h2 className="border-b border-[#DCE1E8] px-4 py-3 text-[15px] font-semibold text-[#0F1419]">Routes</h2>
        {loading ? (
          <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, index) => <Skeleton className="h-14" key={index} />)}</div>
        ) : !data || data.routes.length === 0 ? (
          <p className="px-4 py-12 text-center text-[13px] font-medium text-[#86868b]">No routes yet. Add a vehicle, then a route with its stops.</p>
        ) : (
          <div className="divide-y divide-[#EEF1F5]">
            {data.routes.map((item) => {
              const capacity = item.vehicle?.capacity;
              const over = capacity !== undefined && item.studentCount > capacity;
              return (
                <div className={`flex items-center justify-between gap-3 px-4 py-3 ${selectedId === item.id ? "bg-[#F4F7FE]" : ""}`} key={item.id}>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[#0F1419]">{item.name}</p>
                    <p className="truncate text-[12px] text-[#5A6573]">
                      {vehicleLabel(item.vehicle)} · {item.stops.length} {item.stops.length === 1 ? "stop" : "stops"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusPill label={capacity ? `${item.studentCount}/${capacity} seats` : `${item.studentCount} students`} tone={over ? "danger" : "neutral"} />
                    <button className={smallButton} onClick={() => setSelectedId(selectedId === item.id ? null : item.id)} type="button">
                      {selectedId === item.id ? "Close" : "Open"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {selectedId ? (
        <section className="overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white">
          {routeLoading && !route ? (
            <div className="space-y-2 p-4"><Skeleton className="h-10" /><Skeleton className="h-24" /></div>
          ) : route ? (
            <>
              <div className="flex flex-col gap-3 border-b border-[#DCE1E8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate text-[16px] font-semibold text-[#0F1419]">{route.name}</h2>
                  <p className="text-[12px] text-[#5A6573]">
                    {vehicleLabel(route.vehicle)}
                    {route.vehicle?.driverPhone ? ` · ${route.vehicle.driverPhone}` : ""}
                    {route.vehicle ? ` · ${route.vehicle.capacity} seats` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className={secondaryButton} onClick={() => openRoute(route)} type="button">Edit Route</button>
                  <button className={primaryButton} onClick={() => { setFormError(""); setAssigning(true); }} type="button">Add Students</button>
                </div>
              </div>

              <div className="grid gap-0 lg:grid-cols-[280px_1fr]">
                <div className="border-b border-[#EEF1F5] px-4 py-3 lg:border-b-0 lg:border-r">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-[#5A6573]">Stops</p>
                  {route.stops.length === 0 ? (
                    <p className="mt-2 text-[13px] text-[#86868b]">No stops yet.</p>
                  ) : (
                    <ol className="mt-2 space-y-2">
                      {route.stops.map((stop) => (
                        <li className="flex gap-2" key={stop.id}>
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E8EEFC] text-[11px] font-bold text-[#2456E6]">{stop.sequence}</span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[#0F1419]">{stop.name}</p>
                            {stopTimes(stop) ? <p className="text-[12px] text-[#5A6573]">{stopTimes(stop)}</p> : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                <div className="min-w-0">
                  <p className="px-4 pt-3 text-[12px] font-semibold uppercase tracking-wide text-[#5A6573]">Students ({route.students.length})</p>
                  {route.students.length === 0 ? (
                    <p className="px-4 py-8 text-center text-[13px] text-[#86868b]">Nobody rides this route yet.</p>
                  ) : (
                    <div className="mt-2 divide-y divide-[#EEF1F5]">
                      {route.students.map((student) => (
                        <div className="flex items-center justify-between gap-3 px-4 py-2.5" key={student.id}>
                          <div className="min-w-0">
                            <p className="truncate text-[14px] font-semibold text-[#0F1419]">{student.fullName}</p>
                            <p className="truncate text-[12px] text-[#5A6573]">
                              {student.className} · {route.stops.find((stop) => stop.id === student.stopId)?.name ?? "No stop"} · {student.parentPhone}
                            </p>
                            {!student.transportRequired ? (
                              <div className="mt-1"><StatusPill label="Not marked as needing transport" tone="warn" /></div>
                            ) : null}
                          </div>
                          <button className={smallButton} onClick={() => unassign(student)} type="button">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-[8px] border border-[#DCE1E8] bg-white">
        <h2 className="border-b border-[#DCE1E8] px-4 py-3 text-[15px] font-semibold text-[#0F1419]">Vehicles</h2>
        {loading ? (
          <div className="space-y-2 p-4"><Skeleton className="h-12" /></div>
        ) : !data || data.vehicles.length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] font-medium text-[#86868b]">No vehicles yet.</p>
        ) : (
          <div className="divide-y divide-[#EEF1F5]">
            {data.vehicles.map((vehicle) => (
              <div className="flex items-center justify-between gap-3 px-4 py-3" key={vehicle.id}>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-[#0F1419]">{vehicle.registrationNumber} · {vehicle.capacity} seats</p>
                  <p className="truncate text-[12px] text-[#5A6573]">
                    {vehicle.driverName ?? "No driver"}{vehicle.driverPhone ? ` · ${vehicle.driverPhone}` : ""}
                    {" · "}{vehicle.routes.length ? vehicle.routes.map((item) => item.name).join(", ") : "Not on a route"}
                  </p>
                </div>
                <button className={smallButton} onClick={() => openVehicle(vehicle)} type="button">Edit</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Modal
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            {vehicleDraft?.id ? (
              <button className="min-h-10 rounded-[6px] px-4 text-[13px] font-semibold text-[#C8242C] hover:bg-[#FCE3E5] disabled:opacity-50" disabled={saving} onClick={removeVehicle} type="button">Delete vehicle</button>
            ) : <span />}
            <div className="flex gap-2">
              <button className={`${secondaryButton} flex-1 sm:flex-none`} onClick={() => setVehicleDraft(null)} type="button">Cancel</button>
              <button className={`${primaryButton} flex-1 sm:flex-none`} disabled={saving} onClick={saveVehicle} type="button">{saving ? "Saving..." : "Save vehicle"}</button>
            </div>
          </div>
        }
        isOpen={Boolean(vehicleDraft)}
        onClose={() => setVehicleDraft(null)}
        title={vehicleDraft?.id ? "Edit Vehicle" : "Add Vehicle"}
      >
        {vehicleDraft ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[13px] font-semibold text-[#0F1419]">Registration number<span className="ml-1 text-[#C8242C]">*</span></span>
                <input className={`${fieldClass} mt-1.5 uppercase`} maxLength={20} onChange={(event) => setVehicleDraft({ ...vehicleDraft, registrationNumber: event.target.value })} placeholder="GJ01AB1234" value={vehicleDraft.registrationNumber} />
              </label>
              <label className="block">
                <span className="text-[13px] font-semibold text-[#0F1419]">Seats<span className="ml-1 text-[#C8242C]">*</span></span>
                <input className={`${fieldClass} mt-1.5`} inputMode="numeric" min="1" onChange={(event) => setVehicleDraft({ ...vehicleDraft, capacity: event.target.value })} placeholder="40" type="number" value={vehicleDraft.capacity} />
              </label>
              <label className="block">
                <span className="text-[13px] font-semibold text-[#0F1419]">Driver name</span>
                <input className={`${fieldClass} mt-1.5`} maxLength={100} onChange={(event) => setVehicleDraft({ ...vehicleDraft, driverName: event.target.value })} value={vehicleDraft.driverName} />
              </label>
              <label className="block">
                <span className="text-[13px] font-semibold text-[#0F1419]">Driver phone</span>
                <input className={`${fieldClass} mt-1.5`} inputMode="numeric" maxLength={10} onChange={(event) => setVehicleDraft({ ...vehicleDraft, driverPhone: event.target.value.replace(/\D/g, "") })} placeholder="10 digits" value={vehicleDraft.driverPhone} />
              </label>
            </div>
            {formError ? <p className="rounded-[6px] bg-[#FCE3E5] px-3 py-2 text-[12px] font-semibold text-[#C8242C]">{formError}</p> : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            {routeDraft?.id ? (
              <button className="min-h-10 rounded-[6px] px-4 text-[13px] font-semibold text-[#C8242C] hover:bg-[#FCE3E5] disabled:opacity-50" disabled={saving} onClick={removeRoute} type="button">Delete route</button>
            ) : <span />}
            <div className="flex gap-2">
              <button className={`${secondaryButton} flex-1 sm:flex-none`} onClick={() => setRouteDraft(null)} type="button">Cancel</button>
              <button className={`${primaryButton} flex-1 sm:flex-none`} disabled={saving} onClick={saveRoute} type="button">{saving ? "Saving..." : "Save route"}</button>
            </div>
          </div>
        }
        isOpen={Boolean(routeDraft)}
        onClose={() => setRouteDraft(null)}
        size="lg"
        title={routeDraft?.id ? "Edit Route" : "Add Route"}
      >
        {routeDraft ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-[13px] font-semibold text-[#0F1419]">Route name<span className="ml-1 text-[#C8242C]">*</span></span>
                <input className={`${fieldClass} mt-1.5`} maxLength={80} onChange={(event) => setRouteDraft({ ...routeDraft, name: event.target.value })} placeholder="Route 1 - Satellite" value={routeDraft.name} />
              </label>
              <label className="block">
                <span className="text-[13px] font-semibold text-[#0F1419]">Vehicle</span>
                <CustomSelect
                  ariaLabel="Vehicle"
                  className="h-11 w-full text-[14px]"
                  onChange={(value) => setRouteDraft({ ...routeDraft, vehicleId: value })}
                  options={[
                    { label: "No vehicle", value: "" },
                    ...(data?.vehicles ?? []).map((vehicle) => ({ label: `${vehicle.registrationNumber} (${vehicle.capacity} seats)`, value: vehicle.id }))
                  ]}
                  value={routeDraft.vehicleId}
                  wrapperClassName="mt-1.5 block w-full"
                />
              </label>
            </div>

            <div>
              <p className="text-[13px] font-semibold text-[#0F1419]">Stops, in travel order</p>
              <div className="mt-2 space-y-2">
                {routeDraft.stops.map((stop, index) => (
                  <div className="grid grid-cols-[auto_1fr] items-center gap-2 rounded-[6px] border border-[#DCE1E8] p-2 sm:grid-cols-[auto_1fr_110px_110px_auto]" key={stop.id ?? `new-${index}`}>
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#E8EEFC] text-[12px] font-bold text-[#2456E6]">{index + 1}</span>
                    <input aria-label={`Stop ${index + 1} name`} className={fieldClass} maxLength={100} onChange={(event) => updateStop(index, { name: event.target.value })} placeholder="Stop name" value={stop.name} />
                    <input aria-label={`Stop ${index + 1} pickup time`} className={`${fieldClass} col-span-2 sm:col-span-1`} onChange={(event) => updateStop(index, { pickupTime: event.target.value })} title="Pickup" type="time" value={stop.pickupTime} />
                    <input aria-label={`Stop ${index + 1} drop time`} className={`${fieldClass} col-span-2 sm:col-span-1`} onChange={(event) => updateStop(index, { dropTime: event.target.value })} title="Drop" type="time" value={stop.dropTime} />
                    <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
                      <button aria-label="Move up" className={smallButton} disabled={index === 0} onClick={() => moveStop(index, -1)} type="button">↑</button>
                      <button aria-label="Move down" className={smallButton} disabled={index === routeDraft.stops.length - 1} onClick={() => moveStop(index, 1)} type="button">↓</button>
                      <button aria-label="Remove stop" className={smallButton} onClick={() => setRouteDraft({ ...routeDraft, stops: routeDraft.stops.filter((_, i) => i !== index) })} type="button">✕</button>
                    </div>
                  </div>
                ))}
              </div>
              <button className={`${smallButton} mt-2`} onClick={() => setRouteDraft({ ...routeDraft, stops: [...routeDraft.stops, { name: "", pickupTime: "", dropTime: "" }] })} type="button">+ Add stop</button>
              <p className="mt-2 text-[12px] text-[#5A6573]">Times are optional. Students at a removed stop stay on the route without a stop.</p>
            </div>

            {formError ? <p className="rounded-[6px] bg-[#FCE3E5] px-3 py-2 text-[12px] font-semibold text-[#C8242C]">{formError}</p> : null}
          </div>
        ) : null}
      </Modal>

      {route ? (
        <AssignStudentsModal
          isOpen={assigning}
          onClose={() => setAssigning(false)}
          onDone={async (count) => {
            setAssigning(false);
            await refresh(`${count} ${count === 1 ? "student" : "students"} added to ${route.name}.`);
          }}
          route={route}
        />
      ) : null}
    </div>
  );
}

function AssignStudentsModal({
  isOpen,
  onClose,
  onDone,
  route
}: {
  isOpen: boolean;
  onClose: () => void;
  onDone: (count: number) => Promise<void>;
  route: TransportRouteDetail;
}) {
  const [classes, setClasses] = useState<ClassSummary[]>([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [stopId, setStopId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setPicked(new Set());
    setStopId(route.stops[0]?.id ?? "");
    setError("");
    classesApi.list().then((rows) => {
      setClasses(rows);
      setClassId((current) => current || rows[0]?.id || "");
    }).catch((err) => setError(errorText(err, "Unable to load classes")));
  }, [isOpen, route.stops]);

  useEffect(() => {
    if (!isOpen || !classId) return;
    setLoading(true);
    setPicked(new Set());
    classesApi.students(classId)
      .then(setStudents)
      .catch((err) => setError(errorText(err, "Unable to load students")))
      .finally(() => setLoading(false));
  }, [classId, isOpen]);

  const onRoute = new Set(route.students.map((student) => student.id));
  const available = students.filter((student) => !onRoute.has(student.id));

  function toggle(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  }

  async function save() {
    if (picked.size === 0) return setError("Choose at least one student.");
    setSaving(true);
    setError("");
    try {
      const result = await transportApi.assign({ studentIds: [...picked], routeId: route.id, stopId: stopId || null });
      await onDone(result.assigned);
    } catch (err) {
      setError(errorText(err, "Unable to add the students"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      description="Students already on another route move to this one."
      footer={
        <div className="flex w-full justify-end gap-2">
          <button className={secondaryButton} onClick={onClose} type="button">Cancel</button>
          <button className={primaryButton} disabled={saving} onClick={save} type="button">{saving ? "Adding..." : `Add ${picked.size || ""} to route`}</button>
        </div>
      }
      isOpen={isOpen}
      onClose={onClose}
      title={`Add Students · ${route.name}`}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-[13px] font-semibold text-[#0F1419]">Class</span>
            <CustomSelect
              ariaLabel="Class"
              className="h-11 w-full text-[14px]"
              onChange={setClassId}
              options={classes.map((item) => ({ label: `${item.name}-${item.section}`, value: item.id }))}
              value={classId}
              wrapperClassName="mt-1.5 block w-full"
            />
          </label>
          <label className="block">
            <span className="text-[13px] font-semibold text-[#0F1419]">Stop</span>
            <CustomSelect
              ariaLabel="Stop"
              className="h-11 w-full text-[14px]"
              onChange={setStopId}
              options={[{ label: "No stop yet", value: "" }, ...route.stops.map((stop) => ({ label: `${stop.sequence}. ${stop.name}`, value: stop.id }))]}
              value={stopId}
              wrapperClassName="mt-1.5 block w-full"
            />
          </label>
        </div>

        <div className="max-h-[320px] overflow-y-auto rounded-[6px] border border-[#DCE1E8]">
          {loading ? (
            <div className="space-y-2 p-3"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
          ) : available.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-[#86868b]">Every student in this class is already on this route.</p>
          ) : (
            <>
              <label className="flex items-center gap-3 border-b border-[#EEF1F5] bg-[#F7F8FB] px-3 py-2 text-[13px] font-semibold text-[#2A3340]">
                <input
                  checked={picked.size === available.length}
                  onChange={() => setPicked(picked.size === available.length ? new Set() : new Set(available.map((student) => student.id)))}
                  type="checkbox"
                />
                Select all ({available.length})
              </label>
              {available.map((student) => (
                <label className="flex items-center gap-3 border-b border-[#EEF1F5] px-3 py-2 text-[14px] text-[#0F1419] last:border-b-0" key={student.id}>
                  <input checked={picked.has(student.id)} onChange={() => toggle(student.id)} type="checkbox" />
                  <span className="min-w-0 truncate">{student.rollNumber ? `${student.rollNumber}. ` : ""}{student.fullName}</span>
                </label>
              ))}
            </>
          )}
        </div>

        {error ? <p className="rounded-[6px] bg-[#FCE3E5] px-3 py-2 text-[12px] font-semibold text-[#C8242C]">{error}</p> : null}
      </div>
    </Modal>
  );
}
