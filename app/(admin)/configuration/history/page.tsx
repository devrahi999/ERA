"use client";

import React from "react";
import Link from "next/link";
import { PageHeader, Section } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/interactive";
import { DataTable, type Column } from "@/components/ui/data";
import { useConfigHistory } from "@/lib/api/queries";
import type { ConfigVersion } from "@/types";
import { formatDate, timeAgo } from "@/lib/formatters/format";

/* =============================================================================
   Configuration history — immutable version log. Rollback is activation of an
   old row (from the version page), never a destructive edit.
   ============================================================================= */

export default function ConfigurationHistoryPage() {
  const history = useConfigHistory(100);

  const columns: Array<Column<ConfigVersion>> = [
    {
      key: "label",
      header: "Version",
      render: (row) => (
        <Link href={`/configuration/${row.id}`} className="group flex items-center gap-2">
          <span className="text-[13px] font-medium text-ink group-hover:text-brand">
            {row.version_label}
          </span>
          <Badge tone={row.status === "active" ? "brand" : row.status === "draft" ? "warning" : "neutral"}>
            {row.status}
          </Badge>
        </Link>
      ),
    },
    {
      key: "notes",
      header: "Notes",
      hideOnMobile: true,
      render: (row) => (
        <span className="line-clamp-1 max-w-xs text-xs text-ink-4">{row.notes ?? "—"}</span>
      ),
    },
    {
      key: "created",
      header: "Created",
      align: "right",
      render: (row) => <span className="text-xs text-ink-3">{formatDate(row.created_at)}</span>,
    },
    {
      key: "activated",
      header: "Activated",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-ink-4">
          {row.activated_at ? timeAgo(row.activated_at) : "never"}
        </span>
      ),
    },
    {
      key: "hash",
      header: "Hash",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className="font-mono text-[11px] text-ink-4">
          {row.config_hash ? row.config_hash.slice(0, 10) : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Configuration history"
        meta="Every version is immutable — rollback activates an old row, it never rewrites history"
      />
      <Section title="Versions">
        <DataTable
          ariaLabel="configuration history"
          columns={columns}
          rows={history.data ?? []}
          loading={history.isLoading}
          error={history.error}
          onRetry={() => history.refetch()}
          emptyTitle="No versions yet"
          emptyHint="Create a draft to start the version history."
        />
      </Section>
    </div>
  );
}
