type Item = {
  label: string;
  value: number;
};

export function SimpleBarChart({ items }: { items: Item[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-neutral-700">{item.label}</span>
            <span className="text-neutral-500">{item.value}%</span>
          </div>
          <div className="h-3 rounded-md bg-neutral-100">
            <div className="h-3 rounded-md bg-action" style={{ width: `${Math.min((item.value / max) * 100, 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

