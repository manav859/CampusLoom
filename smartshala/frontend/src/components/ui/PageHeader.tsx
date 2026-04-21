export function PageHeader({ title, eyebrow, action }: { title: string; eyebrow?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {eyebrow ? <p className="text-sm font-medium text-action">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-normal text-ink">{title}</h1>
      </div>
      {action}
    </div>
  );
}

