"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader, Section } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/interactive";
import { DataTable, type Column } from "@/components/ui/data";
import { FilterBar, FilterSearch, FilterSelect } from "@/components/ui/filters";
import { useUsersOverview } from "@/lib/api/queries";
import type { UserOverviewRow } from "@/types";
import { formatNumber, formatRatio, timeAgo } from "@/lib/formatters/format";

/* =============================================================================
   Users — the recommendation user explorer. Only identities the engine has a
   recommendation profile for (feature rows), not the whole user base.
   ============================================================================= */

export default function UsersPage() {
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const coldStart = searchParams.get("coldStart") ?? "all";

  const users = useUsersOverview({ search, coldStart, limit: 25, offset: 0 });

  const columns: Array<Column<UserOverviewRow>> = [
    {
      key: "user",
      header: "User",
      render: (row) => (
        <Link href={`/users/${row.identity_id}`} className="group block min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium text-ink group-hover:text-brand">
              {row.display_name}
            </span>
            {row.is_cold_start ? <Badge tone="info">cold start</Badge> : null}
            {row.has_active_controls ? <Badge tone="brand">controls</Badge> : null}
          </div>
          <div className="mt-0.5 text-xs text-ink-4">
            @{row.username} · {row.kind}
          </div>
        </Link>
      ),
    },
    {
      key: "interactions",
      header: "Interactions",
      align: "right",
      render: (row) => (
        <span className="tnum font-medium text-ink">{formatNumber(row.interaction_count)}</span>
      ),
    },
    {
      key: "games",
      header: "Declared games",
      hideOnMobile: true,
      render: (row) =>
        row.declared_game_ids.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.declared_game_ids.slice(0, 3).map((game) => (
              <Badge key={game} tone="neutral">
                {game}
              </Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-ink-4">—</span>
        ),
    },
    {
      key: "following",
      header: "Following",
      align: "right",
      hideOnMobile: true,
      render: (row) => <span className="tnum text-ink-2">{formatNumber(row.following_count)}</span>,
    },
    {
      key: "confidence",
      header: "Confidence",
      align: "right",
      hideOnMobile: true,
      render: (row) => <span className="tnum text-ink-2">{formatRatio(row.confidence)}</span>,
    },
    {
      key: "active",
      header: "Last active",
      align: "right",
      hideOnMobile: true,
      render: (row) => <span className="text-xs text-ink-4">{timeAgo(row.last_active_at)}</span>,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Users"
        meta="Recommendation profiles — open a user for the feed debugger, controls and preview"
      />

      <FilterBar>
        <FilterSearch value={search} placeholder="Search username or identity id…" />
        <FilterSelect
          name="coldStart"
          label="Cold start"
          value={coldStart}
          options={[
            { value: "all", label: "All" },
            { value: "true", label: "Cold start" },
            { value: "false", label: "Warm" },
          ]}
        />
      </FilterBar>

      <Section
        title="Recommendation profiles"
        note={users.data ? `${formatNumber(users.data.total)} profiles` : undefined}
      >
        <DataTable
          ariaLabel="users"
          columns={columns}
          rows={users.data?.rows ?? []}
          loading={users.isLoading}
          error={users.error}
          onRetry={() => users.refetch()}
          emptyTitle="No recommendation profiles match"
          emptyHint="Profiles appear after the nightly feature rebuild observes activity."
        />
      </Section>
    </div>
  );
}
