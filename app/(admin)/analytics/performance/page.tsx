"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Metric, MetricRow, PageHeader, Section } from "@/components/ui/primitives";
import { DataTable, type Column } from "@/components/ui/data";
import { DateRangeFilter, rangeToWindow } from "@/components/ui/filters";
import { useTopPosts } from "@/lib/api/queries";
import type { TopPostRow } from "@/types";
import { formatCompact, formatNumber, formatPercent, timeAgo } from "@/lib/formatters/format";

/* =============================================================================
   Performance — how recommended content actually performs after being served.
   Engagement comes from the analytics rollups; exposure from the engine. Two
   funnels, both shown, never conflated. CTR is only computed where a click
   concept exists (opens on impressions) — no invented metrics.
   ============================================================================= */

export default function PerformancePage() {
  const searchParams = useSearchParams();
  const range = (searchParams.get("range") as "1d" | "7d" | "30d" | "90d") ?? "30d";
  const { from, to } = rangeToWindow(range);

  const posts = useTopPosts({ from, to, limit: 50 });

  const rows = posts.data?.rows ?? [];
  const totalExposure = rows.reduce((acc, row) => acc + row.impressions, 0);
  const totalEngagement = rows.reduce(
    (acc, row) =>
      acc +
      (row.engagement?.reactions ?? 0) +
      (row.engagement?.comments ?? 0) +
      (row.engagement?.shares ?? 0) +
      (row.engagement?.saves ?? 0),
    0,
  );
  const totalWatchMs = rows.reduce((acc, row) => acc + (row.engagement?.watch_time_ms ?? 0), 0);

  const columns: Array<Column<TopPostRow>> = [
    {
      key: "post",
      header: "Post",
      render: (row) => (
        <Link href={`/content/${row.post_id}`} className="group block min-w-0">
          <div className="truncate text-[13px] font-medium text-ink group-hover:text-brand">
            {row.post.caption || "Untitled"}
          </div>
          <div className="text-xs text-ink-4">@{row.author.username}</div>
        </Link>
      ),
    },
    { key: "exposure", header: "Exposure", align: "right", render: (row) => <span className="tnum font-medium text-ink">{formatCompact(row.impressions)}</span> },
    { key: "reach", header: "Reach", align: "right", hideOnMobile: true, render: (row) => <span className="tnum text-ink-2">{formatNumber(row.reach)}</span> },
    {
      key: "engagement",
      header: "Engagement",
      align: "right",
      render: (row) => {
        const engaged =
          (row.engagement?.reactions ?? 0) +
          (row.engagement?.comments ?? 0) +
          (row.engagement?.shares ?? 0) +
          (row.engagement?.saves ?? 0);
        return <span className="tnum text-ink-2">{formatCompact(engaged)}</span>;
      },
    },
    {
      key: "rate",
      header: "Eng. / exposure",
      align: "right",
      render: (row) => {
        const engaged =
          (row.engagement?.reactions ?? 0) +
          (row.engagement?.comments ?? 0) +
          (row.engagement?.shares ?? 0) +
          (row.engagement?.saves ?? 0);
        return (
          <span className="tnum text-ink-2">
            {row.impressions > 0 ? formatPercent(engaged / row.impressions) : "—"}
          </span>
        );
      },
    },
    {
      key: "watch",
      header: "Watch time",
      align: "right",
      hideOnMobile: true,
      render: (row) => {
        const ms = row.engagement?.watch_time_ms ?? 0;
        if (!ms) return <span className="text-ink-4">—</span>;
        return (
          <span className="tnum text-ink-2">
            {ms >= 3_600_000
              ? `${(ms / 3_600_000).toFixed(1)}h`
              : `${(ms / 60_000).toFixed(1)}m`}
          </span>
        );
      },
    },
    {
      key: "last",
      header: "Last shown",
      align: "right",
      hideOnMobile: true,
      render: (row) => <span className="text-xs text-ink-4">{timeAgo(row.last_shown_at)}</span>,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Performance"
        meta="How recommended content performs after being served — engagement measured from the analytics rollups"
        actions={<DateRangeFilter value={range} />}
      />

      <Section title="Recommended content performance" note="top 50 by exposure">
        <div className="rounded-xl bg-surface-2 p-5">
          <MetricRow className="lg:grid-cols-4">
            <Metric label="Exposure (top 50)" value={formatNumber(totalExposure)} tone="brand" loading={posts.isLoading} />
            <Metric label="Engagement events" value={formatNumber(totalEngagement)} loading={posts.isLoading} />
            <Metric
              label="Engagement rate"
              value={totalExposure > 0 ? formatPercent(totalEngagement / totalExposure) : "—"}
              loading={posts.isLoading}
            />
            <Metric
              label="Watch time"
              value={
                totalWatchMs >= 3_600_000
                  ? `${(totalWatchMs / 3_600_000).toFixed(1)}h`
                  : totalWatchMs > 0
                    ? `${(totalWatchMs / 60_000).toFixed(1)}m`
                    : "—"
              }
              loading={posts.isLoading}
            />
          </MetricRow>
          <p className="mt-4 text-[11px] leading-4 text-ink-4">
            Two funnels side by side: exposure = what the engine served; engagement = what users
            did with content in the same window (from the analytics rollups, a separate
            measurement path). A rate over exposure is therefore indicative, not a pure
            post-recommendation CTR. Follow and recruitment actions are measured in the
            identity-level analytics, not attributed per recommendation.
          </p>
        </div>
      </Section>

      <Section title="Content">
        <DataTable
          ariaLabel="content performance"
          columns={columns}
          rows={rows}
          loading={posts.isLoading}
          error={posts.error}
          onRetry={() => posts.refetch()}
          emptyTitle="No recommended content in this window"
        />
      </Section>
    </div>
  );
}
