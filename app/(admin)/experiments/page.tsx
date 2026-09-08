"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/ui/primitives";
import { Badge, Button, ConfirmDialog, LoadingState, ErrorState } from "@/components/ui/interactive";
import { useConfigHistory, useCreateExperiment, useExperiments, useStartExperiment, useStopExperiment } from "@/lib/api/queries";
import { formatDate, formatNumber } from "@/lib/formatters/format";
import type { ExperimentRow } from "@/types";

/* =============================================================================
   Experiments — backend-controlled A/B on config versions. Allocation is
   deterministic (hash of experiment+viewer); the frontend only reads state
   and issues lifecycle calls. Reach/engagement per arm come from exposure
   attribution; metrics the pipeline does not record are absent, not invented.
   ============================================================================= */

export default function ExperimentsPage() {
  const experiments = useExperiments();
  const [createOpen, setCreateOpen] = useState(false);
  const [startTarget, setStartTarget] = useState<ExperimentRow | null>(null);
  const [stopTarget, setStopTarget] = useState<ExperimentRow | null>(null);

  const start = useStartExperiment();
  const stop = useStopExperiment();

  if (experiments.isLoading) return <LoadingState rows={6} label="Loading experiments" />;
  if (experiments.error) return <ErrorState title="Could not load experiments" />;

  const rows = experiments.data ?? [];
  const running = rows.filter((e) => e.status === "running");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Experiments"
        meta="A/B config versions with deterministic viewer allocation — one variable at a time, per surface"
        actions={
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            New experiment
          </Button>
        }
      />

      {running.length > 0 ? (
        <div className="rounded-xl bg-brand/10 px-4 py-3 text-[13px] text-brand">
          {running.map((experiment) => (
            <span key={experiment.id}>
              <span className="font-medium">{experiment.name}</span> is live on{" "}
              {experiment.surface} — {experiment.variant_percent}% of viewers see the variant
              ({experiment.variant_version?.label ?? "?"}).
            </span>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-xl bg-surface-2 px-4 py-12 text-center text-sm text-ink-4">
          No experiments yet. An experiment compares the active config (control) against one
          draft config (variant) on a single surface, with a bounded share of viewers.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((experiment) => (
            <ExperimentCard
              key={experiment.id}
              experiment={experiment}
              onStart={() => setStartTarget(experiment)}
              onStop={() => setStopTarget(experiment)}
            />
          ))}
        </div>
      )}

      <CreateExperimentDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        blockedSurface={running[0]?.surface}
      />

      <ConfirmDialog
        open={startTarget !== null}
        onClose={() => setStartTarget(null)}
        onConfirm={() => {
          if (startTarget) {
            start.mutate(startTarget.id, { onSuccess: () => setStartTarget(null) });
          }
        }}
        title="Start experiment"
        description={`"${startTarget?.name}" will allocate ${startTarget?.variant_percent}% of ${startTarget?.surface} viewers to the variant config, deterministically and without frontend involvement. One experiment per surface is enforced.`}
        confirmLabel="Start"
        busy={start.isPending}
      />

      <ConfirmDialog
        open={stopTarget !== null}
        onClose={() => setStopTarget(null)}
        onConfirm={() => {
          if (stopTarget) {
            stop.mutate(
              { experimentId: stopTarget.id, reason: "Stopped from control center" },
              { onSuccess: () => setStopTarget(null) },
            );
          }
        }}
        title="Stop experiment"
        description="All viewers return to the active config immediately. Per-arm exposure metrics remain readable on this page."
        confirmLabel="Stop"
        danger
        busy={stop.isPending}
      />
    </div>
  );
}

function ExperimentCard({
  experiment,
  onStart,
  onStop,
}: {
  experiment: ExperimentRow;
  onStart: () => void;
  onStop: () => void;
}) {
  const status = experiment.status;
  const control = experiment.metrics.control;
  const variant = experiment.metrics.variant;
  const totalImpressions = control.impressions + variant.impressions;

  return (
    <div className="rounded-xl bg-surface-2 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[15px] font-semibold text-ink">{experiment.name}</span>
        <Badge tone={status === "running" ? "brand" : status === "draft" ? "warning" : "neutral"}>
          {status}
        </Badge>
        <Badge tone="neutral">{experiment.surface}</Badge>
        <span className="ml-auto flex gap-2">
          {status === "draft" ? (
            <Button variant="primary" size="sm" onClick={onStart}>
              Start
            </Button>
          ) : null}
          {status === "running" ? (
            <Button variant="danger" size="sm" onClick={onStop}>
              Stop
            </Button>
          ) : null}
        </span>
      </div>
      {experiment.description ? (
        <p className="mt-1 text-[13px] text-ink-3">{experiment.description}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-4">
        <span>
          control <span className="font-mono text-ink-3">{experiment.control_version?.label ?? "active"}</span>
        </span>
        <span>
          variant <span className="font-mono text-ink-3">{experiment.variant_version?.label ?? "?"}</span>
        </span>
        <span>
          variant share <span className="tnum text-ink-3">{experiment.variant_percent}%</span>
        </span>
        {experiment.started_at ? (
          <span>started {formatDate(experiment.started_at)}</span>
        ) : null}
        {experiment.stopped_at ? <span>stopped {formatDate(experiment.stopped_at)}</span> : null}
      </div>

      {/* Per-arm exposure metrics */}
      <div className="mt-4 grid grid-cols-2 gap-6">
        {(
          [
            { label: "Control", data: control, tone: "default" as const },
            { label: "Variant", data: variant, tone: "brand" as const },
          ] as const
        ).map((arm) => (
          <div key={arm.label}>
            <div className="mb-1 text-xs font-medium text-ink-4">{arm.label}</div>
            <div className="flex gap-x-5 text-[13px]">
              <span className="tnum text-ink">
                {formatNumber(arm.data.impressions)}{" "}
                <span className="text-[11px] text-ink-4">impr.</span>
              </span>
              <span className="tnum text-ink-2">
                {formatNumber(arm.data.viewers)}{" "}
                <span className="text-[11px] text-ink-4">viewers</span>
              </span>
              <span className="tnum text-ink-2">
                {formatNumber(arm.data.posts)} <span className="text-[11px] text-ink-4">posts</span>
              </span>
            </div>
          </div>
        ))}
      </div>
      {totalImpressions > 0 ? (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${(variant.impressions / totalImpressions) * 100}%` }}
          />
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-ink-4">
          No attributed exposure yet — per-arm numbers appear as ranked feeds are served under
          each config. Engagement and retention are measured in the analytics dashboards, not
          attributed per arm here.
        </p>
      )}
      {experiment.stop_reason ? (
        <p className="mt-2 text-[11px] text-ink-4">Stopped: {experiment.stop_reason}</p>
      ) : null}
    </div>
  );
}

function CreateExperimentDialog({
  open,
  onClose,
  blockedSurface,
}: {
  open: boolean;
  onClose: () => void;
  blockedSurface?: string;
}) {
  const history = useConfigHistory(50);
  const create = useCreateExperiment();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [surface, setSurface] = useState<"feed" | "shorts" | "search">("feed");
  const [variantVersionId, setVariantVersionId] = useState("");
  const [variantPercent, setVariantPercent] = useState("10");

  const drafts = (history.data ?? []).filter(
    (version) => version.status === "draft" || version.status === "retired",
  );
  const surfaceBlocked = blockedSurface === surface;
  const canSubmit =
    name.trim().length >= 3 &&
    variantVersionId.length > 0 &&
    Number(variantPercent) >= 1 &&
    Number(variantPercent) <= 50 &&
    !surfaceBlocked;

  return (
    <ConfirmDialog
      open={open}
      onClose={onClose}
      onConfirm={() =>
        create.mutate(
          {
            name: name.trim(),
            description: description.trim() || undefined,
            surface,
            variantVersionId,
            variantPercent: Number(variantPercent),
          },
          { onSuccess: () => onClose() },
        )
      }
      title="New experiment"
      description="Compares the currently active config (control) against a selected version (variant) on one surface. The variant cannot be the active version."
      confirmLabel="Create draft experiment"
      busy={create.isPending}
      confirmDisabled={!canSubmit}
    >
      <div className="space-y-3">
        {blockedSurface ? (
          <p className="text-xs text-warning">
            An experiment is already running on {blockedSurface} — one experiment per surface
            is enforced.
          </p>
        ) : null}
        <label className="block text-xs text-ink-3">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. feed-exploration-10"
            className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-4 focus-visible:outline-2 focus-visible:outline-brand"
          />
        </label>
        <label className="block text-xs text-ink-3">
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="what this tests"
            className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-4 focus-visible:outline-2 focus-visible:outline-brand"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-ink-3">
            Surface
            <select
              value={surface}
              onChange={(e) => setSurface(e.target.value as "feed" | "shorts" | "search")}
              className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm capitalize text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
            >
              <option value="feed">Feed</option>
              <option value="shorts">Shorts</option>
              <option value="search">Search</option>
            </select>
          </label>
          <label className="text-xs text-ink-3">
            Variant share (1 – 50%)
            <input
              value={variantPercent}
              onChange={(e) => setVariantPercent(e.target.value)}
              inputMode="numeric"
              className="tnum mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
            />
          </label>
        </div>
        <label className="block text-xs text-ink-3">
          Variant config version
          <select
            value={variantVersionId}
            onChange={(e) => setVariantVersionId(e.target.value)}
            className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
          >
            <option value="">Select version…</option>
            {drafts.map((version) => (
              <option key={version.id} value={version.id}>
                {version.version_label} ({version.status})
              </option>
            ))}
          </select>
        </label>
        <p className="text-[11px] leading-4 text-ink-4">
          Allocation is deterministic — hash(experiment, viewer) — computed in the backend for
          every ranked request. No frontend randomization, no allocation table to drift.
        </p>
      </div>
    </ConfirmDialog>
  );
}
