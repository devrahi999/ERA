"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { X } from "lucide-react";

/* =============================================================================
   Interactive primitives — borderless. Hierarchy via fill, tone and text.
   ============================================================================= */

type ButtonVariant = "primary" | "tonal" | "ghost" | "danger";

export function Button({
  variant = "tonal",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
        variant === "primary" &&
          "bg-brand text-brand-ink hover:bg-brand-dim active:bg-brand-dim",
        variant === "tonal" &&
          "bg-surface-3 text-ink hover:bg-hover active:bg-hover",
        variant === "ghost" && "bg-transparent text-ink-2 hover:bg-surface-3 hover:text-ink",
        variant === "danger" && "bg-danger/15 text-danger hover:bg-danger/25",
        className,
      )}
    />
  );
}

/** StatusDot — the state indicator for Healthy/Offline/Draft etc. */
export function StatusDot({
  tone,
  label,
  pulse,
}: {
  tone: "live" | "ok" | "warn" | "danger" | "idle";
  label?: string;
  pulse?: boolean;
}) {
  const color =
    tone === "live" || tone === "ok"
      ? "bg-brand"
      : tone === "warn"
        ? "bg-warning"
        : tone === "danger"
          ? "bg-danger"
          : "bg-ink-4";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        {pulse ? (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", color)} />
        ) : null}
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", color)} />
      </span>
      {label ? <span className="text-xs font-medium text-ink-2">{label}</span> : null}
    </span>
  );
}

/** Badge — a small tonal label (source, kind, status). Never decorative-only. */
export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "brand" | "warning" | "danger" | "info";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-4",
        tone === "neutral" && "bg-surface-3 text-ink-2",
        tone === "brand" && "bg-brand/15 text-brand",
        tone === "warning" && "bg-warning/15 text-warning",
        tone === "danger" && "bg-danger/15 text-danger",
        tone === "info" && "bg-info/15 text-info",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Tabs — underline-style, keyboard-navigable, URL-state friendly. */
export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Array<{ id: string; label: string; count?: number }>;
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="-mx-1 flex items-center gap-1 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              isActive ? "bg-surface-3 text-ink" : "text-ink-3 hover:bg-surface-2 hover:text-ink-2",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" ? (
              <span className="tnum ml-1.5 text-[11px] text-ink-4">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- states */

export function LoadingState({ rows = 4, label }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label ?? "Loading"}>
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="h-9 animate-pulse rounded-lg bg-surface-2"
            style={{ animationDelay: `${i * 60}ms`, opacity: 1 - i * 0.12 }}
          />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="text-sm font-medium text-ink-2">{title}</div>
      {hint ? <div className="mt-1 max-w-sm text-xs text-ink-4">{hint}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Unable to load",
  detail,
  onRetry,
}: {
  title?: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="text-sm font-medium text-danger">{title}</div>
      {detail ? <div className="mt-1 max-w-md text-xs text-ink-4">{detail}</div> : null}
      {onRetry ? (
        <Button variant="tonal" size="sm" className="mt-4" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- dialog */

/**
 * Dialog — modal with role=dialog, aria-modal, Escape handling, focus trap
 * (initial focus + restore), and a click-outside dismiss.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel) {
        const focusables = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "relative w-full rounded-t-2xl bg-surface p-6 shadow-2xl sm:rounded-2xl",
          "max-h-[90vh] overflow-y-auto",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
            {description ? (
              <p className="mt-1 text-[13px] leading-5 text-ink-3">{description}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** ConfirmDialog — the mutation-safety primitive. Explains what changes. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  danger,
  busy,
  confirmDisabled,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onClose={busy ? () => undefined : onClose} title={title} description={description}>
      {children}
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          onClick={onConfirm}
          disabled={busy || confirmDisabled}
        >
          {busy ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
