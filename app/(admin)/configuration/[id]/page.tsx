"use client";

import React, { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, Section } from "@/components/ui/primitives";
import { Badge, Button, ConfirmDialog, LoadingState, ErrorState } from "@/components/ui/interactive";
import {
  useActivateConfig,
  useConfigVersion,
  useOverview,
} from "@/lib/api/queries";
import { compareConfigs } from "@/lib/utils/diff";
import { formatDate, timeAgo } from "@/lib/formatters/format";

/* =============================================================================
   Version detail — the draft → validate → compare → activate / rollback
   surface for one stored version. Activation shows a qualitative
   behavioral-direction summary derived from the actual diff, and states it IS
   qualitative (no measured outcomes are claimed before measurement).
   ============================================================================= */

export default function VersionDetailPage() {
  const params = useParams<{ id: string }>();
  const versionId = params.id;
  const router = useRouter();
  const overview = useOverview();
  const version = useConfigVersion(versionId);

  const activeVersionId = overview.data?.activeVersion?.id;
  const activeIsReal = activeVersionId && !overview.data?.activeVersion?.fallback;
  const live = useConfigVersion(activeIsReal ? activeVersionId : null);

  const [confirmActivate, setConfirmActivate] = useState(false);
  const [activateNote, setActivateNote] = useState("");
  const activate = useActivateConfig();

  const data = version.data;
  const diffs = useMemo(
    () =>
      compareConfigs(
        (live.data?.config ?? {}) as Record<string, unknown>,
        (data?.config ?? {}) as Record<string, unknown>,
      ),
    [live.data, data],
  );

  const isDraft = data?.status === "draft";
  const isRetired = data?.status === "retired";
  const isLive = data?.status === "active";

  if (version.isLoading) return <LoadingState rows={6} label="Loading version" />;
  if (version.error || !data) return <ErrorState title="Could not load configuration version" />;

  const behavioralDirection = describeDirection(diffs);

  return (
    <div className="space-y-8">
      <PageHeader
        title={data.version_label}
        meta={
          <>
            <Badge tone={isLive ? "brand" : isDraft ? "warning" : "neutral"}>{data.status}</Badge>
            <span>created {formatDate(data.created_at)}</span>
            {data.activated_at ? <span>· activated {timeAgo(data.activated_at)}</span> : null}
            {data.config_hash ? (
              <span className="font-mono text-[11px] text-ink-4">#{data.config_hash.slice(0, 10)}</span>
            ) : null}
          </>
        }
        actions={
          <>
            <Link href="/configuration">
              <Button variant="ghost">Back</Button>
            </Link>
            {isDraft || isRetired ? (
              <Button variant="primary" onClick={() => setConfirmActivate(true)}>
                {isRetired ? "Rollback to this version" : "Activate"}
              </Button>
            ) : null}
          </>
        }
      />

      {data.notes ? (
        <div className="rounded-xl bg-surface-2 px-4 py-3 text-[13px] text-ink-3">{data.notes}</div>
      ) : null}

      <Section
        title={isLive ? "Config (live)" : "Diff vs live"}
        note={isLive ? "this IS the live configuration" : `${diffs.length} field${diffs.length === 1 ? "" : "s"} differ`}
      >
        {diffs.length === 0 && !isLive ? (
          <div className="rounded-xl bg-surface-2 px-4 py-10 text-center text-sm text-ink-4">
            {isDraft
              ? "This draft is identical to the live configuration."
              : "No differences against the live configuration."}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-surface-2">
            {isLive
              ? null
              : diffs.map((diff) => (
                  <div
                    key={diff.path}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line/50 px-4 py-2.5 last:border-0"
                  >
                    <span className="font-mono text-[12.5px] text-ink-2">{diff.path}</span>
                    <span className="tnum flex items-center gap-2 text-[13px]">
                      <span className="text-ink-4">
                        {typeof diff.oldVal === "number" ? diff.oldVal.toLocaleString() : String(diff.oldVal)}
                      </span>
                      <span className="text-ink-4">→</span>
                      <span
                        className={
                          diff.type === "removed"
                            ? "text-danger"
                            : diff.type === "added"
                              ? "text-brand"
                              : "font-medium text-brand"
                        }
                      >
                        {typeof diff.newVal === "number" ? diff.newVal.toLocaleString() : String(diff.newVal)}
                      </span>
                    </span>
                  </div>
                ))}
          </div>
        )}
      </Section>

      {diffs.length > 0 ? (
        <Section title="Expected behavioral direction" note="qualitative — derived from the config changes, not measured outcomes">
          <div className="rounded-xl bg-surface-2 p-5">
            {behavioralDirection.length > 0 ? (
              <ul className="space-y-1.5 text-[13px] text-ink-2">
                {behavioralDirection.map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                    {line}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-ink-4">
                No recognizable behavioral direction — the changed fields are operational
                (limits, thresholds) rather than ranking-shaping.
              </div>
            )}
            <p className="mt-3 text-[11px] leading-4 text-ink-4">
              These are qualitative expectations generated from the known config changes. No
              measured outcome is claimed until the analytics actually measure one.
            </p>
          </div>
        </Section>
      ) : null}

      <Section title="Raw JSON" note="advanced view">
        <details className="rounded-xl bg-surface-2">
          <summary className="cursor-pointer px-4 py-3 text-[13px] font-medium text-ink-2">
            Expand raw config document
          </summary>
          <pre className="max-h-[480px] overflow-auto px-4 pb-4 font-mono text-[11.5px] leading-5 text-ink-3">
            {JSON.stringify(data.config, null, 2)}
          </pre>
        </details>
      </Section>

      <ConfirmDialog
        open={confirmActivate}
        onClose={() => setConfirmActivate(false)}
        onConfirm={() => {
          activate.mutate(
            {
              versionId,
              note: activateNote.trim() || undefined,
              rollback: isRetired,
            },
            {
              onSuccess: () => {
                setConfirmActivate(false);
                router.push("/configuration");
              },
            },
          );
        }}
        title={isRetired ? "Rollback configuration" : "Activate configuration"}
        description={
          isRetired
            ? `Rolling back re-activates "${data.version_label}". The currently active version is retired — not deleted — so this is reversible.`
            : `Activating "${data.version_label}" makes it the live configuration for every ranked surface, effective within the config cache TTL (60s default).`
        }
        confirmLabel={isRetired ? "Rollback" : "Activate"}
        danger={false}
        busy={activate.isPending}
      >
        <div className="space-y-3">
          <div className="rounded-lg bg-surface-3 p-3 text-[13px]">
            <div className="text-ink-3">
              Current: <span className="font-medium text-ink">{live.data?.version_label ?? "built-in defaults"}</span>
            </div>
            <div className="mt-1 text-ink-3">
              Target: <span className="font-medium text-brand">{data.version_label}</span>
            </div>
            <div className="mt-1 text-ink-4">
              {diffs.length} field{diffs.length === 1 ? "" : "s"} change
            </div>
          </div>
          <label className="block text-xs text-ink-3">
            Activation note (audited)
            <input
              value={activateNote}
              onChange={(e) => setActivateNote(e.target.value)}
              placeholder="why this activation"
              className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-4 focus-visible:outline-2 focus-visible:outline-brand"
            />
          </label>
        </div>
      </ConfirmDialog>
    </div>
  );
}

/** Qualitative direction statements derived from the actual changed fields. */
function describeDirection(
  diffs: Array<{ path: string; oldVal: unknown; newVal: unknown }>,
): string[] {
  const statements: string[] = [];
  const num = (value: unknown) => (typeof value === "number" ? value : null);

  const weightDelta = (prefix: string) => {
    const changed = diffs.filter((d) => d.path.startsWith(prefix));
    let up = 0;
    let down = 0;
    for (const d of changed) {
      const oldVal = num(d.oldVal);
      const newVal = num(d.newVal);
      if (oldVal === null || newVal === null) continue;
      if (newVal > oldVal) up++;
      if (newVal < oldVal) down++;
    }
    return { up, down };
  };

  const feed = weightDelta("feed.weights.");
  if (feed.up > feed.down) statements.push("More personalised feed — affinity/interest signals weigh heavier.");
  if (feed.down > feed.up) statements.push("Less personalised feed — organic signals weigh heavier.");

  const expl = diffs.find((d) => d.path === "feed.exploration.ratio" || d.path === "shorts.exploration.ratio");
  if (expl) {
    const oldVal = num(expl.oldVal);
    const newVal = num(expl.newVal);
    if (oldVal !== null && newVal !== null) {
      statements.push(
        newVal > oldVal
          ? "More exploratory — a larger share of slates reserved for discovery."
          : "Less exploratory — slates follow the scored ordering more strictly.",
      );
    }
  }

  const fresh = diffs.filter((d) => d.path.endsWith("freshness.halfLifeHours"));
  for (const f of fresh) {
    const oldVal = num(f.oldVal);
    const newVal = num(f.newVal);
    if (oldVal !== null && newVal !== null) {
      statements.push(
        newVal < oldVal
          ? "More fresh content — posts/shorts decay faster with age."
          : "Older content stays rankable longer — freshness matters less.",
      );
    }
  }

  const own = diffs.find((d) => d.path.endsWith("weights.ownContent"));
  if (own) {
    const oldVal = num(own.oldVal);
    const newVal = num(own.newVal);
    if (oldVal !== null && newVal !== null) {
      statements.push(
        newVal > oldVal
          ? "Own content ranks higher in one's own feed (still capped at 1.5)."
          : "Own content ranks lower in one's own feed.",
      );
    }
  }

  const diversity = diffs.filter((d) => d.path.includes("diversity.maxPer"));
  if (diversity.some((d) => (num(d.newVal) ?? 1) < (num(d.oldVal) ?? 1))) {
    statements.push("Stricter diversity — fewer repeats per author/game/type in a window.");
  }
  if (diversity.some((d) => (num(d.newVal) ?? 1) > (num(d.oldVal) ?? 1))) {
    statements.push("Looser diversity — more repeats allowed per author/game/type.");
  }

  const shortsWatch = diffs.filter((d) =>
    d.path.startsWith("shorts.weights.watchProbability") ||
    d.path.startsWith("shorts.weights.expectedWatch") ||
    d.path.startsWith("shorts.weights.completion"),
  );
  if (shortsWatch.some((d) => (num(d.newVal) ?? 0) > (num(d.oldVal) ?? 0))) {
    statements.push("Shorts favor watchable, high-retention clips more strongly.");
  }

  return statements.slice(0, 6);
}
