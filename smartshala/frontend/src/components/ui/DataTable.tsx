import type { ReactNode } from "react";

type Column<T> = {
  align?: "left" | "center" | "right";
  header: ReactNode;
  key: string;
  render: (row: T, index: number) => ReactNode;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  empty?: ReactNode;
  getRowKey: (row: T, index: number) => string;
  rows: T[];
};

const alignClasses = {
  left: "text-left",
  center: "text-center",
  right: "text-right"
};

export function DataTable<T>({ columns, empty, getRowKey, rows }: DataTableProps<T>) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-200)] bg-white shadow-[var(--shadow-card)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead>
            <tr className="bg-[var(--brand-secondary)]">
              {columns.map((column) => (
                <th key={column.key} className={`px-5 py-3.5 text-[12px] font-semibold tracking-wide text-white ${alignClasses[column.align ?? "left"]}`}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-200)]">
            {rows.length === 0 ? (
              <tr>
                <td className="px-5 py-12 text-center text-[var(--ink-500)]" colSpan={columns.length}>
                  {empty ?? "No records found."}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr className="transition-colors hover:bg-[var(--surface-50)]" key={getRowKey(row, index)}>
                  {columns.map((column) => (
                    <td key={column.key} className={`px-5 py-4 ${alignClasses[column.align ?? "left"]}`}>
                      {column.render(row, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
