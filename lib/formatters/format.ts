/** Formatting helpers — the one place numbers/dates become strings. */

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatRatio(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(digits);
}

export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value < 1000) return `${Math.round(value)}ms`;
  if (value < 60_000) return `${(value / 1000).toFixed(1)}s`;
  const minutes = Math.floor(value / 60_000);
  const seconds = Math.round((value % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function formatDuration(ms: number | null | undefined): string {
  return formatMs(ms);
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** Today's UTC ISO date (YYYY-MM-DD) — the default analytics window anchor. */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function utcDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------ explanation */

/**
 * Human labels for score-component keys — the engine is deterministic and
 * rule-based; these names must stay truthful to that.
 */
export const COMPONENT_LABELS: Record<string, string> = {
  interest: "Interest",
  identityAffinity: "Identity affinity",
  social: "Social",
  quality: "Quality",
  engagement: "Engagement",
  watch: "Watch",
  freshness: "Freshness",
  popularity: "Popularity",
  ownContent: "Own content",
  watchProbability: "Watch probability",
  expectedWatch: "Expected watch",
  completion: "Completion",
  relevanceWeighted: "Relevance",
  relevanceGate: "Relevance gate",
};

export const DROPPED_REASON_LABELS: Record<string, string> = {
  features_missing: "Features not yet computed — the nightly rebuild has not reached this item",
  negative_rate: "Negative-feedback rate above the configured ceiling",
  exposure_limit: "Shown too many times already (exposure limit)",
  below_min_score: "Score below the configured floor",
};

export const CANDIDATE_SOURCE_LABELS: Record<string, string> = {
  following: "Following",
  identity_affinity: "Identity affinity",
  interest: "Interest",
  trending: "Trending",
  cold_start: "Cold start",
  recent: "Recent",
  quality: "Quality",
};
