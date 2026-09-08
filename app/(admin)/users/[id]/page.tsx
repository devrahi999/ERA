"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Metric, MetricRow, PageHeader, Section } from "@/components/ui/primitives";
import {
  Badge,
  Button,
  ConfirmDialog,
  LoadingState,
  ErrorState,
  Tabs,
} from "@/components/ui/interactive";
import { RecommendationExplanation, ScoreBreakdown } from "@/components/ui/explanations";
import {
  useConfigHistory,
  useDebugRanking,
  useDebugUser,
  useRevokeViewerControls,
  useSetViewerControls,
  useViewerControls,
} from "@/lib/api/queries";
import {
  CANDIDATE_SOURCE_LABELS,
  DROPPED_REASON_LABELS,
  formatDate,
  formatNumber,
  formatRatio,
  timeAgo,
} from "@/lib/formatters/format";

/* =============================================================================
   User detail — the heart of the debugger. Four views:
     Profile    — the recommendation profile (topics, identities, cold start)
     Feed       — "why is this user seeing this": the live slate with per-item
                  breakdowns and why-excluded
     Controls   — temporary, bounded, audited viewer controls
     Preview    — simulation: current config vs draft config vs control effect
   ============================================================================= */

type TabId = "profile" | "feed" | "controls" | "preview";

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const identityId = params.id;
  const [tab, setTab] = useState<TabId>("profile");

  const profile = useDebugUser(identityId);

  if (profile.isLoading) return <LoadingState rows={8} label="Loading user" />;
  if (profile.error || !profile.data) {
    return (
      <ErrorState
        title="Could not load user"
        detail="No recommendation profile for that identity — the engine may not have observed activity yet."
      />
    );
  }

  const user = profile.data;
  const features = (user.features ?? {}) as Record<string, number | string | boolean | string[] | null>;

  return (
    <div className="space-y-8">
      <PageHeader
        title={user.identity?.display_name ?? "User"}
        meta={
          <>
            <span>@{user.identity?.username}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{user.identity?.kind}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-[11px] text-ink-4">{identityId.slice(0, 8)}</span>
            {features.is_cold_start ? <Badge tone="info" className="ml-1">cold start</Badge> : null}
          </>
        }
      />

      <Tabs
        tabs={[
          { id: "profile", label: "Profile" },
          { id: "feed", label: "Feed debugger" },
          { id: "controls", label: "Controls" },
          { id: "preview", label: "Preview" },
        ]}
        active={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === "profile" ? <ProfileView identityId={identityId} /> : null}
      {tab === "feed" ? <FeedView identityId={identityId} /> : null}
      {tab === "controls" ? <ControlsView identityId={identityId} /> : null}
      {tab === "preview" ? <PreviewView identityId={identityId} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ profile */

function ProfileView({ identityId }: { identityId: string }) {
  const profile = useDebugUser(identityId);
  const data = profile.data!;
  const features = (data.features ?? {}) as Record<string, number | string | boolean | string[] | null>;
  const topics = data.topics ?? [];
  const topIdentities = data.top_identities ?? [];
  const exposures = data.recent_exposures ?? [];

  const games = topics.filter((t) => t.dimension === "game");
  const contentTypes = topics.filter((t) => t.dimension === "content_type");
  const roles = topics.filter((t) => t.dimension === "role");
  const negatives = topIdentities.filter((i) => i.score < 0);

  return (
    <div className="space-y-8">
      <Section title="Recommendation profile" note={`computed ${timeAgo(String(features.computed_at ?? ""))}`}>
        <div className="rounded-xl bg-surface-2 p-5">
          <MetricRow className="lg:grid-cols-4 sm:grid-cols-3">
            <Metric label="Interactions" value={formatNumber(Number(features.interaction_count ?? 0))} tone="brand" />
            <Metric label="Following" value={formatNumber(Number(features.following_count ?? 0))} />
            <Metric label="Confidence" value={formatRatio(Number(features.confidence ?? 0))} />
            <Metric
              label="Cold start"
              value={features.is_cold_start ? "ACTIVE" : "Warm"}
              tone={features.is_cold_start ? "warning" : "default"}
            />
            <Metric label="Engagement tendency" value={formatRatio(Number(features.engagement_tendency ?? 0))} />
            <Metric label="Watch tendency" value={formatRatio(Number(features.watch_tendency ?? 0))} />
            <Metric label="Short affinity" value={formatRatio(Number(features.short_affinity ?? 0))} />
            <Metric label="Exploration appetite" value={formatRatio(Number(features.exploration_appetite ?? 0))} />
          </MetricRow>
          {features.is_cold_start ? (
            <p className="mt-4 text-[13px] leading-5 text-ink-3">
              This viewer is below the cold-start interaction threshold. Signals available:
              declared games {Array.isArray(features.declared_game_ids) && features.declared_game_ids.length > 0 ? String(features.declared_game_ids.join(", ")) : "none"}
              {features.declared_role_id ? `, role ${String(features.declared_role_id)}` : ""}. Cold-start
              slates lean on declared interest, initial quality priors and a higher exploration
              allowance.
            </p>
          ) : null}
        </div>
      </Section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Section title="Topic affinities" note="games, content types, roles — strongest first">
          <div className="rounded-xl bg-surface-2 p-4">
            {games.length === 0 && contentTypes.length === 0 && roles.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-ink-4">No topic signals yet.</div>
            ) : (
              <div className="space-y-4">
                {games.length > 0 ? <AffinityList label="Games" items={games} /> : null}
                {contentTypes.length > 0 ? <AffinityList label="Content types" items={contentTypes} /> : null}
                {roles.length > 0 ? <AffinityList label="Roles" items={roles} /> : null}
              </div>
            )}
          </div>
        </Section>

        <Section title="Identity affinities" note={`${topIdentities.length} tracked — signed, negative demotes`}>
          <div className="rounded-xl bg-surface-2 p-4">
            {topIdentities.length === 0 ? (
              <div className="px-2 py-6 text-center text-sm text-ink-4">No identity signals yet.</div>
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {topIdentities.slice(0, 15).map((identity) => (
                  <div key={identity.target_id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px]">
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${identity.score < 0 ? "bg-danger" : identity.follows ? "bg-brand" : "bg-ink-4"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate text-ink-2">
                      {identity.username ? `@${identity.username}` : identity.target_id.slice(0, 8)}
                      {identity.follows ? <span className="ml-1 text-[11px] text-brand">follows</span> : null}
                    </span>
                    <span className="tnum text-xs text-ink-4">{identity.interactions} int.</span>
                    <span className={`tnum w-12 text-right text-xs font-medium ${identity.score < 0 ? "text-danger" : "text-ink-2"}`}>
                      {formatRatio(identity.score)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {negatives.length > 0 ? (
              <div className="mt-2 px-2 text-[11px] text-danger">
                {negatives.length} negative affinit{negatives.length === 1 ? "y" : "ies"} — demoted below strangers
              </div>
            ) : null}
          </div>
        </Section>
      </div>

      <Section title="Recent exposures" note="what the engine has shown this viewer lately">
        <div className="rounded-xl bg-surface-2 p-4">
          {exposures.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-ink-4">
              No recorded exposures — this viewer has not been served a ranked slate recently.
            </div>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {exposures.slice(0, 20).map((exp, i) => (
                <Link
                  key={`${exp.post_id}-${i}`}
                  href={`/content/${exp.post_id}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-surface-3"
                >
                  <Badge tone="neutral">{exp.surface}</Badge>
                  <span className="font-mono text-xs text-ink-3">{exp.post_id.slice(0, 8)}</span>
                  <span className="ml-auto text-xs text-ink-4">shown {exp.shown}×</span>
                  <span className="text-xs text-ink-4">{timeAgo(exp.last_shown_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

function AffinityList({
  label,
  items,
}: {
  label: string;
  items: Array<{ key: string; score: number; interactions: number }>;
}) {
  const max = Math.max(...items.map((i) => Math.abs(i.score)), 0.001);
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-ink-4">{label}</div>
      <div className="space-y-1">
        {items.slice(0, 8).map((item) => (
          <div key={item.key} className="grid grid-cols-[110px_1fr_44px] items-center gap-2 text-xs">
            <span className="truncate text-ink-2">{item.key}</span>
            <div className="h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
              <div
                className={`h-full rounded-full ${item.score >= 0 ? "bg-brand/70" : "bg-danger/70"}`}
                style={{ width: `${Math.min(100, (Math.abs(item.score) / max) * 100)}%` }}
              />
            </div>
            <span className="tnum text-right text-ink-3">{formatRatio(item.score)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- feed */

function FeedView({ identityId }: { identityId: string }) {
  const [surface, setSurface] = useState<"feed" | "shorts">("feed");
  const ranking = useDebugRanking({ viewerId: identityId, surface, limit: 20 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: "feed", label: "Feed" },
            { id: "shorts", label: "Shorts" },
          ]}
          active={surface}
          onChange={(id) => setSurface(id as "feed" | "shorts")}
        />
        <span className="text-xs text-ink-4">dry-run — nothing is recorded to the viewer&apos;s history</span>
      </div>

      {ranking.isLoading ? (
        <LoadingState rows={5} label="Ranking" />
      ) : ranking.error ? (
        <ErrorState title="Could not load ranking details" />
      ) : ranking.data?.fallback ? (
        <div className="rounded-xl bg-surface-2 px-4 py-10 text-center text-sm text-ink-4">
          Ranking did not run ({ranking.data.fallbackReason ?? "unknown"}). The surface may be
          disabled in the active config, or the candidate pool was empty.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl bg-surface-2 px-4 py-3 text-xs text-ink-4">
            <span>
              candidates <span className="tnum text-ink-2">{ranking.data!.meta.candidateCount}</span>
            </span>
            <span>
              eligible <span className="tnum text-ink-2">{ranking.data!.meta.eligibleCount}</span>
            </span>
            <span>
              served <span className="tnum text-ink-2">{ranking.data!.meta.resultCount}</span>
            </span>
            <span>
              cold start{" "}
              <span className="text-ink-2">{ranking.data!.meta.coldStart ? "yes" : "no"}</span>
            </span>
            <span>
              config{" "}
              <span className="font-mono text-ink-2">{ranking.data!.meta.algorithmVersion}</span>
            </span>
            <span>
              duration <span className="tnum text-ink-2">{ranking.data!.meta.durationMs}ms</span>
            </span>
          </div>

          <div className="space-y-2">
            {ranking.data!.postIds.map((postId, index) => {
              const explanation = ranking.data!.explanations[postId];
              if (!explanation) return null;
              return (
                <div key={postId} className="rounded-xl bg-surface-2 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex min-w-0 items-baseline gap-3">
                      <span className="tnum text-sm font-semibold text-ink-4">#{index + 1}</span>
                      <Link
                        href={`/content/${postId}`}
                        className="truncate font-mono text-[13px] text-ink-2 hover:text-brand"
                      >
                        {postId.slice(0, 8)}
                      </Link>
                      <Badge tone="neutral">
                        {CANDIDATE_SOURCE_LABELS[explanation.source] ?? explanation.source}
                      </Badge>
                      {explanation.exploration ? <Badge tone="brand">exploration</Badge> : null}
                    </div>
                    <span className="tnum text-sm font-semibold text-brand">
                      {formatRatio(explanation.total)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <ScoreBreakdown explanation={explanation} />
                    <RecommendationExplanation explanation={explanation} />
                  </div>
                </div>
              );
            })}
          </div>

          {ranking.data!.dropped.length > 0 ? (
            <Section title="Considered but excluded" note="why these did NOT make the slate">
              <div className="space-y-1">
                {ranking.data!.dropped.slice(0, 15).map((drop) => (
                  <div key={drop.postId} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
                    <span className="font-mono text-xs text-ink-3">{drop.postId.slice(0, 8)}</span>
                    <span className="ml-auto text-xs text-danger">
                      {DROPPED_REASON_LABELS[drop.reason] ?? drop.reason}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
        </>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- controls */

function ControlsView({ identityId }: { identityId: string }) {
  const controls = useViewerControls(identityId, "feed");
  const setControls = useSetViewerControls();
  const revokeControls = useRevokeViewerControls();

  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [boostGame, setBoostGame] = useState("");
  const [boostMultiplier, setBoostMultiplier] = useState("1.5");
  const [suppressGame, setSuppressGame] = useState("");
  const [exploration, setExploration] = useState<"default" | "low" | "high">("default");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ surface: string | null } | null>(null);

  const activeRows = (controls.data?.rows ?? []).filter(
    (row) => !row.revoked_at && new Date(row.expires_at) > new Date(),
  );

  const buildControlsDoc = () => {
    const doc: Record<string, unknown> = {};
    const boosts: Record<string, number> = {};
    const suppress: Record<string, number> = {};
    if (boostGame.trim() && boostMultiplier) boosts[`game:${boostGame.trim()}`] = Number(boostMultiplier);
    if (suppressGame.trim()) suppress[`game:${suppressGame.trim()}`] = 0.5;
    if (Object.keys(boosts).length > 0) doc.boosts = boosts;
    if (Object.keys(suppress).length > 0) doc.suppress = suppress;
    if (exploration !== "default") doc.exploration = exploration;
    return doc;
  };

  const canSubmit =
    reason.trim().length >= 3 &&
    expiresAt &&
    new Date(expiresAt) > new Date() &&
    Object.keys(buildControlsDoc()).length > 0;

  return (
    <div className="space-y-8">
      <Section
        title="Active controls"
        note="temporary · bounded (0.25–3×) · expiring · audited · cannot bypass hard eligibility"
      >
        {controls.isLoading ? (
          <LoadingState rows={2} />
        ) : activeRows.length === 0 ? (
          <div className="rounded-xl bg-surface-2 px-4 py-8 text-center text-sm text-ink-4">
            No active controls for this viewer. Their recommendations run on the standard config.
          </div>
        ) : (
          <div className="space-y-2">
            {activeRows.map((row) => (
              <div key={`${row.identity_id}-${row.surface_id ?? "all"}`} className="rounded-xl bg-surface-2 p-4">
                <div className="flex flex-wrap items-center gap-2 text-[13px]">
                  <Badge tone="brand">active</Badge>
                  <span className="text-ink-2">{row.surface_id ?? "all surfaces"}</span>
                  <span className="text-ink-4">expires {formatDate(row.expires_at)}</span>
                  <Button
                    variant="danger"
                    size="sm"
                    className="ml-auto"
                    onClick={() => setRevokeTarget({ surface: row.surface_id })}
                  >
                    Revoke
                  </Button>
                </div>
                <div className="mt-2 space-y-1 text-xs text-ink-3">
                  {Object.entries(row.controls.boosts ?? {}).map(([key, value]) => (
                    <div key={key}>
                      boost <span className="text-ink-2">{key}</span> at{" "}
                      <span className="tnum text-brand">{value}×</span>
                    </div>
                  ))}
                  {Object.entries(row.controls.suppress ?? {}).map(([key, value]) => (
                    <div key={key}>
                      suppress <span className="text-ink-2">{key}</span> at{" "}
                      <span className="tnum text-warning">{value}×</span>
                    </div>
                  ))}
                  {row.controls.exploration && row.controls.exploration !== "default" ? (
                    <div>
                      exploration <span className="text-ink-2">{row.controls.exploration}</span>
                    </div>
                  ) : null}
                </div>
                <div className="mt-2 text-[11px] text-ink-4">
                  “{row.reason}” — set {formatDate(row.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Set a control" note="requires a reason and an expiry — max 90 days">
        <div className="rounded-xl bg-surface-2 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="text-xs text-ink-3">
              Boost game (e.g. valorant)
              <input
                value={boostGame}
                onChange={(e) => setBoostGame(e.target.value)}
                placeholder="game id"
                className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-4 focus-visible:outline-2 focus-visible:outline-brand"
              />
            </label>
            <label className="text-xs text-ink-3">
              Boost multiplier (1 — 3)
              <input
                value={boostMultiplier}
                onChange={(e) => setBoostMultiplier(e.target.value)}
                inputMode="decimal"
                className="tnum mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
              />
            </label>
            <label className="text-xs text-ink-3">
              Suppress game (0.5× fixed)
              <input
                value={suppressGame}
                onChange={(e) => setSuppressGame(e.target.value)}
                placeholder="game id"
                className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-4 focus-visible:outline-2 focus-visible:outline-brand"
              />
            </label>
            <label className="text-xs text-ink-3">
              Exploration preference
              <select
                value={exploration}
                onChange={(e) => setExploration(e.target.value as "default" | "low" | "high")}
                className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
              >
                <option value="default">Default</option>
                <option value="low">Low</option>
                <option value="high">High</option>
              </select>
            </label>
            <label className="text-xs text-ink-3">
              Reason (required, audited)
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Testing recommendation behavior"
                className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-4 focus-visible:outline-2 focus-visible:outline-brand"
              />
            </label>
            <label className="text-xs text-ink-3">
              Expires at (required)
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
              />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <p className="max-w-md text-[11px] leading-4 text-ink-4">
              Controls apply on top of the active config, inside the same 0.25–3× band as global
              interventions. They reorder eligible content only — deleted, private, blocked,
              restricted and under-review content stays excluded.
            </p>
            <Button variant="primary" disabled={!canSubmit} onClick={() => setConfirmOpen(true)}>
              Apply control
            </Button>
          </div>
        </div>
      </Section>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setControls.mutate(
            {
              identityId,
              surface: null,
              controls: buildControlsDoc(),
              reason: reason.trim(),
              expiresAt: new Date(expiresAt).toISOString(),
            },
            { onSuccess: () => setConfirmOpen(false) },
          );
        }}
        title="Apply viewer control"
        description="This temporarily changes recommendation behavior for this one viewer. It is bounded, expires automatically, and is fully audited and reversible."
        confirmLabel="Apply"
        busy={setControls.isPending}
      >
        <div className="rounded-lg bg-surface-3 p-3 text-[13px] text-ink-2">
          <div className="font-mono text-[11px] text-ink-4">{JSON.stringify(buildControlsDoc())}</div>
          <div className="mt-2 text-xs">
            expires {expiresAt ? new Date(expiresAt).toLocaleString() : "—"}
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) {
            revokeControls.mutate(
              { identityId, surface: revokeTarget.surface as "feed" | "shorts" | "search" | null },
              { onSuccess: () => setRevokeTarget(null) },
            );
          }
        }}
        title="Revoke viewer control"
        description="The viewer immediately returns to standard recommendation behavior. The control's history stays in the audit log."
        confirmLabel="Revoke"
        danger
        busy={revokeControls.isPending}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ preview */

function PreviewView({ identityId }: { identityId: string }) {
  const [surface, setSurface] = useState<"feed" | "shorts">("feed");
  const [mode, setMode] = useState<"live" | "draft">("live");
  const history = useConfigHistory(50);
  const drafts = (history.data ?? []).filter((v) => v.status === "draft");
  const [draftId, setDraftId] = useState<string>("");

  const previewControlsJson = mode === "draft" && draftId ? null : null; // control simulation handled by Controls
  const ranking = useDebugRanking({
    viewerId: identityId,
    surface,
    limit: 20,
    previewConfigVersionId: mode === "draft" && draftId ? draftId : null,
    previewControls: previewControlsJson ?? undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Tabs
            tabs={[
              { id: "feed", label: "Feed" },
              { id: "shorts", label: "Shorts" },
            ]}
            active={surface}
            onChange={(id) => setSurface(id as "feed" | "shorts")}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-surface-3 p-0.5" role="group" aria-label="Config mode">
            <button
              onClick={() => setMode("live")}
              aria-pressed={mode === "live"}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "live" ? "bg-brand text-brand-ink" : "text-ink-3 hover:text-ink"
              }`}
            >
              Live config
            </button>
            <button
              onClick={() => setMode("draft")}
              aria-pressed={mode === "draft"}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "draft" ? "bg-brand text-brand-ink" : "text-ink-3 hover:text-ink"
              }`}
            >
              Draft config
            </button>
          </div>
          {mode === "draft" ? (
            <select
              value={draftId}
              onChange={(e) => setDraftId(e.target.value)}
              aria-label="Draft version"
              className="rounded-lg bg-surface-3 px-2 py-1.5 text-xs text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
            >
              <option value="">Select draft…</option>
              {drafts.map((draft) => (
                <option key={draft.id} value={draft.id}>
                  {draft.version_label}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl bg-warning/10 px-4 py-2.5 text-xs font-medium text-warning">
        PREVIEW / SIMULATION — this is a dry-run against real data. The viewer&apos;s actual
        preferences and history are never modified.
      </div>
      {mode === "draft" && !draftId ? (
        <div className="rounded-xl bg-surface-2 px-4 py-10 text-center text-sm text-ink-4">
          Select a draft config version to preview what it would serve this viewer.
        </div>
      ) : ranking.isLoading ? (
        <LoadingState rows={5} label="Ranking" />
      ) : ranking.error ? (
        <ErrorState title="Could not run the preview" />
      ) : (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-x-6 gap-y-1 px-1 text-xs text-ink-4">
            <span>
              config <span className="font-mono text-ink-2">{ranking.data!.meta.algorithmVersion}</span>
            </span>
            <span>
              candidates <span className="tnum text-ink-2">{ranking.data!.meta.candidateCount}</span>
            </span>
            <span>
              served <span className="tnum text-ink-2">{ranking.data!.meta.resultCount}</span>
            </span>
          </div>
          {(ranking.data?.postIds ?? []).map((postId, index) => {
            const explanation = ranking.data!.explanations[postId];
            if (!explanation) return null;
            return (
              <div key={postId} className="flex items-center gap-3 rounded-lg bg-surface-2 px-3 py-2">
                <span className="tnum w-6 text-right text-xs font-semibold text-ink-4">#{index + 1}</span>
                <Link href={`/content/${postId}`} className="font-mono text-xs text-ink-2 hover:text-brand">
                  {postId.slice(0, 8)}
                </Link>
                {explanation.exploration ? <Badge tone="brand">exploration</Badge> : null}
                {explanation.viewerControlMultiplier && explanation.viewerControlMultiplier !== 1 ? (
                  <Badge tone="brand">control {formatRatio(explanation.viewerControlMultiplier)}×</Badge>
                ) : null}
                <span className="tnum ml-auto text-xs font-semibold text-brand">
                  {formatRatio(explanation.total)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
