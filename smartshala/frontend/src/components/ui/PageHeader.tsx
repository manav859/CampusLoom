export function PageHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">{eyebrow}</p> : null}
        <h1 className="text-[28px] font-semibold tracking-tight text-[#1d1d1f] sm:text-[34px]">{title}</h1>
      </div>
      {action ? <div className="w-full sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">{action}</div> : null}
    </div>
  );
}
