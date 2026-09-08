"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader, Section } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/interactive";
import { DataTable, type Column } from "@/components/ui/data";
import { FilterBar, FilterSearch } from "@/components/ui/filters";
import { useUsersOverview } from "@/lib/api/queries";
import type { UserOverviewRow } from "@/types";
import { formatNumber, timeAgo } from "@/lib/formatters/format";

/* =============================================================================
   Identities — players, coaches, analysts, managers, creators and teams the
   recommendation engine tracks. Search resolves to the identity stats page.
   ============================================================================= */

export default function IdentitiesPage() {
  const searchParams = useSearchParams();
  const search = searchParams.get("q") ?? "";

  const users = useUsersOverview({ search, limit: 50, offset: 0 });

  const columns: Array<Column<UserOverviewRow>> = [
    {
      key: "identity",
      header: "Identity",
      render: (row) => (
        <Link href={`/identities/${row.identity_id}`} className="group block min-w-0">
          <div className="truncate text-[13px] font-medium text-ink group-hover:text-brand">
            {row.display_name}
          </div>
          <div className="mt-0.5 text-xs text-ink-4">@{row.username}</div>
        </Link>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      render: (row) => <Badge tone={row.kind === "team" ? "info" : "neutral"}>{row.kind}</Badge>,
    },
    {
      key: "activity",
      header: "Interactions",
      align: "right",
      render: (row) => <span className="tnum text-ink-2">{formatNumber(row.interaction_count)}</span>,
    },
    {
      key: "games",
      header: "Primary games",
      hideOnMobile: true,
      render: (row) =>
        row.declared_game_ids.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {row.declared_game_ids.slice(0, 3).map((game) => (
              <Badge key={game} tone="neutral">{game}</Badge>
            ))}
          </div>
        ) : (
          <span className="text-xs text-ink-4">—</span>
        ),
    },
    {
      key: "seen",
      header: "Last active",
      align: "right",
      hideOnMobile: true,
      render: (row) => <span className="text-xs text-ink-4">{timeAgo(row.last_active_at)}</span>,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Identities"
        meta="Players, coaches, analysts, managers, creators and teams — exposure, affinity and audience per identity"
      />

      <FilterBar>
        <FilterSearch value={search} placeholder="Search identity by username…" />
      </FilterBar>

      <Section title="Tracked identities">
        <DataTable
          ariaLabel="identities"
          columns={columns}
          rows={users.data?.rows ?? []}
          loading={users.isLoading}
          error={users.error}
          onRetry={() => users.refetch()}
          emptyTitle="No identities match"
          emptyHint="Identities appear once the engine computes their feature profile."
        />
      </Section>
    </div>
  );
}
