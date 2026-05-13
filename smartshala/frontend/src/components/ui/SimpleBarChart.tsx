type Item = {
  label: string;
  value: number;
  /** When true the bar is replaced with a "Not marked" label */
  notMarked?: boolean;
};

export function SimpleBarChart({ items }: { items: Item[] }) {
  const markedItems = items.filter((i) => !i.notMarked);
  const max = Math.max(...markedItems.map((item) => item.value), 1);
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-2 flex items-center justify-between gap-3 text-[13px]">
            <span className="font-medium text-[#1d1d1f]">{item.label}</span>
            {item.notMarked ? (
              <span className="rounded-full bg-[#fff2dc] px-2.5 py-0.5 text-[12px] font-semibold text-[#b95a00]">Not marked</span>
            ) : (
              <span className="font-medium text-[#86868b]">{item.value}%</span>
            )}
          </div>
          {item.notMarked ? (
            <div className="h-2 rounded-full bg-[#e8e8ed]" />
          ) : (
            <div className="h-2 rounded-full bg-[#e8e8ed]">
              <div
                className="h-2 rounded-full bg-[#0071e3] transition-all duration-500 ease-apple"
                style={{ width: `${Math.min((item.value / max) * 100, 100)}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
