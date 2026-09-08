"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PageHeader, Section } from "@/components/ui/primitives";
import { Badge, Button, StatusDot, Tabs } from "@/components/ui/interactive";
import { useConfigHistory, useOverview, useConfigVersion } from "@/lib/api/queries";
import { CONFIG_SECTIONS, getPath } from "@/lib/config/catalog";
import { timeAgo } from "@/lib/formatters/format";


/* =============================================================================
   Configuration — the live config, structured (never raw-JSON-first), with
   the draft → validate → compare → activate workflow. Raw JSON stays an
   advanced expandable view.
   ============================================================================= */

export default function ConfigurationPage() {
  const [tab, setTab] = useState("live");
  const overview = useOverview();
  const history = useConfigHistory(50);
  const activeVersionId = overview.data?.activeVersion?.id;
  const activeIsReal = activeVersionId && !overview.data?.activeVersion?.fallback;
  const active = useConfigVersion(activeIsReal ? activeVersionId : null);

  const liveConfig = (active.data?.config ?? {}) as Record<string, unknown>;
  const drafts = (history.data ?? []).filter((v) => v.status === "draft");

  return (
    <div className="space-y-8">
      <PageHeader
        title="Configuration"
        meta={
          <>
            <StatusDot
              tone={overview.data?.activeVersion?.fallback ? "warn" : "live"}
              label={
                overview.data?.activeVersion?.fallback
                  ? "Built-in defaults — no stored version active"
                  : `Live · ${overview.data?.activeVersion?.label ?? ""}`
              }
            />
            {active.data?.activated_at ? (
              <span>activated {timeAgo(active.data.activated_at)}</span>
            ) : null}
          </>
        }
        actions={
          <>
            <Link href="/configuration/history">
              <Button variant="tonal">History</Button>
            </Link>
            <Link href="/configuration/new">
              <Button variant="primary">Create draft</Button>
            </Link>
          </>
        }
      />

      {/* Draft workflow notice */}
      {drafts.length > 0 ? (
        <div className="rounded-xl bg-warning/10 px-4 py-3 text-[13px] text-warning">
          {drafts.length} draft{drafts.length > 1 ? "s" : ""} awaiting review —{" "}
          {drafts.map((draft, i) => (
            <span key={draft.id}>
              {i > 0 ? ", " : ""}
              <Link href={`/configuration/${draft.id}`} className="font-medium underline underline-offset-2">
                {draft.version_label}
              </Link>
            </span>
          ))}
          . Validation and comparison happen before activation.
        </div>
      ) : null}

      <Tabs
        tabs={[
          { id: "live", label: "Live config" },
          { id: "raw", label: "Raw JSON", count: undefined },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "live" ? (
        <>
          {overview.data?.activeVersion?.fallback ? (
            <Section title="Built-in defaults" note="no stored version is active — the schema-derived defaults are serving">
              <div className="rounded-xl bg-surface-2 p-5 text-[13px] leading-6 text-ink-3">
                Ranking runs on the schema defaults. Every value below reflects those defaults;
                creating and activating a draft replaces them.
              </div>
            </Section>
          ) : null}

          {CONFIG_SECTIONS.map((section) => (
            <Section key={section.id} title={section.title}>
              <p className="mb-3 max-w-2xl text-[13px] leading-5 text-ink-4">{section.description}</p>
              <div className="space-y-4">
                {section.groups.map((group) => (
                  <div key={group.id} className="rounded-xl bg-surface-2 p-5">
                    <div className="mb-1 text-[13px] font-medium text-ink">{group.title}</div>
                    <div className="mb-3 text-xs text-ink-4">{group.description}</div>
                    <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                      {group.fields
                        .filter((field) => !field.advanced)
                        .map((field) => {
                          const value = getPath(liveConfig, field.path);
                          return (
                            <div key={field.path} className="flex items-baseline justify-between gap-3 text-[13px]">
                              <span className="min-w-0">
                                <span className="text-ink-2">{field.label}</span>
                                {field.unit ? (
                                  <span className="ml-1 text-[11px] text-ink-4">{field.unit}</span>
                                ) : null}
                              </span>
                              {field.boolean ? (
                                <Badge tone={value ? "brand" : "neutral"}>
                                  {value ? "on" : "off"}
                                </Badge>
                              ) : (
                                <span className="tnum font-medium text-ink">
                                  {typeof value === "number" ? value.toLocaleString() : String(value ?? "—")}
                                </span>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ))}
        </>
      ) : (
        <Section title="Raw JSON" note="advanced view — the structured editor is the primary interface">
          <pre className="max-h-[640px] overflow-auto rounded-xl bg-surface-2 p-5 font-mono text-[11.5px] leading-5 text-ink-2">
            {JSON.stringify(liveConfig, null, 2)}
          </pre>
        </Section>
      )}
    </div>
  );
}
