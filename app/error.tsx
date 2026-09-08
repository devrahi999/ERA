"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * The route-segment error boundary. Without this file, any client-side render
 * failure falls through to Next's bare default screen ("This page couldn't
 * load"), which tells the operator nothing. Ours keeps the Control Center's
 * voice: what failed, and the two ways out.
 *
 * `reset` re-renders the segment; a hard reload is offered for the
 * stale-chunk case, where a redeploy has changed the JS hashes an open tab
 * still references — no amount of re-render fixes that, only a fresh document.
 * That case is also auto-recovered (once per 60s per tab) so a redeploy never
 * strands an open tab behind a manual "Reload" click.
 */

const STALE_CHUNK_RE =
  /dynamically imported module|Importing a module script failed|ChunkLoadError|Failed to fetch dynamically imported module/i;

const AUTO_RELOAD_KEY = "cc_stale_reload_at";
const AUTO_RELOAD_COOLDOWN_MS = 60_000;

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isStaleChunk = STALE_CHUNK_RE.test(error.message);

  useEffect(() => {
    // Surfaced in the browser console / Vercel log tail — never silently
    // swallowed. No secrets are logged; Next error digests are safe.
    console.error("[control-center] segment error", error.message, error.digest);
  }, [error]);

  useEffect(() => {
    if (!isStaleChunk) return;
    // One hard reload per cooldown window per tab. A stale chunk is a
    // deployment-boundary artifact, not a code bug — a fresh document always
    // fixes it. The cooldown makes a reload loop impossible: if the error
    // survives the reload, this guard is already spent and the screen below
    // takes over.
    try {
      const last = Number(window.sessionStorage.getItem(AUTO_RELOAD_KEY)) || 0;
      if (Date.now() - last > AUTO_RELOAD_COOLDOWN_MS) {
        window.sessionStorage.setItem(AUTO_RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      // sessionStorage unavailable (private mode): fall through to the manual screen.
    }
  }, [isStaleChunk]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16 text-center">
      <div className="text-[13px] font-medium uppercase tracking-[0.1em] text-ink-4">
        {isStaleChunk ? "Deployment changed" : "This page couldn't load"}
      </div>
      <p className="mt-2 max-w-md text-[15px] font-medium text-ink">
        {isStaleChunk
          ? "The console was updated and this tab is holding an outdated copy."
          : "Something failed while rendering this page."}
      </p>
      <p className="mt-1 max-w-md text-[13px] leading-5 text-ink-3">
        {isStaleChunk
          ? "Reload once to pick up the current build — your session is kept."
          : "The rest of the Control Center is still available; retrying re-runs the page."}
      </p>
      <div className="mt-6 flex items-center gap-2">
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-dim"
        >
          Reload
        </button>
        <button
          onClick={reset}
          className="rounded-lg bg-surface-3 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-hover"
        >
          Try again
        </button>
        <Link
          href="/overview"
          className="rounded-lg px-4 py-2 text-sm font-medium text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
        >
          Back
        </Link>
      </div>
      {error.digest ? (
        <div className="mt-6 font-mono text-[11px] text-ink-4">digest {error.digest}</div>
      ) : null}
    </div>
  );
}
