"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { Badge } from "@/components/ui/interactive";
import { DataTable, CHART_COLORS, chartAxisProps, type Column } from "@/components/ui/data";
import { DateRangeFilter, rangeToWindow } from "@/components/ui/filters";
import { useExposureOverview, useTopPosts } from "@/lib/api/queries";
import type { TopPostRow } from "@/types";
import { identityHandle } from "@/types";
import {
  formatCompact,
  formatMs,
  formatNumber,
  formatPercent,
  formatRatio,
  timeAgo,
} from "@/lib/formatters/format";

/* =============================================================================
   The shared Feed/Shorts recommendation analytics page. Exposure metrics from
   the engine's daily log; engagement from the analytics rollups (a different
   funnel — both shown, never conflated).
   ============================================================================= */

export function SurfacePostsPage({
  surface,
  title,
  description,
}: {
  surface: "feed" | "shorts";
  title: string;
  description: string;
}) {
  const searchParams = useSearchParams();
  const range = (searchParams.get("range") as "1d" | "7d" | "30d" | "90d") ?? "30d";
  const kind = surface === "shorts" ? "short" : "post";
  const { from, to } = rangeToWindow(range);

  const overview = useExposureOverview(from, to, surface);
  const posts = useTopPosts({ from, to, surface, kind, limit: 25, offset: 0 });

  const totals = overview.data?.totals;
  const series = (overview.data?.series ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));

  const engagementRate = (row: TopPostRow): string => {
    const engaged =
      (row.engagement?.reactions ?? 0) +
      (row.engagement?.comments ?? 0) +
      (row.engagement?.shares ?? 0) +
      (row.engagement?.saves ?? 0);
    const impressions = row.impressions || 1;
    return formatPercent(engaged / impressions);
  };

  const columns: Array<Column<TopPostRow>> = [
    {
      key: "post",
      header: "Post",
      render: (row) => (
        <Link href={`/content/${row.post_id}`} className="group block min-w-0">
          <div className="truncate text-[13px] font-medium text-ink group-hover:text-brand">
            {row.post?.caption || "Untitled"}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-4">
            <span>{identityHandle(row.author)}</span>
            {row.game ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{row.game}</span>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            <span>{timeAgo(row.post?.created_at ?? null)}</span>
          </div>
        </Link>
      ),
    },
    {
      key: "impressions",
      header: "Impr.",
      align: "right",
      render: (row) => (
        <div>
          <div className="font-medium text-ink">{formatCompact(row.impressions)}</div>
          <div className="text-[11px] text-ink-4">{formatNumber(row.reach)} reach</div>
        </div>
      ),
    },
    {
      key: "engagement",
      header: "Engagement",
      align: "right",
      hideOnMobile: true,
      render: (row) => {
        const total =
          (row.engagement?.reactions ?? 0) +
          (row.engagement?.comments ?? 0) +
          (row.engagement?.shares ?? 0) +
          (row.engagement?.saves ?? 0);
        return (
          <div>
            <div className="tnum font-medium text-ink-2">{formatCompact(total)}</div>
            <div className="tnum text-[11px] text-ink-4">{engagementRate(row)}</div>
          </div>
        );
      },
    },
    {
      key: "watch",
      header: surface === "shorts" ? "Avg watch" : "Watch",
      align: "right",
      hideOnMobile: true,
      render: (row) => {
        const ms = row.features?.avg_watch_ms ?? 0;
        const completes = row.engagement?.watch_completes ?? 0;
        return (
          <div>
            <div className="tnum text-ink-2">{ms > 0 ? formatMs(ms) : "—"}</div>
            {surface === "shorts" ? (
              <div className="tnum text-[11px] text-ink-4">
                {completes > 0 ? `${formatCompact(completes)} completes` : ""}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "quality",
      header: "Quality",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className="tnum text-ink-2">
          {row.features ? formatRatio(row.features.quality_score) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      hideOnMobile: true,
      render: (row) => {
        const deleted = row.post?.deleted_at != null;
        const ineligible =
          deleted || (row.post?.moderation_status ?? "unknown") !== "published";
        return ineligible ? (
          <Badge tone="danger">
            {deleted ? "deleted" : row.post?.moderation_status ?? "unknown"}
          </Badge>
        ) : (
          <Badge tone="neutral">published</Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={title}
        meta={description}
        actions={<DateRangeFilter value={range} />}
      />

      <Section title="Exposure">
        <div className="rounded-xl bg-surface-2 p-5">
          <MetricRow className="lg:grid-cols-4">
            <Metric
              label="Recommendation impressions"
              value={formatNumber(totals?.impressions)}
              tone="brand"
              loading={overview.isLoading}
            />
            <Metric label="Unique viewers" value={formatNumber(totals?.viewers)} loading={overview.isLoading} />
            <Metric
              label="Posts recommended"
              value={formatNumber(posts.data?.total)}
              loading={posts.isLoading}
            />
            <Metric
              label="Avg impressions / viewer"
              value={
                totals && totals.viewers > 0
                  ? (totals.impressions / totals.viewers).toFixed(1)
                  : "—"
              }
              loading={overview.isLoading}
            />
          </MetricRow>

          <div className="mt-6 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="surfaceGradient" x1="0" y1="0" x2="0" y2="1">
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
                  fill="url(#surfaceGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      <Section
        title={surface === "feed" ? "Top recommended posts" : "Top recommended shorts"}
        note="Exposure-side numbers from the engine; engagement from the analytics rollups"
      >
        <DataTable
          ariaLabel={`${surface} recommendation table`}
          columns={columns}
          rows={posts.data?.rows ?? []}
          loading={posts.isLoading}
          error={posts.error}
          onRetry={() => posts.refetch()}
          emptyTitle="No recommendations recorded in this window"
          emptyHint={`Exposure accumulates as users open their ${surface}. Ranking currently ${posts.data && posts.data.rows.length > 0 ? "producing slates" : "awaiting traffic"}.`}
        />
      </Section>
    </div>
  );
}
