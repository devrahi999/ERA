"use client";

import React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { utcDaysAgo, utcToday } from "@/lib/formatters/format";

/* =============================================================================
   FilterBar — reusable, URL-state-aware filters. Values live in the query
   string so a debugger context survives a page refresh and can be shared.
   ============================================================================= */

export type DateRangeValue = "1d" | "7d" | "30d" | "90d";

const RANGE_DAYS: Record<DateRangeValue, number> = { "1d": 1, "7d": 7, "30d": 30, "90d": 90 };

export function rangeToWindow(range: DateRangeValue): { from: string; to: string } {
  return { from: utcDaysAgo(RANGE_DAYS[range] - 1), to: utcToday() };
}

export function windowToRange(from: string, to: string): DateRangeValue {
  const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1;
  if (days <= 1) return "1d";
  if (days <= 7) return "7d";
  if (days <= 30) return "30d";
  return "90d";
}

export function FilterBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 px-3 py-2",
        className,
      )}
      role="search"
    >
      {children}
    </div>
  );
}

/** A URL-synced select. Empty value = filter not applied. */
export function FilterSelect({
  name,
  value,
  options,
  label,
}: {
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set(name, next);
    else params.delete(name);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <label className="flex items-center gap-1.5 text-xs text-ink-3">
      <span className="hidden sm:inline">{label}</span>
      <select
        value={value}
        onChange={(e) => setParam(e.target.value)}
        className="rounded-lg bg-surface-3 px-2 py-1 text-xs font-medium text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** URL-synced date-range segmented control. */
export function DateRangeFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setRange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const ranges: Array<{ id: DateRangeValue; label: string }> = [
    { id: "1d", label: "Today" },
    { id: "7d", label: "7d" },
    { id: "30d", label: "30d" },
    { id: "90d", label: "90d" },
  ];

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg bg-surface-3 p-0.5"
      role="group"
      aria-label="Date range"
    >
      {ranges.map((range) => (
        <button
          key={range.id}
          onClick={() => setRange(range.id)}
          aria-pressed={value === range.id}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium transition-colors",
            value === range.id ? "bg-brand text-brand-ink" : "text-ink-3 hover:text-ink",
          )}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

/** URL-synced free-text search input (debounced push). */
export function FilterSearch({
  name = "q",
  value,
  placeholder,
}: {
  name?: string;
  value: string;
  placeholder: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [local, setLocal] = React.useState(value);

  // When the URL value changes externally (navigation, cleared filters), reset
  // the local buffer by keying the state to the incoming value.
  const [lastUrlValue, setLastUrlValue] = React.useState(value);
  if (value !== lastUrlValue) {
    setLastUrlValue(value);
    setLocal(value);
  }

  React.useEffect(() => {
    if (local === value) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (local) params.set(name, local);
      else params.delete(name);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  return (
    <input
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="min-w-[180px] flex-1 rounded-lg bg-surface-3 px-3 py-1.5 text-xs text-ink outline-none placeholder:text-ink-4 focus-visible:outline-2 focus-visible:outline-brand"
    />
  );
}
