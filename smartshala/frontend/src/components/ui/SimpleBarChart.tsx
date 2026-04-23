type Item = {
  label: string;
  value: number;
};

export function SimpleBarChart({ items }: { items: Item[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-2 flex items-center justify-between gap-3 text-[13px]">
            <span className="font-medium text-[#1d1d1f]">{item.label}</span>
            <span className="font-medium text-[#86868b]">{item.value}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#e8e8ed]">
            <div
              className="h-2 rounded-full bg-[#0071e3] transition-all duration-500 ease-apple"
              style={{ width: `${Math.min((item.value / max) * 100, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
