"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Metric, MetricRow, PageHeader, Section } from "@/components/ui/primitives";
import { Badge, StatusDot } from "@/components/ui/interactive";
import { CHART_COLORS, ChartLegend, chartAxisProps } from "@/components/ui/data";
import { DateRangeFilter, rangeToWindow } from "@/components/ui/filters";
import {
  useExposureOverview,
  useInterventions,
  useOverview,
  useTopCreators,
  useTopPosts,
} from "@/lib/api/queries";
import { identityHandle, identityKey, identityName } from "@/types";
import {
  formatCompact,
  formatNumber,
  formatPercent,
  timeAgo,
} from "@/lib/formatters/format";

/* =============================================================================
   Overview — the recommendation operations dashboard. Large heading, key
   metric row, one large chart, distribution tables, real signals only.
   ============================================================================= */

export default function OverviewPage() {
  const searchParams = useSearchParams();
  const effectiveRange = (searchParams.get("range") as "1d" | "7d" | "30d" | "90d") ?? "7d";
  const { from, to } = rangeToWindow(effectiveRange);

  const overview = useOverview();
  const exposure = useExposureOverview(from, to);
  const topPosts = useTopPosts({ from, to, limit: 5 });
  const topCreators = useTopCreators({ from, to, limit: 5 });
  const interventions = useInterventions();

  const activeInterventions = (interventions.data ?? []).filter(
    (row) => !row.revoked_at && new Date(row.expires_at) > new Date(),
  );

  const totals = exposure.data?.totals;
  const series = (exposure.data?.series ?? []).map((point) => ({
    ...point,
    label: point.date.slice(5),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        meta={
          <>
            <StatusDot tone={overview.error ? "danger" : "live"} label={overview.error ? "Backend unreachable" : "Engine healthy"} pulse={!overview.error} />
            {overview.data?.activeVersion ? (
              <span>
                Active config{" "}
                <Link
                  href="/configuration"
                  className="font-mono text-[12px] font-medium text-ink-2 hover:text-brand"
                >
                  {overview.data.activeVersion.label}
                </Link>
                {overview.data.activeVersion.fallback ? (
                  <Badge tone="warning" className="ml-1.5">defaults</Badge>
                ) : null}
              </span>
            ) : null}
          </>
        }
        actions={<DateRangeFilter value={effectiveRange} />}
      />

      {/* System status */}
      <Section title="Recommendation system" note="Per-surface rollout switches from the active config">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {(["feed", "shorts", "search"] as const).map((surface) => {
            const enabled = Boolean(
              (overview.data as unknown as { config?: Record<string, { enabled?: boolean }> } | undefined)
                ?.config?.[surface]?.enabled ?? true,
            );
            return (
              <div key={surface} className="rounded-xl bg-surface-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium capitalize text-ink">{surface}</span>
                  <StatusDot
                    tone={enabled ? "live" : "idle"}
                    label={enabled ? "Ranked" : "Chronological"}
                  />
                </div>
                <div className="mt-2 text-xs text-ink-4">
                  {enabled
                    ? "Personalised ranking active"
                    : "Ranking off — surface falls back to chronological order"}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-4">
          <span>
            Feature rebuild{" "}
            <span className="text-ink-2">
              {timeAgo(overview.data?.featureFreshness?.user?.last_computed_at)}
            </span>
          </span>
          <span>
            Content features{" "}
            <span className="text-ink-2">
              {formatNumber(overview.data?.featureFreshness?.content?.rows)} rows
            </span>
          </span>
          <span>
            User profiles{" "}
            <span className="text-ink-2">
              {formatNumber(overview.data?.featureFreshness?.user?.rows)} rows
            </span>
          </span>
          <span>
            Interventions <span className="text-ink-2">{activeInterventions.length} active</span>
          </span>
        </div>
      </Section>

      {/* Exposure metrics */}
      <Section title={`Exposure · last ${effectiveRange === "1d" ? "day" : effectiveRange}`} note="Recommended impressions recorded by the engine">
        <div className="rounded-xl bg-surface-2 p-5">
          <MetricRow>
            <Metric
              label="Impressions"
              value={formatNumber(totals?.impressions)}
              sub={`over ${formatNumber(totals?.days ?? 0)} days`}
              tone="brand"
              loading={exposure.isLoading}
            />
            <Metric label="Unique viewers" value={formatNumber(totals?.viewers)} loading={exposure.isLoading} />
            <Metric label="Posts recommended" value={formatNumber(totals?.posts)} loading={exposure.isLoading} />
            <Metric label="Creators exposed" value={formatNumber(totals?.creators)} loading={exposure.isLoading} />
            <Metric
              label="Avg / viewer"
              value={
                totals && totals.viewers > 0
                  ? formatRatio(totals.impressions / totals.viewers)
                  : "—"
              }
              loading={exposure.isLoading}
            />
          </MetricRow>

          <div className="mt-6 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="impGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="label" {...chartAxisProps} />
                <YAxis {...chartAxisProps} width={44} />
                <Tooltip
                  formatter={(value, name) => [
                    formatNumber(typeof value === "number" ? value : Number(value) || 0),
                    name === "impressions" ? "Impressions" : String(name),
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={1.5}
                  fill="url(#impGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2">
            <ChartLegend items={[{ label: "Recommended impressions", color: "var(--color-chart-1)" }]} />
          </div>
        </div>
      </Section>

      {/* Distribution */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Section title="Top recommended posts" note="By exposure">
          <div className="space-y-1.5">
            {(topPosts.data?.rows ?? []).map((row, i) => (
              <Link
                key={row.post_id}
                href={`/content/${row.post_id}`}
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
              >
                <span className="tnum w-5 text-right text-xs font-medium text-ink-4">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">
                    {row.post?.caption || "Untitled"}
                  </div>
                  <div className="text-xs text-ink-4">
                    {identityHandle(row.author)}
                    {row.game ? ` · ${row.game}` : ""}
                  </div>
                </div>
                <span className="tnum text-[13px] font-semibold text-ink-2">
                  {formatCompact(row.impressions)}
                </span>
              </Link>
            ))}
            {topPosts.isLoading ? <div className="px-2 text-xs text-ink-4">Loading…</div> : null}
            {!topPosts.isLoading && (topPosts.data?.rows ?? []).length === 0 ? (
              <div className="px-2 text-xs text-ink-4">
                No recorded recommendations in this window yet. Exposure accumulates as users open their feeds.
              </div>
            ) : null}
          </div>
        </Section>

        <Section title="Top creators by exposure" note="Concentration watch">
          <div className="space-y-1.5">
            {(topCreators.data?.rows ?? []).map((row, i) => (
              <div key={identityKey(row.creator, `creator-${i}`)} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <span className="tnum w-5 text-right text-xs font-medium text-ink-4">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">
                    {identityName(row.creator)}
                    {row.creator?.verified ? <span className="ml-1 text-brand">✓</span> : null}
                  </div>
                  <div className="text-xs text-ink-4">
                    {identityHandle(row.creator)} · {formatNumber(row.posts)} posts
                  </div>
                </div>
                <div className="text-right">
                  <div className="tnum text-[13px] font-semibold text-ink-2">
                    {formatCompact(row.impressions)}
                  </div>
                  <div className="tnum text-[11px] text-ink-4">{formatPercent(row.share / 100)}</div>
                </div>
              </div>
            ))}
            {!topCreators.isLoading && (topCreators.data?.rows ?? []).length === 0 ? (
              <div className="px-2 text-xs text-ink-4">No exposure recorded in this window.</div>
            ) : null}
          </div>
        </Section>
      </div>

      {/* Signals — real only */}
      <Section title="Signals" note="Only conditions the backend can actually report">
        <div className="rounded-xl bg-surface-2 p-4">
          <div className="space-y-2.5 text-[13px]">
            <SignalRow
              tone={activeInterventions.length > 0 ? "warn" : "ok"}
              label="Active interventions"
              value={
                activeInterventions.length === 0
                  ? "None active"
                  : `${activeInterventions.length} live — review on the Interventions page`
              }
              href={activeInterventions.length > 0 ? "/interventions" : undefined}
            />
            <SignalRow
              tone={
                (topCreators.data?.rows ?? [])[0] &&
                (topCreators.data?.rows ?? [])[0].share > 50
                  ? "warn"
                  : "ok"
              }
              label="Creator concentration"
              value={
                (topCreators.data?.rows ?? [])[0]
                  ? `Top creator holds ${formatPercent((topCreators.data?.rows ?? [])[0].share / 100)} of exposure`
                  : "No exposure data in window"
              }
            />
            <SignalRow
              tone={overview.data?.activeVersion?.fallback ? "warn" : "ok"}
              label="Configuration"
              value={
                overview.data?.activeVersion?.fallback
                  ? "Built-in defaults serving — no stored version is active"
                  : `Active: ${overview.data?.activeVersion?.label ?? "—"}`
              }
              href="/configuration"
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

function SignalRow({
  tone,
  label,
  value,
  href,
}: {
  tone: "ok" | "warn";
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-3">
      <StatusDot tone={tone === "ok" ? "ok" : "warn"} />
      <span className="w-44 shrink-0 text-ink-3">{label}</span>
      <span className="text-ink-2">{value}</span>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-lg px-2 py-1 transition-colors hover:bg-surface-3">
      {content}
    </Link>
  ) : (
    <div className="px-2 py-1">{content}</div>
  );
}

function formatRatio(value: number): string {
  return value.toFixed(1);
}
