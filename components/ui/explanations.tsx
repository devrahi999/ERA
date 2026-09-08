"use client";

import React from "react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "./interactive";
import type { ScoreExplanation } from "@/types";
import {
  CANDIDATE_SOURCE_LABELS,
  COMPONENT_LABELS,
  formatRatio,
} from "@/lib/formatters/format";

/* =============================================================================
   Recommendation explanations — the "why is this recommended" surface. Every
   number shown comes from the backend's ScoreExplanation; the frontend never
   recomputes a ranking formula.
   ============================================================================= */

/** One horizontal bar of the breakdown: label, value, proportional bar. */
function ComponentBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return (
    <div className="grid grid-cols-[130px_1fr_56px] items-center gap-3">
      <span className="truncate text-xs text-ink-3">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            value >= 0 ? "bg-brand/70" : "bg-danger/70",
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="tnum text-right text-xs font-medium text-ink-2">{formatRatio(value)}</span>
    </div>
  );
}

/**
 * ScoreBreakdown — the per-item component vector from the engine. Ordered by
 * magnitude so the dominant factor reads first.
 */
export function ScoreBreakdown({ explanation }: { explanation: ScoreExplanation }) {
  const entries = Object.entries(explanation.components)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const penalties = Object.entries(explanation.penalties ?? {}).filter(([, v]) => v > 0);
  const max = entries.length > 0 ? Math.max(...entries.map(([, v]) => Math.abs(v))) : 0;

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <ComponentBar
          key={key}
          label={COMPONENT_LABELS[key] ?? key}
          value={value}
          max={max}
        />
      ))}
      {entries.length === 0 ? (
        <div className="text-xs text-ink-4">No component signal on this item.</div>
      ) : null}

      {penalties.length > 0 ? (
        <div className="pt-1">
          {penalties.map(([key, value]) => (
            <div key={key} className="text-[11px] text-danger">
              {key === "repetition" ? "Repetition penalty" : "Negative feedback"} −
              {formatRatio(value * 100, 0)}%
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-ink-4">
        <span>
          organic <span className="tnum text-ink-2">{formatRatio(explanation.organic)}</span>
        </span>
        {explanation.interventionMultiplier !== 1 ? (
          <span>
            intervention{" "}
            <span className="text-ink-2">{formatRatio(explanation.interventionMultiplier)}×</span>
          </span>
        ) : null}
        {explanation.viewerControlMultiplier && explanation.viewerControlMultiplier !== 1 ? (
          <span>
            viewer control{" "}
            <span className="text-brand">{formatRatio(explanation.viewerControlMultiplier)}×</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

/**
 * RecommendationExplanation — the plain-language "why" under a ranked item:
 * source, dominant factors, exploration flag. Truthful, deterministic
 * vocabulary only ("strong affinity", never "AI decided").
 */
export function RecommendationExplanation({ explanation }: { explanation: ScoreExplanation }) {
  const reasons: string[] = [];
  const source = CANDIDATE_SOURCE_LABELS[explanation.source] ?? explanation.source;

  if (explanation.source === "following" || explanation.components.social > 0.5) {
    reasons.push("posted by someone you follow");
  }
  if ((explanation.components.identityAffinity ?? 0) > 0.25) {
    reasons.push("strong identity affinity");
  }
  if ((explanation.components.interest ?? 0) > 0.4) {
    reasons.push("matches your topic interests");
  }
  if ((explanation.components.freshness ?? 0) > 0.7) {
    reasons.push("recently published");
  }
  if ((explanation.components.quality ?? 0) > 0.6) {
    reasons.push("high-quality content");
  }
  if ((explanation.components.watchProbability ?? 0) > 0.6) {
    reasons.push("strong watch retention");
  }
  if ((explanation.components.completion ?? 0) > 0.6) {
    reasons.push("high completion rate");
  }
  if ((explanation.components.popularity ?? 0) > 0.6) {
    reasons.push("popular on the platform");
  }
  if (explanation.exploration) {
    reasons.push("exploration candidate");
  }
  if (Object.keys(explanation.components).includes("ownContent")) {
    reasons.push("your own content (bounded)");
  }
  if (reasons.length === 0) reasons.push("competitive overall score");

  return (
    <div className="text-[12px] leading-5 text-ink-3">
      <span className="text-ink-2">{source}</span> — {reasons.join(", ")}.
    </div>
  );
}

/** EligibilityVerdict — the hard-eligibility panel on the content debugger. */
export function EligibilityVerdict({
  eligibility,
}: {
  eligibility: {
    post_exists: boolean;
    deleted: boolean;
    author_active: boolean;
    author_restricted: boolean;
    moderation_actioned: boolean;
    has_live_video: boolean;
    visibility: string;
    has_features_row: boolean;
  };
}) {
  const hardBlocks: Array<{ label: string; blocked: boolean }> = [
    { label: "Post exists", blocked: !eligibility.post_exists },
    { label: "Not deleted", blocked: eligibility.deleted },
    { label: "Author active", blocked: !eligibility.author_active },
    { label: "Author not restricted", blocked: eligibility.author_restricted },
    { label: "Moderation clear", blocked: eligibility.moderation_actioned },
    { label: "Visibility allows", blocked: eligibility.visibility === "followers" || eligibility.visibility === "private" },
    { label: "Features computed", blocked: !eligibility.has_features_row },
  ];
  const anyBlocked = hardBlocks.some((r) => r.blocked);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Badge tone={anyBlocked ? "danger" : "brand"}>
          {anyBlocked ? "Excluded from ranking" : "Eligible"}
        </Badge>
        <span className="text-[11px] text-ink-4">
          Hard eligibility — enforced before scoring, not a ranking weight
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {hardBlocks.map((rule) => (
          <li
            key={rule.label}
            className={cn("flex items-center gap-2 text-xs", rule.blocked ? "text-danger" : "text-ink-3")}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                rule.blocked ? "bg-danger" : "bg-brand",
              )}
              aria-hidden="true"
            />
            {rule.label}
            {rule.blocked ? <span className="text-ink-4">— blocked</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
