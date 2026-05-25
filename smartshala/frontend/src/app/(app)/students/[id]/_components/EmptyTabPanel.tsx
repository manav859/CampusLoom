type EmptyTabPanelProps = {
  title: string;
  message: string;
};

export default function EmptyTabPanel({ title, message }: EmptyTabPanelProps) {
  return (
    <section className="rounded-[6px] border border-[#DCE1E8] bg-white p-8 text-center shadow-[0_1px_2px_rgba(15,20,25,0.04)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#86868b]">{title}</p>
      <p className="mt-3 text-[15px] font-medium text-[#1d1d1f]">{message}</p>
    </section>
  );
}
