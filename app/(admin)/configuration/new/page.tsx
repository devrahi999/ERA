"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader, Section } from "@/components/ui/primitives";
import { Button, ConfirmDialog, Tabs } from "@/components/ui/interactive";
import {
  useConfigHistory,
  useConfigVersion,
  useCreateDraft,
  useOverview,
  useValidateConfig,
} from "@/lib/api/queries";
import { CONFIG_SECTIONS, getPath, setPath, type FieldSpec } from "@/lib/config/catalog";
import { compareConfigs } from "@/lib/utils/diff";

import type { ConfigValidationIssue } from "@/types";

/* =============================================================================
   Draft editor — clone a source version (or the defaults), edit with bounded
   sliders, validate against the backend schema, diff against live, then save
   as a DRAFT. Activation is a separate, separately-confirmed step.
   ============================================================================= */

export default function NewConfigPage() {
  const router = useRouter();
  const overview = useOverview();
  const history = useConfigHistory(50);

  const [sourceId, setSourceId] = useState<string>("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState("editor");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);

  const activeVersionId = overview.data?.activeVersion?.id;
  const activeIsReal = activeVersionId && !overview.data?.activeVersion?.fallback;
  const liveVersion = useConfigVersion(activeIsReal ? activeVersionId : null);
  const sourceVersion = useConfigVersion(sourceId || null);

  const sourceConfig = useMemo<Record<string, unknown>>(() => {
    if (sourceId && sourceVersion.data?.config) {
      return sourceVersion.data.config as Record<string, unknown>;
    }
    if (liveVersion.data?.config) {
      return liveVersion.data.config as Record<string, unknown>;
    }
    // Defaults come from validation of an empty doc once loaded; until then,
    // editing is disabled.
    return draft ?? {};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceVersion.data, liveVersion.data, sourceId]);

  const effectiveDraft = draft ?? sourceConfig;
  const validate = useValidateConfig();
  const createDraft = useCreateDraft();

  const validationIssues: ConfigValidationIssue[] =
    validate.data && !validate.data.valid ? validate.data.issues : [];
  const diffs = useMemo(
    () =>
      compareConfigs(
        (liveVersion.data?.config ?? {}) as Record<string, unknown>,
        effectiveDraft,
      ),
    [liveVersion.data, effectiveDraft],
  );

  const hasEdits = diffs.length > 0;
  const canSave = label.trim().length > 0 && hasEdits && (validate.data?.valid ?? false);

  const updateField = (field: FieldSpec, value: number | boolean) => {
    const next = setPath(effectiveDraft, field.path, value);
    setDraft(next);
    validate.reset();
  };

  const runValidation = () => {
    validate.mutate(effectiveDraft);
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Create draft configuration"
        meta="Clone a version, tune with bounded controls, validate, compare — then save as a draft"
        actions={
          <Link href="/configuration">
            <Button variant="ghost">Back</Button>
          </Link>
        }
      />

      {/* Source + label */}
      <div className="grid grid-cols-1 gap-4 rounded-xl bg-surface-2 p-5 sm:grid-cols-3">
        <label className="text-xs text-ink-3">
          Clone from
          <select
            value={sourceId}
            onChange={(e) => {
              setSourceId(e.target.value);
              setDraft(null);
            }}
            className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
          >
            <option value="">{activeIsReal ? "Live version" : "Built-in defaults"}</option>
            {(history.data ?? []).map((version) => (
              <option key={version.id} value={version.id}>
                {version.version_label} ({version.status})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-3">
          Draft label (required)
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. v1.1 — more exploration"
            className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-4 focus-visible:outline-2 focus-visible:outline-brand"
          />
        </label>
        <label className="text-xs text-ink-3">
          Notes (audited)
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="why this change"
            className="mt-1 w-full rounded-lg bg-surface-3 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-4 focus-visible:outline-2 focus-visible:outline-brand"
          />
        </label>
      </div>

      <Tabs
        tabs={[
          { id: "editor", label: "Editor" },
          { id: "diff", label: "Diff", count: diffs.length },
          { id: "validation", label: "Validation", count: validationIssues.length || undefined },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "editor" ? (
        <>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-ink-3">
              <input
                type="checkbox"
                checked={showAdvanced}
                onChange={(e) => setShowAdvanced(e.target.checked)}
                className="accent-brand"
              />
              Show advanced fields
            </label>
            <span className="text-xs text-ink-4">
              {hasEdits ? `${diffs.length} change${diffs.length > 1 ? "s" : ""} vs live` : "no changes yet"}
            </span>
          </div>

          {CONFIG_SECTIONS.map((section) => (
            <Section key={section.id} title={section.title}>
              <p className="mb-3 max-w-2xl text-[13px] leading-5 text-ink-4">{section.description}</p>
              <div className="space-y-4">
                {section.groups.map((group) => {
                  const visible = group.fields.filter(
                    (field) => showAdvanced || !field.advanced,
                  );
                  if (visible.length === 0) return null;
                  return (
                    <div key={group.id} className="rounded-xl bg-surface-2 p-5">
                      <div className="mb-1 text-[13px] font-medium text-ink">{group.title}</div>
                      <div className="mb-4 text-xs text-ink-4">{group.description}</div>
                      <div className="grid grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-2">
                        {visible.map((field) => (
                          <FieldControl
                            key={field.path}
                            field={field}
                            value={getPath(effectiveDraft, field.path)}
                            liveValue={getPath(liveVersion.data?.config ?? {}, field.path)}
                            onChange={(value) => updateField(field, value)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          ))}
        </>
      ) : null}

      {tab === "diff" ? (
        <Section title="Changes vs live" note="structured diff — raw JSON available per version">
          {diffs.length === 0 ? (
            <div className="rounded-xl bg-surface-2 px-4 py-10 text-center text-sm text-ink-4">
              No changes yet — move a control in the editor.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl bg-surface-2">
              {diffs.map((diff) => (
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
                    <span className={diff.type === "removed" ? "text-danger" : "font-medium text-brand"}>
                      {typeof diff.newVal === "number" ? diff.newVal.toLocaleString() : String(diff.newVal)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      ) : null}

      {tab === "validation" ? (
        <Section title="Schema validation" note="runs the SAME zod schema the backend enforces">
          <div className="rounded-xl bg-surface-2 p-5">
            {validate.isPending ? (
              <div className="text-sm text-ink-4">Validating…</div>
            ) : !validate.data ? (
              <div className="text-sm text-ink-4">Run validation to check the draft against the schema bounds.</div>
            ) : validate.data.valid ? (
              <div className="text-sm text-brand">
                Valid — every field is inside its schema bounds. The draft can be saved.
              </div>
            ) : (
              <div className="space-y-2">
                {validationIssues.map((issue) => (
                  <div key={`${issue.path}-${issue.message}`} className="text-sm text-danger">
                    <span className="font-mono text-[12px] text-ink-3">{issue.path}</span>{" "}
                    {issue.message}
                  </div>
                ))}
              </div>
            )}
            <Button variant="tonal" className="mt-4" onClick={runValidation} disabled={validate.isPending}>
              Run validation
            </Button>
          </div>
        </Section>
      ) : null}

      {/* Action bar */}
      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 p-4 shadow-lg">
        <div className="text-xs text-ink-4">
          {hasEdits
            ? `${diffs.length} pending change${diffs.length > 1 ? "s" : ""} · validation ${validate.data ? (validate.data.valid ? "passed" : "failed") : "not run"}`
            : "No changes yet"}
        </div>
        <div className="flex gap-2">
          <Button variant="tonal" onClick={runValidation} disabled={!hasEdits || validate.isPending}>
            Validate
          </Button>
          <Button variant="primary" disabled={!canSave} onClick={() => setConfirmSave(true)}>
            Save draft
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmSave}
        onClose={() => setConfirmSave(false)}
        onConfirm={() => {
          createDraft.mutate(
            { label: label.trim(), config: effectiveDraft, notes: notes.trim() || undefined },
            {
              onSuccess: () => {
                setConfirmSave(false);
                router.push("/configuration");
              },
            },
          );
        }}
        title="Save draft configuration"
        description={`"${label.trim()}" will be created as a DRAFT — nothing changes for users until it is separately activated.`}
        confirmLabel="Save draft"
        busy={createDraft.isPending}
      >
        <div className="rounded-lg bg-surface-3 p-3 text-xs text-ink-3">
          {diffs.length} change{diffs.length > 1 ? "s" : ""} vs live ·{" "}
          {validate.data?.valid ? "validation passed" : "validation not run"}
          {notes.trim() ? ` · note: "${notes.trim()}"` : ""}
        </div>
      </ConfirmDialog>
    </div>
  );
}

/* --------------------------------------------------------------- the control */

function FieldControl({
  field,
  value,
  liveValue,
  onChange,
}: {
  field: FieldSpec;
  value: unknown;
  liveValue: unknown;
  onChange: (value: number | boolean) => void;
}) {
  const numeric = typeof value === "number" ? value : Number(field.min);
  const changed = value !== liveValue;

  if (field.boolean) {
    const on = value === true;
    return (
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[13px] font-medium text-ink">
            {field.label}
            {changed ? <span className="ml-1.5 text-[10px] text-brand">changed</span> : null}
          </div>
          <div className="text-xs text-ink-4">{field.description}</div>
        </div>
        <button
          role="switch"
          aria-checked={on}
          aria-label={field.label}
          onClick={() => onChange(!on)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-brand" : "bg-surface-3"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-page transition-all ${on ? "left-[18px]" : "left-0.5"}`}
          />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[13px] font-medium text-ink">
          {field.label}
          {field.unit ? <span className="ml-1 text-[11px] font-normal text-ink-4">{field.unit}</span> : null}
          {changed ? <span className="ml-1.5 text-[10px] text-brand">changed</span> : null}
        </div>
        <div className="flex items-baseline gap-2">
          {changed ? (
            <span className="tnum text-[11px] text-ink-4 line-through">
              {typeof liveValue === "number" ? liveValue.toLocaleString() : "—"}
            </span>
          ) : null}
          <input
            value={numeric}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              if (Number.isFinite(parsed)) onChange(parsed);
            }}
            inputMode="decimal"
            aria-label={`${field.label} numeric value`}
            className="tnum w-16 rounded-md bg-surface-3 px-2 py-0.5 text-right text-[13px] font-medium text-ink outline-none focus-visible:outline-2 focus-visible:outline-brand"
          />
        </div>
      </div>
      <input
        type="range"
        min={field.min}
        max={field.max}
        step={field.step}
        value={Math.min(field.max, Math.max(field.min, numeric))}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${field.label} slider`}
        className="mt-1.5 w-full accent-brand"
      />
      <div className="mt-1 flex justify-between text-[10.5px] text-ink-4">
        <span className="tnum">{field.min}</span>
        <span className="tnum">{field.max}</span>
      </div>
      <div className="mt-1.5 text-[11px] leading-4 text-ink-4">{field.impact}</div>
    </div>
  );
}
