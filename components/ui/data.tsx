"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, EmptyState, LoadingState, ErrorState } from "./interactive";

/* =============================================================================
   DataTable — first-class, borderless. Row hover, sticky header, column
   hierarchy via the type ramp, compact spacing, pagination.
   ============================================================================= */

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  align?: "left" | "right";
  className?: string;
  /** Hide below `sm` — mobile tables show identity + numbers only. */
  hideOnMobile?: boolean;
}

export function DataTable<T extends { id?: string } | object>({
  columns,
  rows,
  loading,
  error,
  emptyTitle,
  emptyHint,
  onRetry,
  page,
  pageCount,
  onPageChange,
  total,
  ariaLabel,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  loading?: boolean;
  error?: unknown;
  emptyTitle?: string;
  emptyHint?: string;
  onRetry?: () => void;
  page?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;
  total?: number;
  ariaLabel: string;
}) {
  if (loading) return <LoadingState rows={6} label={`Loading ${ariaLabel}`} />;
  if (error) {
    return (
      <ErrorState
        title={`Could not load ${ariaLabel.toLowerCase()}`}
        detail={error instanceof Error ? error.message : undefined}
        onRetry={onRetry}
      />
    );
  }
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle ?? "Nothing here yet"} hint={emptyHint} />;
  }

  return (
    <div className="min-w-0">
      <div className="-mx-1 overflow-x-auto px-1">
        <table aria-label={ariaLabel} className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={cn(
                    "sticky top-0 z-10 bg-page/95 px-3 pb-2 pt-1 text-[11px] font-medium uppercase tracking-[0.06em] text-ink-4 backdrop-blur",
                    col.align === "right" ? "text-right" : "text-left",
                    col.hideOnMobile && "hidden sm:table-cell",
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={(row as { id?: string }).id ?? i}
                className="group transition-colors hover:bg-surface"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "border-b border-line/60 px-3 py-2.5 align-middle text-ink-2",
                      col.align === "right" && "tnum text-right",
                      col.hideOnMobile && "hidden sm:table-cell",
                      col.className,
                    )}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {typeof pageCount === "number" && pageCount > 1 && onPageChange ? (
        <div className="mt-3 flex items-center justify-between text-xs text-ink-4">
          <span className="tnum">
            {typeof total === "number" ? `${total} total · ` : ""}Page {page! + 1} of {pageCount}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={page === 0}
              onClick={() => onPageChange(page! - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={page! >= pageCount - 1}
              onClick={() => onPageChange(page! + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* =============================================================================
   ChartSection — minimal Recharts wrapper. Neutral grid, exact-value
   tooltips, theme-aware colors. Green only for the primary series.
   ============================================================================= */

export function ChartLegend({
  items,
}: {
  items: Array<{ label: string; color: string }>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-xs text-ink-3">
          <span
            className="h-1.5 w-4 rounded-full"
            style={{ background: item.color }}
            aria-hidden="true"
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export const CHART_COLORS = {
  primary: "var(--color-chart-1)",
  secondary: "var(--color-chart-2)",
  tertiary: "var(--color-chart-3)",
  quaternary: "var(--color-chart-4)",
  quinary: "var(--color-chart-5)",
} as const;

/** Shared axis/tooltip props so every chart reads identically. */
export const chartAxisProps = {
  stroke: "var(--color-ink-4)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;
