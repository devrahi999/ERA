"use client";

import React, { useState } from "react";
import { PageHeader, Section } from "@/components/ui/primitives";
import { Badge, Button } from "@/components/ui/interactive";
import { DataTable, type Column } from "@/components/ui/data";
import { useAuditLog } from "@/lib/api/queries";
import type { AuditRow } from "@/types";
import { formatDate } from "@/lib/formatters/format";

/* =============================================================================
   Audit — every meaningful administrative action on the recommendation
   engine, with before/after state. IP/device data is not recorded by the
   backend and is therefore not shown.
   ============================================================================= */

const ACTION_TONES: Record<string, "brand" | "warning" | "danger" | "neutral"> = {
  create: "neutral",
  activate: "brand",
  deactivate: "warning",
  retire: "neutral",
  rollback: "warning",
  validate_reject: "danger",
  viewer_control_set: "warning",
  viewer_control_revoke: "neutral",
  experiment_create: "neutral",
  experiment_start: "brand",
  experiment_stop: "warning",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Draft created",
  activate: "Config activated",
  deactivate: "Config deactivated",
  retire: "Config retired",
  rollback: "Rollback",
  validate_reject: "Validation rejected",
  viewer_control_set: "Viewer control set",
  viewer_control_revoke: "Viewer control revoked",
  experiment_create: "Experiment created",
  experiment_start: "Experiment started",
  experiment_stop: "Experiment stopped",
};

export default function AuditPage() {
  const [page, setPage] = useState(0);
  const audit = useAuditLog(50, page * 50);
  const [expanded, setExpanded] = useState<string | null>(null);

  const columns: Array<Column<AuditRow>> = [
    {
      key: "time",
      header: "When",
      render: (row) => <span className="whitespace-nowrap text-xs text-ink-3">{formatDate(row.created_at)}</span>,
    },
    {
      key: "action",
      header: "Action",
      render: (row) => (
        <Badge tone={ACTION_TONES[row.action] ?? "neutral"}>
          {ACTION_LABELS[row.action] ?? row.action}
        </Badge>
      ),
    },
    {
      key: "note",
      header: "Note",
      hideOnMobile: true,
      render: (row) => (
        <span className="line-clamp-1 max-w-sm text-xs text-ink-3">{row.note ?? "—"}</span>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className="font-mono text-[11px] text-ink-4">
          {row.actor_user_id ? row.actor_user_id.slice(0, 8) : "system"}
        </span>
      ),
    },
    {
      key: "inspect",
      header: "",
      align: "right",
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(expanded === row.id ? null : row.id)}
          aria-expanded={expanded === row.id}
        >
          {expanded === row.id ? "Hide" : "State"}
        </Button>
      ),
    },
  ];

  const rows = audit.data ?? [];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit"
        meta="Every configuration, intervention, viewer-control and experiment action — with before/after state"
      />

      <Section title="Audit log">
        <DataTable
          ariaLabel="audit log"
          columns={columns}
          rows={rows}
          loading={audit.isLoading}
          error={audit.error}
          onRetry={() => audit.refetch()}
          emptyTitle="No audit entries yet"
          page={page}
          pageCount={rows.length === 50 ? page + 2 : page + 1}
          onPageChange={setPage}
        />
      </Section>

      {expanded ? (
        <Section title="Entry detail" note={`audited action state · ${expanded.slice(0, 8)}`}>
          <div className="grid grid-cols-1 gap-4 rounded-xl bg-surface-2 p-5 lg:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-medium text-ink-4">Before</div>
              <pre className="max-h-64 overflow-auto rounded-lg bg-surface-3 p-3 font-mono text-[11px] leading-4 text-ink-3">
                {(() => {
                  const row = rows.find((r) => r.id === expanded);
                  return JSON.stringify(row?.before_state ?? null, null, 2);
                })()}
              </pre>
            </div>
            <div>
              <div className="mb-2 text-xs font-medium text-ink-4">After</div>
              <pre className="max-h-64 overflow-auto rounded-lg bg-surface-3 p-3 font-mono text-[11px] leading-4 text-ink-3">
                {(() => {
                  const row = rows.find((r) => r.id === expanded);
                  return JSON.stringify(row?.after_state ?? null, null, 2);
                })()}
              </pre>
            </div>
          </div>
        </Section>
      ) : null}
    </div>
  );
}
