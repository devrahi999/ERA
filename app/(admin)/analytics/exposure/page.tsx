"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Metric, MetricRow, PageHeader, Section } from "@/components/ui/primitives";
import { CHART_COLORS, chartAxisProps, DataTable, type Column } from "@/components/ui/data";
import { DateRangeFilter, rangeToWindow } from "@/components/ui/filters";
import {
  useExposureOverview,
  useTopCreators,
  useTopGames,
} from "@/lib/api/queries";
import type { TopCreatorRow, TopGameRow } from "@/types";
import { formatCompact, formatNumber, formatPercent } from "@/lib/formatters/format";

/* =============================================================================
   Exposure analytics — totals, concentration and per-day series. Reach is a
   distinct count everywhere (never a sum of daily counts).
   ============================================================================= */

export default function ExposurePage() {
  const searchParams = useSearchParams();
  const range = (searchParams.get("range") as "1d" | "7d" | "30d" | "90d") ?? "30d";
  const { from, to } = rangeToWindow(range);

  const overview = useExposureOverview(from, to);
  const creators = useTopCreators({ from, to, limit: 25 });
  const games = useTopGames({ from, to, limit: 10 });

  const totals = overview.data?.totals;
  const series = (overview.data?.series ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));
  const bySurface = (overview.data?.by_surface ?? []).map((s) => ({
    name: s.surface,
    impressions: s.impressions,
  }));

  const creatorColumns: Array<Column<TopCreatorRow>> = [
    {
      key: "creator",
      header: "Creator",
      render: (row) => (
        <div>
          <div className="text-[13px] font-medium text-ink">{row.creator.display_name}</div>
          <div className="text-xs text-ink-4">@{row.creator.username} · {row.creator.kind}</div>
        </div>
      ),
    },
    { key: "impressions", header: "Impressions", align: "right", render: (row) => <span className="tnum font-medium text-ink">{formatNumber(row.impressions)}</span> },
    { key: "reach", header: "Reach", align: "right", hideOnMobile: true, render: (row) => <span className="tnum text-ink-2">{formatNumber(row.reach)}</span> },
    { key: "posts", header: "Posts", align: "right", hideOnMobile: true, render: (row) => <span className="tnum text-ink-2">{formatNumber(row.posts)}</span> },
    {
      key: "share",
      header: "% of exposure",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <div className="h-1 w-16 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
            <div className="h-full rounded-full bg-brand/70" style={{ width: `${Math.min(100, row.share)}%` }} />
          </div>
          <span className="tnum text-ink-2">{formatPercent(row.share / 100)}</span>
        </div>
      ),
    },
  ];

  const gameColumns: Array<Column<TopGameRow>> = [
    { key: "game", header: "Game", render: (row) => <span className="text-[13px] text-ink">{row.name ?? row.game}</span> },
    { key: "impressions", header: "Impressions", align: "right", render: (row) => <span className="tnum text-ink-2">{formatCompact(row.impressions)}</span> },
    { key: "share", header: "Share", align: "right", render: (row) => <span className="tnum text-ink-2">{formatPercent(row.share / 100)}</span> },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Exposure"
        meta="What the recommendation engine is showing, to whom, and how concentrated it is"
        actions={<DateRangeFilter value={range} />}
      />

      <Section title="Totals">
        <div className="rounded-xl bg-surface-2 p-5">
          <MetricRow className="lg:grid-cols-4">
            <Metric label="Impressions" value={formatNumber(totals?.impressions)} tone="brand" loading={overview.isLoading} />
            <Metric label="Unique viewers" value={formatNumber(totals?.viewers)} loading={overview.isLoading} />
            <Metric label="Posts recommended" value={formatNumber(totals?.posts)} loading={overview.isLoading} />
            <Metric label="Creators exposed" value={formatNumber(totals?.creators)} loading={overview.isLoading} />
          </MetricRow>
        </div>
      </Section>

      <Section title="Impressions over time">
        <div className="rounded-xl bg-surface-2 p-5">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="expGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="label" {...chartAxisProps} />
                <YAxis {...chartAxisProps} width={44} />
                <Tooltip
                  formatter={(value) => [
                    formatNumber(typeof value === "number" ? value : Number(value) || 0),
                    "Impressions",
                  ]}
                />
                <Area type="monotone" dataKey="impressions" stroke={CHART_COLORS.primary} strokeWidth={1.5} fill="url(#expGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Section title="By surface">
          <div className="rounded-xl bg-surface-2 p-5">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bySurface} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="name" {...chartAxisProps} />
                  <YAxis {...chartAxisProps} width={44} />
                  <Tooltip
                    formatter={(value) => [
                      formatNumber(typeof value === "number" ? value : Number(value) || 0),
                      "Impressions",
                    ]}
                  />
                  <Bar dataKey="impressions" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Section>

        <Section title="By game">
          <DataTable
            ariaLabel="games by exposure"
            columns={gameColumns}
            rows={games.data?.rows ?? []}
            loading={games.isLoading}
            error={games.error}
            emptyTitle="No game-tagged exposure in this window"
          />
        </Section>
      </div>

      <Section
        title="Creator exposure"
        note="anti-concentration view — one creator holding a dominant share is a signal"
      >
        <DataTable
          ariaLabel="creator exposure"
          columns={creatorColumns}
          rows={creators.data?.rows ?? []}
          loading={creators.isLoading}
          error={creators.error}
          emptyTitle="No creator exposure recorded in this window"
          emptyHint="Exposure accumulates as ranked feeds are served."
        />
      </Section>
    </div>
  );
}
