"use client";

import React, { useState } from "react";
import { PageHeader, Section } from "@/components/ui/primitives";
import { Badge, Button, ConfirmDialog, Tabs } from "@/components/ui/interactive";
import { DataTable, type Column } from "@/components/ui/data";
import { useCreateIntervention, useInterventions, useRevokeIntervention, useUsersOverview } from "@/lib/api/queries";
import type { InterventionRow } from "@/types";
import { formatDate, timeAgo } from "@/lib/formatters/format";

/* =============================================================================
   Interventions — bounded boost/suppression on content or creators. They
   reorder eligible content only: they can never surface deleted, private,
   blocked, restricted or under-review content, because eligibility is
   computed BEFORE the intervention multiplier applies.
   ============================================================================= */

export default function InterventionsPage() {
  const [tab, setTab] = useState("active");
  const includeExpired = tab === "history";
  const interventions = useInterventions(includeExpired);
  const revoke = useRevokeIntervention();
  const create = useCreateIntervention();

  const [revokeTarget, setRevokeTarget] = useState<InterventionRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const rows = interventions.data ?? [];
  const activeRows = rows.filter(
    (row) => !row.revoked_at && new Date(row.expires_at) > new Date(),
  );

  const columns: Array<Column<InterventionRow>> = [
    {
      key: "target",
      header: "Target",
      render: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={row.kind === "boost" ? "brand" : "warning"}>{row.kind}</Badge>
            <span className="tnum text-[13px] font-medium text-ink">{Number(row.multiplier).toFixed(2)}×</span>
          </div>
          <div className="mt-0.5 text-xs text-ink-4">
            {row.scope} {row.surface_id ? `· ${row.surface_id}` : "· all surfaces"}
          </div>
        </div>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      hideOnMobile: true,
      render: (row) => <span className="line-clamp-1 max-w-xs text-xs text-ink-3">{row.reason}</span>,
    },
    {
      key: "created",
      header: "Created",
      align: "right",
      hideOnMobile: true,
      render: (row) => <span className="text-xs text-ink-4">{formatDate(row.created_at)}</span>,
    },
    {
      key: "expires",
      header: "Expires",
      align: "right",
      render: (row) => {
        const expired = new Date(row.expires_at) <= new Date();
        const revoked = Boolean(row.revoked_at);
        return (
          <span className={`text-xs ${revoked ? "text-ink-4" : expired ? "text-danger" : "text-ink-3"}`}>
            {revoked ? "revoked" : expired ? `expired ${timeAgo(row.expires_at)}` : formatDate(row.expires_at)}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => {
        const isActive = !row.revoked_at && new Date(row.expires_at) > new Date();
        return isActive ? (
          <Button variant="danger" size="sm" onClick={() => setRevokeTarget(row)}>
            Revoke
          </Button>
        ) : null;
      },
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Interventions"
        meta="Bounded (0.25–3×), expiring, audited boosts and suppressions — they reorder eligible content, never bypass eligibility"
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            New intervention
          </Button>
        }
      />

      <Tabs
        tabs={[
          { id: "active", label: "Active", count: activeRows.length },
          { id: "history", label: "History" },
        ]}
        active={tab}
        onChange={setTab}
      />

      <Section title={tab === "active" ? "Active interventions" : "All interventions"}>
        <DataTable
          ariaLabel="interventions"
          columns={columns}
          rows={tab === "active" ? activeRows : rows}
          loading={interventions.isLoading}
          error={interventions.error}
          onRetry={() => interventions.refetch()}
          emptyTitle="No interventions"
          emptyHint={
            tab === "active"
              ? "No live overrides — ranking runs purely on the active config."
              : "No interventions have ever been created."
          }
        />
      </Section>

      <Section title="What interventions cannot do" note="the safety contract, stated">
        <div className="rounded-xl bg-surface-2 p-5 text-[13px] leading-6 text-ink-3">
          An intervention multiplies a candidate&apos;s score AFTER eligibility. It can reorder
          what policy allows; it can never change what policy allows. Deleted, private,
          blocked, restricted and under-review content stays excluded regardless of any
          multiplier. Suppression can only demote — never hide — and every row expires.
        </div>
      </Section>

      <CreateInterventionDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(dto) =>
          create.mutate(dto, { onSuccess: () => setCreateOpen(false) })
        }
        busy={create.isPending}
      />

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) {
            revoke.mutate(
              { id: revokeTarget.id },
              { onSuccess: () => setRevokeTarget(null) },
            );
          }
        }}
        title="Revoke intervention"
        description="The multiplier stops applying immediately. The row stays in history and the audit log."
        confirmLabel="Revoke"
        danger
        busy={revoke.isPending}
      />
    </div>
  );
}

function CreateInterventionDialog({
  open,
  onClose,
  onCreate,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (dto: {
    scope: "post" | "identity";
    scopeId: string;
    kind: "boost" | "suppress";
    multiplier: number;
    reason: string;
    expiresAt: string;
    surface?: "feed" | "shorts" | "search";
  }) => void;
  busy: boolean;
}) {
  const [scope, setScope] = useState<"post" | "identity">("identity");
  const [scopeId, setScopeId] = useState("");
  const [kind, setKind] = useState<"boost" | "suppress">("boost");
  const [multiplier, setMultiplier] = useState("1.5");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [surface, setSurface] = useState<"" | "feed" | "shorts" | "search">("");

  const users = useUsersOverview({ limit: 100 });
  const validMultiplier =
    kind === "boost"
      ? Number(multiplier) > 1 && Number(multiplier) <= 3
      : Number(multiplier) >= 0.25 && Number(multiplier) < 1;
  const canSubmit =
    scopeId.trim().length > 0 &&
    validMultiplier &&
    reason.trim().length >= 3 &&
    expiresAt &&
    new Date(expiresAt) > new Date();

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() =>
        onCreate({
          scope,
          scopeId: scopeId.trim(),
          kind,
          multiplier: Number(multiplier),
          reason: reason.trim(),
          expiresAt: new Date(expiresAt).toISOString(),
          surface: surface || undefined,
        })
      }
      title="New intervention"
      description="Boost or suppress a post or an identity (creator). Bounded: boost 1–3×, suppress 0.25–1×."
      confirmLabel="Create"
      busy={busy}
      confirmDisabled={!canSubmit}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-ink-3">
            Scope
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "post" | "identity")}
              className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
            >
              <option value="identity">Identity (creator)</option>
              <option value="post">Post</option>
            </select>
          </label>
          <label className="text-xs text-ink-3">
            Surface
            <select
              value={surface}
              onChange={(e) => setSurface(e.target.value as "" | "feed" | "shorts" | "search")}
              className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
            >
              <option value="">All surfaces</option>
              <option value="feed">Feed</option>
              <option value="shorts">Shorts</option>
              <option value="search">Search</option>
            </select>
          </label>
        </div>

        {scope === "identity" ? (
          <label className="block text-xs text-ink-3">
            Identity
            <select
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
            >
              <option value="">Select identity…</option>
              {(users.data?.rows ?? []).map((user) => (
                <option key={user.identity_id} value={user.identity_id}>
                  @{user.username}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block text-xs text-ink-3">
            Post ID (uuid)
            <input
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              placeholder="00000000-…"
              className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 font-mono text-sm text-ink outline-none placeholder:text-ink-4 focus-visible:outline-2 focus-visible:outline-brand"
            />
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex rounded-lg bg-surface-3 p-0.5" role="group" aria-label="Kind">
            {(["boost", "suppress"] as const).map((k) => (
              <button
                key={k}
                onClick={() => {
                  setKind(k);
                  setMultiplier(k === "boost" ? "1.5" : "0.5");
                }}
                aria-pressed={kind === k}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  kind === k ? "bg-brand text-brand-ink" : "text-ink-3 hover:text-ink"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <label className="text-xs text-ink-3">
            Multiplier {kind === "boost" ? "(1 – 3)" : "(0.25 – 1)"}
            <input
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
              inputMode="decimal"
              className={`tnum mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand ${validMultiplier ? "" : "text-danger"}`}
            />
          </label>
        </div>

        <label className="block text-xs text-ink-3">
          Reason (required, audited)
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Featured creator program"
            className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-4 focus-visible:outline-2 focus-visible:outline-brand"
          />
        </label>
        <label className="block text-xs text-ink-3">
          Expires at (required)
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
          />
        </label>
      </div>
    </ConfirmDialog>
  );
}
