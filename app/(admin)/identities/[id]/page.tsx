"use client";

import React from "react";
import { useParams } from "next/navigation";
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
import { Badge, LoadingState, ErrorState } from "@/components/ui/interactive";
import { ChartLegend, CHART_COLORS, chartAxisProps } from "@/components/ui/data";
import { useIdentityStats } from "@/lib/api/queries";
import { formatDate, formatCompact, formatNumber, formatRatio, timeAgo } from "@/lib/formatters/format";

/* =============================================================================
   Identity detail — which users are strongly connected to this identity, who
   is seeing its content, and why it surfaces (features + interventions).
   ============================================================================= */

export default function IdentityDetailPage() {
  const params = useParams<{ id: string }>();
  const identityId = params.id;
  const stats = useIdentityStats(identityId, 30);

  if (stats.isLoading) return <LoadingState rows={8} label="Loading identity" />;
  if (stats.error || !stats.data) {
    return <ErrorState title="Could not load identity stats" />;
  }

  const identity = stats.data.identity;
  const features = (stats.data.features ?? {}) as Record<string, number | string | null>;
  const exposure = stats.data.exposure;
  const audience = stats.data.audience;
  const interventions = stats.data.interventions ?? [];

  const series = (exposure.series ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));

  return (
    <div className="space-y-8">
      <PageHeader
        title={identity?.display_name ?? "Identity"}
        meta={
          <>
            <span>@{identity?.username}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{identity?.kind}</span>
            {identity?.verified ? <Badge tone="brand" className="ml-1">verified</Badge> : null}
            {identity?.restricted ? <Badge tone="danger" className="ml-1">restricted</Badge> : null}
          </>
        }
      />

      <Section title="Why this identity surfaces" note="the ranking features the engine holds">
        <div className="rounded-xl bg-surface-2 p-5">
          <MetricRow className="lg:grid-cols-4 sm:grid-cols-3">
            <Metric label="Quality score" value={formatRatio(Number(features.quality_score ?? 0))} tone="brand" />
            <Metric label="Popularity" value={formatRatio(Number(features.popularity_score ?? 0))} />
            <Metric label="Activity" value={formatRatio(Number(features.activity_score ?? 0))} />
            <Metric label="Engagement rate" value={formatRatio(Number(features.engagement_rate ?? 0))} />
            <Metric label="Followers" value={formatNumber(Number(features.followers_count ?? 0))} />
            <Metric label="Content count" value={formatNumber(Number(features.content_count ?? 0))} />
            <Metric label="Content impressions" value={formatCompact(Number(features.content_impressions ?? 0))} />
            <Metric label="Confidence" value={formatRatio(Number(features.confidence ?? 0))} />
          </MetricRow>
          {features.last_post_at ? (
            <div className="mt-4 text-xs text-ink-4">
              Last published {timeAgo(String(features.last_post_at))} · primary game{" "}
              {features.primary_game_id ? String(features.primary_game_id) : "—"}
            </div>
          ) : null}
          {identity?.restricted ? (
            <p className="mt-3 text-[13px] text-danger">
              This identity is restricted — search ranking drops it even though its status is
              active. This is a hard rule, not a ranking weight.
            </p>
          ) : null}
        </div>
      </Section>

      <Section title="Content exposure" note="recommended impressions of this identity's content · 30 days">
        <div className="rounded-xl bg-surface-2 p-5">
          <MetricRow className="lg:grid-cols-3">
            <Metric label="Impressions" value={formatNumber(exposure.impressions)} tone="brand" />
            <Metric label="Posts recommended" value={formatNumber(exposure.posts)} />
            <Metric label="Viewers reached" value={formatNumber(exposure.viewers)} />
          </MetricRow>
          <div className="mt-6 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="identityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="label" {...chartAxisProps} />
                <YAxis {...chartAxisProps} width={36} />
                <Tooltip
                  formatter={(value) => [
                    formatNumber(typeof value === "number" ? value : Number(value) || 0),
                    "Impressions",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={1.5}
                  fill="url(#identityGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend items={[{ label: "Impressions", color: "var(--color-chart-1)" }]} />
        </div>
      </Section>

      <Section title="Audience" note="who is seeing this identity's content">
        <div className="rounded-xl bg-surface-2 p-4">
          {audience.length === 0 ? (
            <div className="px-2 py-8 text-center text-sm text-ink-4">
              No audience in this window — this identity&apos;s content has not been recommended
              recently.
            </div>
          ) : (
            <div className="space-y-1">
              {audience.map((viewer) => (
                <div key={viewer.viewer_id} className="flex items-center gap-3 rounded-lg px-2 py-2 text-[13px]">
                  <span className="min-w-0 flex-1 truncate text-ink-2">
                    {viewer.username ? `@${viewer.username}` : "@deleted"}
                    <span className="ml-1.5 text-[11px] text-ink-4">{viewer.kind ?? "identity"}</span>
                  </span>
                  <span className="tnum text-xs font-medium text-ink">
                    {formatCompact(viewer.impressions)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title="Interventions">
        {interventions.length === 0 ? (
          <div className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-4">
            No interventions target this identity.
          </div>
        ) : (
          <div className="space-y-2">
            {interventions.map((iv) => (
              <div key={iv.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-[13px]">
                <div>
                  <Badge tone={iv.kind === "boost" ? "brand" : "warning"}>{iv.kind}</Badge>
                  <span className="tnum ml-2 text-ink-2">{Number(iv.multiplier).toFixed(2)}×</span>
                  <span className="ml-2 text-ink-4">{iv.reason}</span>
                </div>
                <span className="text-xs text-ink-4">
                  {iv.revoked_at ? "revoked" : `expires ${formatDate(iv.expires_at)}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}
