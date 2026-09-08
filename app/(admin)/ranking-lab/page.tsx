"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PageHeader, Section } from "@/components/ui/primitives";
import { Badge, Button, LoadingState, Tabs } from "@/components/ui/interactive";
import {
  useConfigHistory,
  useDebugRanking,
  useUsersOverview,
} from "@/lib/api/queries";
import { RecommendationExplanation, ScoreBreakdown } from "@/components/ui/explanations";
import { formatRatio } from "@/lib/formatters/format";
import type { DebugRankingResponse } from "@/types";

/* =============================================================================
   Ranking Lab — "rank this" and "compare two configurations". The lab runs
   the REAL pipeline as a dry-run; config A vs config B shows which items move.
   ============================================================================= */

type LabMode = "rank" | "compare";

export default function RankingLabPage() {
  const [mode, setMode] = useState<LabMode>("rank");
  const [viewerId, setViewerId] = useState("");
  const [surface, setSurface] = useState<"feed" | "shorts" | "search">("feed");
  const [query, setQuery] = useState("");
  const [configA, setConfigA] = useState("");
  const [configB, setConfigB] = useState("");
  const [runToken, setRunToken] = useState(0);

  const users = useUsersOverview({ limit: 100 });
  const history = useConfigHistory(50);

  const rankingA = useDebugRanking({
    viewerId: viewerId || null,
    surface,
    limit: 20,
    previewConfigVersionId: configA || null,
    query: surface === "search" ? query : undefined,
    enabled: Boolean(viewerId) && runToken > 0,
  });
  const rankingB = useDebugRanking({
    viewerId: viewerId || null,
    surface,
    limit: 20,
    previewConfigVersionId: configB || null,
    query: surface === "search" ? query : undefined,
    enabled: Boolean(viewerId) && runToken > 0 && mode === "compare" && Boolean(configB),
  });

  const run = () => setRunToken((token) => token + 1);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ranking Lab"
        meta="Run the real pipeline as a dry-run — rank a viewer under any config, or compare two configurations item by item"
      />

      {/* Setup panel */}
      <div className="space-y-4 rounded-xl bg-surface-2 p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-ink-3">
            Viewer
            <select
              value={viewerId}
              onChange={(e) => setViewerId(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
            >
              <option value="">Select a viewer…</option>
              {(users.data?.rows ?? []).map((user) => (
                <option key={user.identity_id} value={user.identity_id}>
                  @{user.username}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-3">
            Surface
            <select
              value={surface}
              onChange={(e) => setSurface(e.target.value as "feed" | "shorts" | "search")}
              className="mt-1 w-full capitalize rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
            >
              <option value="feed">Feed</option>
              <option value="shorts">Shorts</option>
              <option value="search">Search</option>
            </select>
          </label>
          {surface === "search" ? (
            <label className="text-xs text-ink-3">
              Query
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search terms"
                className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-4 focus-visible:outline-2 focus-visible:outline-brand"
              />
            </label>
          ) : null}
          <label className="text-xs text-ink-3">
            Config A{mode === "compare" ? " (baseline)" : ""}
            <select
              value={configA}
              onChange={(e) => setConfigA(e.target.value)}
              className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
            >
              <option value="">Active config</option>
              {(history.data ?? []).map((version) => (
                <option key={version.id} value={version.id}>
                  {version.version_label} ({version.status})
                </option>
              ))}
            </select>
          </label>
          {mode === "compare" ? (
            <label className="text-xs text-ink-3">
              Config B (candidate)
              <select
                value={configB}
                onChange={(e) => setConfigB(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
              >
                <option value="">Select version…</option>
                {(history.data ?? []).map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.version_label} ({version.status})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3">
          <Tabs
            tabs={[
              { id: "rank", label: "Rank this" },
              { id: "compare", label: "Compare A/B" },
            ]}
            active={mode}
            onChange={(id) => setMode(id as LabMode)}
          />
          <Button variant="primary" onClick={run} disabled={!viewerId || (surface === "search" && !query.trim())}>
            Run
          </Button>
        </div>
      </div>

      {runToken === 0 ? (
        <div className="rounded-xl bg-surface-2 px-4 py-12 text-center text-sm text-ink-4">
          Select a viewer (and a config to dry-run, if any) and press Run. Nothing is recorded —
          the lab never touches the viewer&apos;s real exposure history.
        </div>
      ) : mode === "rank" ? (
        <RankResult result={rankingA.data} loading={rankingA.isLoading} error={rankingA.error} />
      ) : (
        <CompareResult a={rankingA.data} b={rankingB.data} loading={rankingA.isLoading || rankingB.isLoading} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ results */

function RankResult({
  result,
  loading,
  error,
}: {
  result?: DebugRankingResponse;
  loading: boolean;
  error: unknown;
}) {
  if (loading) return <LoadingState rows={6} label="Ranking" />;
  if (error) {
    return (
      <div className="rounded-xl bg-surface-2 px-4 py-8 text-center text-sm text-danger">
        Could not load ranking details.
      </div>
    );
  }
  if (!result) return null;
  if (result.fallback) {
    return (
      <div className="rounded-xl bg-surface-2 px-4 py-8 text-center text-sm text-ink-4">
        Ranking did not run: {result.fallbackReason}. (Surface disabled, no candidates, or no
        eligible items.)
      </div>
    );
  }

  return (
    <Section
      title="Result"
      note={`${result.meta.candidateCount} candidates → ${result.meta.resultCount} served · config ${result.meta.algorithmVersion} · ${result.meta.durationMs}ms`}
    >
      <div className="space-y-2">
        {result.postIds.map((postId, index) => {
          const explanation = result.explanations[postId];
          if (!explanation) return null;
          return (
            <div key={postId} className="rounded-xl bg-surface-2 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className="tnum text-sm font-semibold text-ink-4">#{index + 1}</span>
                  <Link href={`/content/${postId}`} className="font-mono text-[13px] text-ink-2 hover:text-brand">
                    {postId.slice(0, 8)}
                  </Link>
                  {explanation.exploration ? <Badge tone="brand">exploration</Badge> : null}
                </div>
                <span className="tnum text-sm font-semibold text-brand">{formatRatio(explanation.total)}</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ScoreBreakdown explanation={explanation} />
                <RecommendationExplanation explanation={explanation} />
              </div>
            </div>
          );
        })}
      </div>
      {result.dropped.length > 0 ? (
        <p className="mt-3 text-xs text-ink-4">
          {result.dropped.length} candidates were considered and excluded — the user debugger
          lists the reasons.
        </p>
      ) : null}
    </Section>
  );
}

function CompareResult({
  a,
  b,
  loading,
}: {
  a?: DebugRankingResponse;
  b?: DebugRankingResponse;
  loading: boolean;
}) {
  if (loading) return <LoadingState rows={6} label="Comparing" />;
  if (!a || !b) {
    return (
      <div className="rounded-xl bg-surface-2 px-4 py-8 text-center text-sm text-ink-4">
        Select both configs and press Run.
      </div>
    );
  }

  const positionA = new Map(a.postIds.map((id, i) => [id, i + 1]));
  const positionB = new Map(b.postIds.map((id, i) => [id, i + 1]));
  const allIds = new Set([...a.postIds, ...b.postIds]);

  const moves = Array.from(allIds)
    .map((id) => ({
      id,
      from: positionA.get(id),
      to: positionB.get(id),
    }))
    .sort((x, y) => {
      const xMoved = x.from !== x.to;
      const yMoved = y.from !== y.to;
      if (xMoved !== yMoved) return xMoved ? -1 : 1;
      return (x.to ?? 999) - (y.to ?? 999);
    });

  return (
    <Section
      title="What moves between configs"
      note={`${a.meta.algorithmVersion} → ${b.meta.algorithmVersion}`}
    >
      <div className="overflow-hidden rounded-xl bg-surface-2">
        {moves.map((move) => {
          const same = move.from === move.to;
          const isNew = !move.from;
          const removed = !move.to;
          return (
            <div
              key={move.id}
              className="flex items-center gap-3 border-b border-line/50 px-4 py-2.5 text-[13px] last:border-0"
            >
              <Link href={`/content/${move.id}`} className="font-mono text-xs text-ink-2 hover:text-brand">
                {move.id.slice(0, 8)}
              </Link>
              <span className="tnum ml-auto flex items-center gap-2">
                {same ? (
                  <span className="text-ink-4">
                    stays #{move.to}
                  </span>
                ) : isNew ? (
                  <>
                    <span className="text-ink-4">not in A</span>
                    <span className="font-medium text-brand">new #{move.to}</span>
                  </>
                ) : removed ? (
                  <>
                    <span className="text-ink-4">#{move.from} in A</span>
                    <span className="font-medium text-danger">excluded in B</span>
                  </>
                ) : (
                  <>
                    <span className="text-ink-4">#{move.from}</span>
                    <span className="text-ink-4">→</span>
                    <span className={(move.to ?? 0) < (move.from ?? 0) ? "font-medium text-brand" : "font-medium text-warning"}>
                      #{move.to}
                    </span>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-4">
        {moves.filter((m) => m.from !== m.to).length} of {moves.length} items move, enter or
        leave the slate between the two configurations.
      </p>
    </Section>
  );
}
