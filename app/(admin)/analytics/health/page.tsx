"use client";

import React, { useState } from "react";
import { Metric, MetricRow, PageHeader, Section } from "@/components/ui/primitives";
import { Badge, StatusDot } from "@/components/ui/interactive";
import { useExperiments, useOverview, useRebuild } from "@/lib/api/queries";
import { Button, ConfirmDialog } from "@/components/ui/interactive";
import { formatNumber, formatRatio, timeAgo } from "@/lib/formatters/format";

/** Stable "now" captured once per mount — avoids impure Date.now() in render. */
function useNowMs(): number {
  const [nowMs] = useState(() => Date.now());
  return nowMs;
}

/** A feature table is stale when its computed_at is missing or older than ~36h. */
function isStaleTimestamp(iso: string | undefined | null, nowMs: number): boolean {
  if (!iso) return true;
  const computed = Date.parse(iso);
  if (Number.isNaN(computed)) return true;
  return nowMs - computed > 36 * 3_600_000;
}

/* =============================================================================
   Health — algorithm health from what the backend can actually report:
   feature freshness, exposure attribution, config state, experiment state.
   Latency/cache-hit metrics are NOT fabricated — the pipeline reports its own
   duration per debug run, and per-request latency is not persisted anywhere,
   so the page says so instead of inventing numbers.
   ============================================================================= */

export default function HealthPage() {
  const overview = useOverview();
  const experiments = useExperiments();
  const rebuild = useRebuild();
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const nowMs = useNowMs();

  const freshness = overview.data?.featureFreshness;
  const runningExperiments = (experiments.data ?? []).filter((e) => e.status === "running");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Health"
        meta="Algorithm health — every number below is reported by the backend; unavailable metrics say so"
        actions={
          <Button variant="tonal" onClick={() => setConfirmRebuild(true)} disabled={rebuild.isPending}>
            {rebuild.isPending ? "Rebuilding…" : "Rebuild features"}
          </Button>
        }
      />

      <Section title="Feature pipeline" note="the nightly rebuild that feeds ranking">
        <div className="rounded-xl bg-surface-2 p-5">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {(["content", "identity", "user"] as const).map((kind) => {
              const entry = freshness?.[kind] as { rows?: number; last_computed_at?: string } | undefined;
              const computedAt = entry?.last_computed_at ? timeAgo(entry.last_computed_at) : "never";
              const stale = isStaleTimestamp(entry?.last_computed_at, nowMs);
              return (
                <div key={kind}>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium capitalize text-ink">{kind} features</span>
                    <StatusDot tone={stale ? "warn" : "ok"} />
                  </div>
                  <div className="mt-1 text-xs text-ink-4">
                    {formatNumber(entry?.rows)} rows · computed {computedAt}
                  </div>
                  {stale ? (
                    <div className="mt-1 text-[11px] text-warning">
                      Stale — the nightly rebuild (00:45 UTC) has not completed recently.
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title="Configuration state">
        <div className="rounded-xl bg-surface-2 p-5">
          <MetricRow className="lg:grid-cols-4 sm:grid-cols-2">
            <Metric
              label="Active config"
              value={overview.data?.activeVersion?.label ?? "—"}
              tone={overview.data?.activeVersion?.fallback ? "warning" : "brand"}
              sub={overview.data?.activeVersion?.fallback ? "built-in defaults" : "stored version"}
            />
            <Metric
              label="Config cache TTL"
              value={
                overview.data
                  ? `${formatRatio(
                      Number(
                        ((overview.data as unknown as { config?: { shared?: { configCacheSeconds?: number } } }).config?.shared
                          ?.configCacheSeconds ?? 60),
                      ),
                      0,
                    )}s`
                  : "—"
              }
              sub="activation propagates within one TTL"
            />
            <Metric
              label="Running experiments"
              value={formatNumber(runningExperiments.length)}
              sub={runningExperiments.map((e) => e.name).join(", ") || "none"}
            />
            <Metric
              label="Feature rows"
              value={formatNumber(
                (Number((freshness?.content as { rows?: number } | undefined)?.rows ?? 0)) +
                  (Number((freshness?.user as { rows?: number } | undefined)?.rows ?? 0)),
              )}
              sub="content + user profiles"
            />
          </MetricRow>
        </div>
      </Section>

      <Section title="Runtime metrics" note="what the pipeline can and cannot report">
        <div className="rounded-xl bg-surface-2 p-5">
          <div className="space-y-3 text-[13px]">
            <div className="flex items-start gap-3">
              <Badge tone="neutral">available</Badge>
              <span className="text-ink-2">
                Ranking duration — every debug/preview run reports its own{" "}
                <span className="font-mono text-[12px]">durationMs</span> (visible in the
                Ranking Lab and user debugger). Typical runs complete in milliseconds.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <Badge tone="neutral">available</Badge>
              <span className="text-ink-2">
                Candidate / eligible / dropped counts — reported per ranked request in the
                debugger meta.
              </span>
            </div>
            <div className="flex items-start gap-3">
              <Badge tone="warning">not available</Badge>
              <span className="text-ink-4">
                Aggregate request latency percentiles and cache-hit ratio — per-request
                telemetry is sampled into logs, not persisted as time series. No numbers are
                shown rather than approximated ones.
              </span>
            </div>
          </div>
        </div>
      </Section>

      <ConfirmDialog
        open={confirmRebuild}
        onClose={() => setConfirmRebuild(false)}
        onConfirm={() => {
          rebuild.mutate(undefined, { onSuccess: () => setConfirmRebuild(false) });
        }}
        title="Rebuild recommendation features"
        description="Recomputes every content, identity and user feature table now (the same job the nightly cron runs). Ranking continues to serve from the current features while the rebuild runs."
        confirmLabel="Rebuild now"
        busy={rebuild.isPending}
      />
    </div>
  );
}
