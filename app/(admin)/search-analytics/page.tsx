"use client";

import React, { useState } from "react";
import { PageHeader, Section } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/interactive";
import { useDebugIdentitySearch, useDebugRanking, useUsersOverview } from "@/lib/api/queries";
import { ScoreBreakdown, RecommendationExplanation } from "@/components/ui/explanations";
import { formatRatio } from "@/lib/formatters/format";
import type { UserOverviewRow } from "@/types";

/* =============================================================================
   Search analytics. The engine's contract, stated plainly: search is
   RELEVANCE-DOMINANT — personalisation is bounded (max 0.5 weight vs
   relevance min 1.0) and applied as a multiplicative gate, so the admin can
   inspect but never make search into a recommendation feed.
   ============================================================================= */

export default function SearchPage() {
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"personal" | "team">("personal");

  const users = useUsersOverview({ limit: 100 });
  const identitySearch = useDebugIdentitySearch({ viewerId, kind, query, limit: 20 });
  const postSearch = useDebugRanking({
    viewerId,
    surface: "search",
    limit: 20,
    query,
    enabled: query.trim().length > 0,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Search"
        meta={
          <>
            <span>Post, profile and team search ranking</span>
            <Badge tone="info">relevance-dominant</Badge>
            <span className="text-ink-4">
              personalisation is schema-bounded — it cannot override lexical relevance
            </span>
          </>
        }
      />

      {/* Inspector controls */}
      <div className="rounded-xl bg-surface-2 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={viewerId ?? ""}
            onChange={(e) => setViewerId(e.target.value || null)}
            aria-label="Viewer to simulate"
            className="rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
          >
            <option value="">Select a viewer…</option>
            {(users.data?.rows ?? []).map((user: UserOverviewRow) => (
              <option key={user.identity_id} value={user.identity_id}>
                {user.username ? `@${user.username}` : "@deleted"} {user.is_cold_start ? "(cold start)" : ""}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg bg-surface-3 p-0.5" role="group" aria-label="Identity kind">
            {(["personal", "team"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                aria-pressed={kind === k}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  kind === k ? "bg-brand text-brand-ink" : "text-ink-3 hover:text-ink"
                }`}
              >
                {k === "personal" ? "Profiles" : "Teams"}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search query — e.g. valorant, rahi…"
            aria-label="Search query"
            className="flex-1 rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-4 focus-visible:outline-2 focus-visible:outline-brand"
          />
        </div>
      </div>

      {/* Identity search results */}
      <Section
        title={`${kind === "personal" ? "Profile" : "Team"} search ranking`}
        note={
          identitySearch.data
            ? `${identitySearch.data.lexical.length} lexical matches${
                identitySearch.data.restrictedDropped > 0
                  ? ` · ${identitySearch.data.restrictedDropped} restricted dropped`
                  : ""
              }`
            : "lexical match decides WHO appears; ranking re-orders"
        }
      >
        {!viewerId || query.trim().length === 0 ? (
          <div className="rounded-xl bg-surface-2 px-4 py-10 text-center text-sm text-ink-4">
            Select a viewer and type a query to inspect ranked search results with score breakdowns.
          </div>
        ) : identitySearch.isLoading ? (
          <div className="px-2 text-sm text-ink-4">Ranking…</div>
        ) : identitySearch.error ? (
          <div className="px-2 text-sm text-danger">
            Could not load ranking details: {identitySearch.error instanceof Error ? identitySearch.error.message : "unknown error"}
          </div>
        ) : (identitySearch.data?.rankedIds ?? []).length === 0 ? (
          <div className="rounded-xl bg-surface-2 px-4 py-10 text-center text-sm text-ink-4">
            No {kind} matches that query.
          </div>
        ) : (
          <div className="space-y-2">
            {identitySearch.data!.rankedIds.map((identityId, index) => {
              const explanation = identitySearch.data!.explanations[identityId];
              const lexical = identitySearch.data!.lexical.find((m) => m.id === identityId);
              return (
                <div key={identityId} className="rounded-xl bg-surface-2 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-3">
                      <span className="tnum text-sm font-semibold text-ink-4">#{index + 1}</span>
                      <span className="font-mono text-[13px] text-ink-2">{identityId.slice(0, 8)}</span>
                      {lexical ? (
                        <Badge tone="neutral">lexical {formatRatio(lexical.score)}</Badge>
                      ) : null}
                    </div>
                    {explanation ? (
                      <span className="tnum text-sm font-semibold text-brand">
                        {formatRatio(explanation.total)}
                      </span>
                    ) : null}
                  </div>
                  {explanation ? (
                    <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <ScoreBreakdown explanation={explanation} />
                      <RecommendationExplanation explanation={explanation} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Post search ranking */}
      <Section
        title="Post search ranking"
        note="the same ranked path a real post search takes (dry-run)"
      >
        {!viewerId || query.trim().length === 0 ? (
          <div className="rounded-xl bg-surface-2 px-4 py-10 text-center text-sm text-ink-4">
            Post search inspection uses the same viewer and query above.
          </div>
        ) : postSearch.isLoading ? (
          <div className="px-2 text-sm text-ink-4">Ranking…</div>
        ) : postSearch.error ? (
          <div className="px-2 text-sm text-danger">
            Could not load ranking details: {postSearch.error instanceof Error ? postSearch.error.message : "unknown error"}
          </div>
        ) : (postSearch.data?.postIds ?? []).length === 0 ? (
          <div className="rounded-xl bg-surface-2 px-4 py-10 text-center text-sm text-ink-4">
            No post matches that query.
          </div>
        ) : (
          <div className="space-y-2">
            {postSearch.data!.postIds.map((postId, index) => {
              const explanation = postSearch.data!.explanations[postId];
              return (
                <div key={postId} className="rounded-xl bg-surface-2 p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-3">
                      <span className="tnum text-sm font-semibold text-ink-4">#{index + 1}</span>
                      <span className="font-mono text-[13px] text-ink-2">{postId.slice(0, 8)}</span>
                    </div>
                    {explanation ? (
                      <span className="tnum text-sm font-semibold text-brand">
                        {formatRatio(explanation.total)}
                      </span>
                    ) : null}
                  </div>
                  {explanation ? (
                    <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <ScoreBreakdown explanation={explanation} />
                      <RecommendationExplanation explanation={explanation} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* The contract, stated */}
      <Section title="How search ranking is bounded">
        <div className="rounded-xl bg-surface-2 p-5 text-[13px] leading-6 text-ink-3">
          <p>
            <span className="text-ink-2">Relevance is a gate.</span> The lexical score from the
            search index multiplies the final score — a weak match cannot be rescued by
            affinity, quality or popularity, however the weights are tuned.
          </p>
          <p className="mt-2">
            <span className="text-ink-2">Personalisation is capped by schema.</span> Every
            personalisation weight is bounded at 0.5 while relevance carries a minimum of 1.0 —
            enforced by the configuration schema itself, not by convention, so no admin
            adjustment can turn search into a recommendation feed.
          </p>
          <p className="mt-2">
            <span className="text-ink-2">Restricted identities are dropped by the ranker</span>{" "}
            (they remain status=active, so only the ranking layer excludes them) and deleted or
            blocked identities never reach the lexical layer at all.
          </p>
        </div>
      </Section>
    </div>
  );
}
