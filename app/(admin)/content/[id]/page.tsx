"use client";

import React from "react";
import { useParams } from "next/navigation";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Metric, MetricRow, PageHeader, Section } from "@/components/ui/primitives";
import { Badge, LoadingState, ErrorState } from "@/components/ui/interactive";
import { ChartLegend, CHART_COLORS, chartAxisProps } from "@/components/ui/data";
import { EligibilityVerdict, ScoreBreakdown } from "@/components/ui/explanations";
import { useDebugContent, usePostExposureHistory, useDebugRanking } from "@/lib/api/queries";
import {
  formatDate,
  formatCompact,
  formatMs,
  formatNumber,
  formatRatio,
  timeAgo,
} from "@/lib/formatters/format";

/* =============================================================================
   Content detail — "how is this content being ranked?" Feature data, the hard
   eligibility verdict, live interventions, lifetime exposure history. All
   numbers from the backend; nothing recomputed here.
   ============================================================================= */

export default function ContentDetailPage() {
  const params = useParams<{ id: string }>();
  const postId = params.id;

  const debug = useDebugContent(postId);
  const history = usePostExposureHistory(postId, 30);

  // To show "how this content ranks for a real viewer", run the ranking
  // debugger on the author as a stand-in viewer — a dry-run, no side effects.
  const authorId =
    (debug.data?.post?.author_id as string | undefined) ?? null;
  const ranking = useDebugRanking({
    viewerId: authorId,
    surface: debug.data?.post?.type_id === "short" ? "shorts" : "feed",
    limit: 50,
  });

  if (debug.isLoading) {
    return <LoadingState rows={8} label="Loading content" />;
  }
  if (debug.error || !debug.data) {
    return (
      <ErrorState
        title="Could not load content details"
        detail={
          debug.error instanceof Error
            ? debug.error.message
            : "No recommendation features for that post — it may not exist."
        }
      />
    );
  }

  const features = (debug.data.features ?? {}) as Record<string, number | string | null>;
  const eligibility = debug.data.eligibility;
  const post = debug.data.post;
  const author = (debug.data.author ?? {}) as Record<string, number | string | null>;
  const interventions = debug.data.interventions ?? [];

  const rankedPosition = ranking.data?.postIds.indexOf(postId) ?? -1;
  const explanation = ranking.data?.explanations[postId];
  const isShort = post?.type_id === "short";

  const series = (history.data?.series ?? []).map((p) => ({ ...p, label: p.date.slice(5) }));
  const summary = history.data?.summary;

  return (
    <div className="space-y-8">
      <PageHeader
        title={isShort ? "Short" : "Post"}
        meta={
          <>
            <span className="font-mono text-[12px] text-ink-3">{postId}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDate(post?.created_at)}</span>
            <span aria-hidden="true">·</span>
            <span className="capitalize">{post?.type_id?.replace(/_/g, " ")}</span>
            {post?.deleted_at ? <Badge tone="danger" className="ml-1">deleted</Badge> : null}
          </>
        }
      />

      {/* Basic information */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Section title="Content">
          <div className="rounded-xl bg-surface-2 p-5 text-[13px] leading-6 text-ink-2">
            <p className="text-ink">{debug.data.post ? "Live post" : "Post missing"}</p>
            <dl className="mt-3 space-y-1.5">
              <Row label="Type" value={String(post?.type_id ?? "—")} />
              <Row label="Visibility" value={String(post?.visibility ?? "—")} />
              <Row label="Game" value={features.game_id ? String(features.game_id) : "—"} />
              <Row label="Has video" value={features.has_video ? "yes" : "no"} />
              <Row
                label="Moderation"
                value={
                  <span className="capitalize">
                    {String(features.moderation_status ?? "published")}
                  </span>
                }
              />
            </dl>
          </div>
        </Section>

        <Section title="Creator">
          <div className="rounded-xl bg-surface-2 p-5">
            <dl className="space-y-1.5 text-[13px]">
              <Row label="Creator quality" value={formatRatio(Number(author.quality_score ?? 0))} />
              <Row label="Creator popularity" value={formatRatio(Number(author.popularity_score ?? 0))} />
              <Row label="Activity" value={formatRatio(Number(author.activity_score ?? 0))} />
              <Row label="Followers" value={formatNumber(Number(author.followers_count ?? 0))} />
              <Row label="Content count" value={formatNumber(Number(author.content_count ?? 0))} />
            </dl>
          </div>
        </Section>
      </div>

      {/* Hard eligibility */}
      {eligibility ? (
        <Section title="Ranking eligibility">
          <div className="rounded-xl bg-surface-2 p-5">
            <EligibilityVerdict eligibility={eligibility} />
          </div>
        </Section>
      ) : null}

      {/* How it's being ranked */}
      <Section
        title="How this content is being ranked"
        note={
          explanation
            ? `Ranked for its own creator's ${isShort ? "shorts" : "feed"} surface (dry-run)`
            : "run a viewer through the Users debugger for a specific breakdown"
        }
      >
        <div className="rounded-xl bg-surface-2 p-5">
          {explanation ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
              <div>
                <Metric
                  label="Position in creator's slate"
                  value={rankedPosition >= 0 ? `#${rankedPosition + 1}` : "not in slate"}
                  tone={rankedPosition >= 0 && rankedPosition < 10 ? "brand" : "default"}
                />
                <div className="mt-4 space-y-1.5 text-xs text-ink-4">
                  <div>
                    Final score <span className="tnum text-ink-2">{formatRatio(explanation.total)}</span>
                  </div>
                  <div>
                    Organic <span className="tnum text-ink-2">{formatRatio(explanation.organic)}</span>
                  </div>
                  <div>
                    Candidate source{" "}
                    <span className="text-ink-2">{explanation.source.replace(/_/g, " ")}</span>
                  </div>
                  {explanation.exploration ? (
                    <div className="text-brand">exploration candidate</div>
                  ) : null}
                </div>
              </div>
              <ScoreBreakdown explanation={explanation} />
            </div>
          ) : (
            <div className="text-sm text-ink-4">
              This content did not appear in the sampled slate. It may be ranked lower than the
              slate size, dropped by diversity/exposure rules, or excluded by eligibility — the
              verdict above is authoritative.
            </div>
          )}
        </div>
      </Section>

      {/* Recommendation performance */}
      <Section title="Recommendation exposure" note="lifetime, from the engine's exposure log">
        <div className="rounded-xl bg-surface-2 p-5">
          <MetricRow className="lg:grid-cols-4">
            <Metric label="Total impressions" value={formatNumber(summary?.impressions)} tone="brand" />
            <Metric label="Unique viewers" value={formatNumber(summary?.viewers)} />
            <Metric label="First shown" value={<span className="text-base">{timeAgo(summary?.first_shown_at)}</span>} />
            <Metric label="Last shown" value={<span className="text-base">{timeAgo(summary?.last_shown_at)}</span>} />
          </MetricRow>

          {(summary?.surfaces ?? []).length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {summary!.surfaces.map((s) => (
                <Badge key={s.surface} tone="neutral">
                  {s.surface}: {formatNumber(s.impressions)}
                </Badge>
              ))}
            </div>
          ) : null}

          <div className="mt-6 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="postGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-line)" vertical={false} />
                <XAxis dataKey="label" {...chartAxisProps} />
                <YAxis {...chartAxisProps} width={36} />
                <Tooltip
                  formatter={(value, name) => [
                    formatNumber(typeof value === "number" ? value : Number(value) || 0),
                    name === "impressions" ? "Impressions" : "Viewers",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  stroke={CHART_COLORS.primary}
                  strokeWidth={1.5}
                  fill="url(#postGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend items={[{ label: "Impressions (30 days)", color: "var(--color-chart-1)" }]} />
        </div>
      </Section>

      {/* Feature snapshot */}
      <Section title="Feature snapshot" note="as the nightly rebuild computed it">
        <div className="rounded-xl bg-surface-2 p-5">
          <MetricRow className="lg:grid-cols-4 sm:grid-cols-3">
            <Metric label="Quality score" value={formatRatio(Number(features.quality_score ?? 0))} />
            <Metric label="Popularity" value={formatRatio(Number(features.popularity_score ?? 0))} />
            <Metric label="Engagement rate" value={formatRatio(Number(features.engagement_rate ?? 0))} />
            <Metric label="Completion rate" value={formatRatio(Number(features.completion_rate ?? 0))} />
            <Metric label="Avg watch" value={formatMs(Number(features.avg_watch_ms ?? 0))} />
            <Metric label="Negative rate" value={formatRatio(Number(features.negative_rate ?? 0))} />
            <Metric label="Observations" value={formatCompact(Number(features.observation_count ?? 0))} />
            <Metric label="Confidence" value={formatRatio(Number(features.confidence ?? 0))} />
          </MetricRow>
        </div>
      </Section>

      {/* Interventions on this content */}
      <Section title="Interventions affecting this content">
        {interventions.length === 0 ? (
          <div className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-ink-4">
            No interventions target this content or its creator.
          </div>
        ) : (
          <div className="space-y-2">
            {interventions.map((iv) => (
              <div key={iv.id} className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
                <div className="text-[13px]">
                  <Badge tone={iv.kind === "boost" ? "brand" : "warning"}>{iv.kind}</Badge>
                  <span className="tnum ml-2 text-ink-2">{Number(iv.multiplier).toFixed(2)}×</span>
                  <span className="ml-2 text-ink-4">{iv.reason}</span>
                </div>
                <div className="text-xs text-ink-4">
                  {iv.revoked_at ? "revoked" : `expires ${formatDate(iv.expires_at)}`}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-ink-4">{label}</dt>
      <dd className="tnum text-right text-ink-2">{value}</dd>
    </div>
  );
}
