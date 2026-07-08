import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
  width?: string;
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  loading?: boolean;
  emptyState?: ReactNode;
  pagination?: DataTablePagination;
  onPageChange?: (page: number) => void;
  className?: string;
  rowKey?: (row: T, index: number) => string;
}

export function DataTable<T>({
  columns,
  data,
  loading,
  emptyState,
  pagination,
  onPageChange,
  className,
  rowKey,
}: DataTableProps<T>) {
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;

  return (
    <div
      className={cn(
        "bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    "text-left text-xs font-medium uppercase tracking-wider text-slate-400 px-4 py-3",
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-4">
                      <div className="h-3 rounded bg-white/10 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  {emptyState ?? <EmptyState title="No data" description="Nothing to show yet." />}
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr
                  key={rowKey ? rowKey(row, i) : i}
                  className="border-b border-white/5 last:border-b-0 hover:bg-white/5 transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn("px-4 py-3 text-slate-200", col.className)}
                    >
                      {col.render ? col.render(row) : ((row as Record<string, ReactNode>)[col.key] ?? null)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3">
          <p className="text-xs text-slate-500">
            Page {pagination.page} of {totalPages}
            {" · "}
            {pagination.total} total
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange?.(Math.max(1, pagination.page - 1))}
              disabled={pagination.page <= 1}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => onPageChange?.(Math.min(totalPages, pagination.page + 1))}
              disabled={pagination.page >= totalPages}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
