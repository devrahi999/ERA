"use client";

import React from "react";
import { Metric, MetricRow, PageHeader, Section } from "@/components/ui/primitives";
import { Badge, StatusDot } from "@/components/ui/interactive";
import { useExperiments, useOverview } from "@/lib/api/queries";
import { formatNumber, timeAgo } from "@/lib/formatters/format";

/* =============================================================================
   System — backend connectivity and the recommendation service state. Health
   states are derived from what the overview endpoint actually reports;
   database/cache internals are not exposed by the API and say so.
   ============================================================================= */

export default function SystemPage() {
  const overview = useOverview();
  const experiments = useExperiments();

  const healthy = !overview.error;
  const freshness = overview.data?.featureFreshness;
  const runningExperiments = (experiments.data ?? []).filter((e) => e.status === "running");

  const services = [
    {
      name: "esporta-backend API",
      state: healthy ? ("healthy" as const) : ("offline" as const),
      detail: healthy
        ? "Admin API reachable — authenticated and authorized"
        : "The backend is unreachable. Reads may show cached state; mutations will fail.",
    },
    {
      name: "Recommendation service",
      state: healthy && !overview.data?.activeVersion?.fallback ? ("healthy" as const) : healthy ? ("degraded" as const) : ("offline" as const),
      detail: overview.data?.activeVersion?.fallback
        ? "Serving built-in defaults — no stored config version is active"
        : healthy
          ? `Ranking on ${overview.data?.activeVersion?.label ?? "unknown"}`
          : "State unknown",
    },
    {
      name: "Feature pipeline",
      state: healthy ? ("healthy" as const) : ("offline" as const),
      detail: `Last rebuild ${timeAgo(freshness?.user?.last_computed_at)} · scheduled nightly at 00:45 UTC`,
    },
    {
      name: "Experiments",
      state: healthy ? ("healthy" as const) : ("offline" as const),
      detail:
        runningExperiments.length > 0
          ? `${runningExperiments.length} running: ${runningExperiments.map((e) => e.name).join(", ")}`
          : "No experiments running",
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="System"
        meta="Operational state of the recommendation backend — never fabricated, only reported"
      />

      <Section title="Services">
        <div className="space-y-2">
          {services.map((service) => (
            <div
              key={service.name}
              className="flex flex-col gap-1 rounded-xl bg-surface-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <span className="w-56 shrink-0 text-[13px] font-medium text-ink">{service.name}</span>
              <StatusDot
                tone={service.state === "healthy" ? "live" : service.state === "degraded" ? "warn" : "danger"}
                label={service.state}
                pulse={service.state === "healthy"}
              />
              <span className="text-xs text-ink-4 sm:ml-auto sm:text-right">{service.detail}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Feature tables" note="row counts from the last rebuild">
        <div className="rounded-xl bg-surface-2 p-5">
          <MetricRow className="lg:grid-cols-3">
            <Metric
              label="Content features"
              value={formatNumber((freshness?.content as { rows?: number } | undefined)?.rows)}
              sub={`computed ${timeAgo((freshness?.content as { last_computed_at?: string } | undefined)?.last_computed_at)}`}
              loading={overview.isLoading}
            />
            <Metric
              label="Identity features"
              value={formatNumber((freshness?.identity as { rows?: number } | undefined)?.rows)}
              sub={`computed ${timeAgo((freshness?.identity as { last_computed_at?: string } | undefined)?.last_computed_at)}`}
              loading={overview.isLoading}
            />
            <Metric
              label="User profiles"
              value={formatNumber((freshness?.user as { rows?: number } | undefined)?.rows)}
              sub={`computed ${timeAgo((freshness?.user as { last_computed_at?: string } | undefined)?.last_computed_at)}`}
              loading={overview.isLoading}
            />
          </MetricRow>
        </div>
      </Section>

      <Section title="Not exposed by the API" note="stated, not approximated">
        <div className="rounded-xl bg-surface-2 p-5">
          <div className="space-y-2 text-[13px] text-ink-4">
            <p>
              <Badge tone="warning">not available</Badge>{" "}
              <span className="ml-1">
                Database connection state and cache internals — the admin API does not expose
                them, so no health state is invented for them.
              </span>
            </p>
            <p>
              <Badge tone="warning">not available</Badge>{" "}
              <span className="ml-1">
                Requester IP/device in the audit trail — the audit table records actor and
                state only.
              </span>
            </p>
          </div>
        </div>
      </Section>
    </div>
  );
}
