"use client";

import React from "react";
import Link from "next/link";
import { PageHeader, Section } from "@/components/ui/primitives";
import { Search, User, FileText, FlaskConical } from "lucide-react";

/* =============================================================================
   Debugger hub — the central workspace. Three primary inspectors (user,
   content, identity) plus the Ranking Lab; search fields deep-link into the
   explorers with the query prefilled.
   ============================================================================= */

const MODES = [
  {
    href: "/users",
    icon: User,
    title: "User Debugger",
    description: "Why is this user seeing this? Their live slate with per-item score breakdowns, why-excluded reasons, cold-start state, temporary controls and feed preview.",
    input: "Search by username or identity id…",
  },
  {
    href: "/content",
    icon: FileText,
    title: "Content Debugger",
    description: "How is this content being ranked? Feature snapshot, the hard eligibility verdict, score breakdown and lifetime recommendation history.",
    input: "Search by post id, caption or creator…",
  },
  {
    href: "/identities",
    icon: Search,
    title: "Identity Debugger",
    description: "Why is this identity surfacing? Affinity features, exposure, and the audience actually receiving its content.",
    input: "Search by username…",
  },
  {
    href: "/ranking-lab",
    icon: FlaskConical,
    title: "Ranking Lab",
    description: "Run the real pipeline as a dry-run for any viewer under any config — and compare two configurations item by item to see what moves.",
    input: null,
  },
] as const;

export default function DebuggerHubPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Debugger"
        meta="The central inspection workspace — every answer comes from the real pipeline, never a simulation of it"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {MODES.map((mode) => {
          const Icon = mode.icon;
          return (
            <Link
              key={mode.href}
              href={mode.href}
              className="group rounded-xl bg-surface-2 p-6 transition-colors hover:bg-surface-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/15 text-brand">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="text-[15px] font-semibold text-ink group-hover:text-brand">
                  {mode.title}
                </span>
              </div>
              <p className="mt-3 text-[13px] leading-5 text-ink-3">{mode.description}</p>
            </Link>
          );
        })}
      </div>

      <Section title="Explanation vocabulary" note="the engine is deterministic and rule-based — the words match">
        <div className="rounded-xl bg-surface-2 p-5 text-[13px] leading-6 text-ink-3">
          <p>
            Every ranked item explains itself with its candidate source (following, identity
            affinity, interest, trending, cold start, recent, quality), its per-component
            scores (interest, identity affinity, social, quality, engagement, watch, freshness,
            popularity, own content), applied penalties (repetition, negative feedback), and
            any intervention or viewer-control multipliers.
          </p>
          <p className="mt-2">
            Excluded items state the rule that excluded them. Nothing is described as
            &quot;AI-decided&quot; — the ranking is a deterministic function of the config,
            the feature tables and the viewer&apos;s history.
          </p>
        </div>
      </Section>
    </div>
  );
}
