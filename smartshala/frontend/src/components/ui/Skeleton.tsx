"use client";

/**
 * Reusable skeleton loading primitives for Apple-style glassmorphic UI.
 * Use these composable pieces to build page-specific loading states.
 */

/* ── Base shimmer block ── */
export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-[#f5f5f7] ${className}`}
      style={{ isolation: "isolate", ...style }}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

/* ── KPI Card skeleton ── */
export function KpiCardSkeleton() {
  return (
    <div className="glass-card-interactive p-5 space-y-3">
      <Skeleton className="h-3 w-16 rounded-md" />
      <Skeleton className="h-7 w-24 rounded-md" />
    </div>
  );
}

/* ── Chart card skeleton ── */
export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div className="glass-card-interactive p-5 flex flex-col" style={{ minHeight: height }}>
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1.5">
          <Skeleton className="h-2.5 w-12 rounded-md" />
          <Skeleton className="h-4 w-28 rounded-md" />
        </div>
        <Skeleton className="h-6 w-20 rounded-md" />
      </div>
      <div className="flex-1 flex items-end gap-3 px-2 pb-2">
        {[65, 80, 50, 90, 70, 85, 60].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t-md" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/* ── Table row skeleton ── */
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <Skeleton className={`h-4 rounded-md ${i === 0 ? "w-16" : i === 1 ? "w-32" : "w-20"}`} />
        </td>
      ))}
    </tr>
  );
}

/* ── Full table skeleton (header + rows) ── */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[rgba(0,0,0,0.06)] bg-white/80 backdrop-blur-xl shadow-[0_2px_20px_-4px_rgba(0,0,0,0.04)]">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="bg-gradient-to-r from-[#1a3c4d] to-[#2a7a94]">
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-5 py-3.5">
                  <Skeleton className="h-3 w-16 rounded-md bg-white/10" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(0,0,0,0.04)]">
            {Array.from({ length: rows }).map((_, i) => (
              <TableRowSkeleton key={i} cols={cols} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Alert/Feed card skeleton ── */
export function AlertSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="glass-card-interactive p-5 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-3 w-16 rounded-md" />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-full max-w-[200px] rounded-md" />
            <Skeleton className="h-2.5 w-24 rounded-md" />
          </div>
          <Skeleton className="h-5 w-14 rounded-full shrink-0" />
        </div>
      ))}
    </div>
  );
}

/* ── Notification stat card skeleton ── */
export function StatCardSkeleton() {
  return (
    <div className="glass-card-interactive p-6 space-y-3">
      <Skeleton className="h-3 w-24 rounded-md" />
      <Skeleton className="h-10 w-16 rounded-md" />
    </div>
  );
}

/* ── Student detail profile skeleton ── */
export function ProfileSkeleton() {
  return (
    <div className="glass-card-interactive p-6 space-y-4">
      <Skeleton className="h-5 w-20 rounded-md" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex justify-between">
          <Skeleton className="h-3.5 w-24 rounded-md" />
          <Skeleton className="h-3.5 w-32 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/* ── Attendance list skeleton ── */
export function AttendanceListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl bg-white border border-[rgba(0,0,0,0.04)] px-4 py-3.5 shadow-apple-sm">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-28 rounded-md" />
            <Skeleton className="h-2.5 w-16 rounded-md" />
          </div>
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
