import { cn } from "@/lib/utils/cn";

/**
 * PageHeader — the large heading + metadata row every page opens with.
 * Hierarchy from typography, not boxes.
 */
export function PageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {meta ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-3">
            {meta}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/**
 * Section — a titled block within a page. A muted eyebrow label + optional
 * trailing note; separation comes from spacing and the label ramp.
 */
export function Section({
  title,
  note,
  children,
  className,
}: {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-medium uppercase tracking-[0.08em] text-ink-3">
          {title}
        </h2>
        {note ? <span className="text-xs text-ink-4">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * Metric — one number with its label. Renders inline in a MetricRow; never a
 * boxed card. `tone="brand"` marks the single most important number on a page.
 */
export function Metric({
  label,
  value,
  sub,
  tone = "default",
  loading,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "default" | "brand" | "warning";
  loading?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-ink-3">{label}</div>
      <div
        className={cn(
          "tnum mt-1 text-[26px] leading-8 font-semibold tracking-tight",
          tone === "brand" && "text-brand",
          tone === "warning" && "text-warning",
          tone === "default" && "text-ink",
        )}
      >
        {loading ? <span className="text-ink-4">—</span> : value}
      </div>
      {sub ? <div className="mt-0.5 text-xs text-ink-4">{sub}</div> : null}
    </div>
  );
}

/** MetricRow — the "key metrics" band: evenly spaced, divided by hairlines. */
export function MetricRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
