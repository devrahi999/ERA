"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader, Section } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/interactive";
import { DataTable, type Column } from "@/components/ui/data";
import { FilterBar, FilterSearch, FilterSelect } from "@/components/ui/filters";
import { useContentStats } from "@/lib/api/queries";
import type { ContentStatsRow } from "@/types";
import { identityHandle } from "@/types";
import { formatCompact, formatNumber, formatRatio, timeAgo } from "@/lib/formatters/format";

/* =============================================================================
   Content — the recommendation content explorer. Every row is real feature
   data; eligibility comes from the engine's own verdict, recomputed per row.
   ============================================================================= */

export default function ContentPage() {
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const kind = searchParams.get("kind") ?? "all";
  const status = searchParams.get("status") ?? "all";
  const sort = searchParams.get("sort") ?? "exposure";

  const stats = useContentStats({ search, kind, status, sort, limit: 25, offset: 0 });

  const columns: Array<Column<ContentStatsRow>> = [
    {
      key: "post",
      header: "Content",
      render: (row) => (
        <Link href={`/content/${row.post_id}`} className="group block min-w-0">
          <div className="truncate text-[13px] font-medium text-ink group-hover:text-brand">
            {row.post?.caption || "Untitled"}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-4">
            <span>{identityHandle(row.author)}</span>
            {row.is_short ? (
              <>
                <span aria-hidden="true">·</span>
                <Badge tone="neutral">short</Badge>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            <span>{timeAgo(row.post?.created_at ?? null)}</span>
          </div>
        </Link>
      ),
    },
    {
      key: "game",
      header: "Game",
      hideOnMobile: true,
      render: (row) => <span className="text-xs text-ink-3">{row.game ?? "—"}</span>,
    },
    {
      key: "eligible",
      header: "Ranking",
      render: (row) =>
        row.eligible ? (
          <Badge tone="brand">eligible</Badge>
        ) : (
          <Badge tone="danger">
            {row.post?.deleted_at != null
              ? "deleted"
              : row.post?.moderation_status ?? "unknown"}
          </Badge>
        ),
    },
    {
      key: "exposure",
      header: "Exposure",
      align: "right",
      render: (row) => (
        <div>
          <div className="tnum font-medium text-ink">{formatCompact(row.exposure_impressions)}</div>
          <div className="tnum text-[11px] text-ink-4">
            {row.exposure_viewers > 0 ? `${formatNumber(row.exposure_viewers)} viewers` : "never shown"}
          </div>
        </div>
      ),
    },
    {
      key: "quality",
      header: "Quality",
      align: "right",
      hideOnMobile: true,
      render: (row) => <span className="tnum text-ink-2">{formatRatio(row.quality_score)}</span>,
    },
    {
      key: "engagement",
      header: "Eng. rate",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className="tnum text-ink-2">{formatRatio(row.engagement_rate)}</span>
      ),
    },
    {
      key: "confidence",
      header: "Conf.",
      align: "right",
      hideOnMobile: true,
      render: (row) => <span className="tnum text-ink-4">{formatRatio(row.confidence)}</span>,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Content"
        meta="Every item the ranking engine has feature data for — open any row for the full recommendation inspector"
      />

      <FilterBar>
        <FilterSearch value={search} placeholder="Search post id, caption or creator…" />
        <FilterSelect
          name="kind"
          label="Type"
          value={kind}
          options={[
            { value: "all", label: "All" },
            { value: "post", label: "Posts" },
            { value: "short", label: "Shorts" },
          ]}
        />
        <FilterSelect
          name="status"
          label="Eligibility"
          value={status}
          options={[
            { value: "all", label: "All" },
            { value: "eligible", label: "Eligible" },
            { value: "ineligible", label: "Excluded" },
          ]}
        />
        <FilterSelect
          name="sort"
          label="Sort"
          value={sort}
          options={[
            { value: "exposure", label: "Exposure" },
            { value: "quality", label: "Quality" },
            { value: "impressions", label: "Platform impressions" },
            { value: "newest", label: "Newest" },
          ]}
        />
      </FilterBar>

      <Section
        title="Ranked content"
        note={stats.data ? `${formatNumber(stats.data.total)} items with feature data` : undefined}
      >
        <DataTable
          ariaLabel="content explorer"
          columns={columns}
          rows={stats.data?.rows ?? []}
          loading={stats.isLoading}
          error={stats.error}
          onRetry={() => stats.refetch()}
          emptyTitle="No content matches these filters"
          emptyHint="Feature rows appear after the nightly rebuild reaches the post."
        />
      </Section>
    </div>
  );
}
