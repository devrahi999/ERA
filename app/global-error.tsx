"use client";

import { useEffect } from "react";

/**
 * The last-resort boundary: fires when the ROOT layout itself fails, which
 * app/error.tsx cannot catch (Next mounts global-error in place of the whole
 * app). Root-layout failures include a font/style chunk that no longer exists
 * after a redeploy — the exact way an open tab degrades into Next's default
 * "This page couldn't load" screen.
 *
 * This file renders OUTSIDE the app tree, so Tailwind classes and the Geist
 * font are not guaranteed — everything is inline-styled and self-contained,
 * in the Control Center's palette: near-black page, charcoal surfaces, the
 * one brand green. No borders, tonal separation only.
 */

const STALE_CHUNK_RE =
  /dynamically imported module|Importing a module script failed|ChunkLoadError|Failed to fetch dynamically imported module/i;

const AUTO_RELOAD_KEY = "cc_root_reload_at";
const AUTO_RELOAD_COOLDOWN_MS = 60_000;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isStaleChunk = STALE_CHUNK_RE.test(error.message);

  useEffect(() => {
    console.error("[control-center] root error", error.message, error.digest);
  }, [error]);

  useEffect(() => {
    if (!isStaleChunk) return;
    // Same cooldown contract as app/error.tsx, under a separate key: one
    // automatic hard reload per 60s per tab, then the manual screen.
    try {
      const last = Number(window.sessionStorage.getItem(AUTO_RELOAD_KEY)) || 0;
      if (Date.now() - last > AUTO_RELOAD_COOLDOWN_MS) {
        window.sessionStorage.setItem(AUTO_RELOAD_KEY, String(Date.now()));
        window.location.reload();
      }
    } catch {
      // sessionStorage unavailable (private mode): manual screen below.
    }
  }, [isStaleChunk]);

  const surface = { background: "#121613" };
  const ink = { color: "#f2f5f3" };
  const ink2 = { color: "#b8c2bd" };
  const ink3 = { color: "#7d8a83" };

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#0a0d0b",
          color: "#f2f5f3",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          WebkitFontSmoothing: "antialiased",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <div
            style={{
              ...ink3,
              fontSize: 13,
              fontWeight: 600,
              textTransform: "uppercase" as const,
              letterSpacing: "0.1em",
            }}
          >
            {isStaleChunk ? "Deployment changed" : "The console couldn't start"}
          </div>
          <p style={{ ...ink, margin: "8px 0 0", fontSize: 15, fontWeight: 600 }}>
            {isStaleChunk
              ? "This tab is holding a copy from before the last update."
              : "A root component failed while loading the application."}
          </p>
          <p style={{ ...ink2, margin: "4px 0 0", fontSize: 13, lineHeight: "20px" }}>
            {isStaleChunk
              ? "Reload once to pick up the current build — your session is kept."
              : "Reloading restarts the application with a clean document."}
          </p>
          <div style={{ marginTop: 24, display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                ...surface,
                borderRadius: 8,
                padding: "9px 16px",
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                color: "#04140a",
                background: "#20cc01",
                cursor: "pointer",
              }}
            >
              Reload
            </button>
            <button
              onClick={reset}
              style={{
                ...surface,
                borderRadius: 8,
                padding: "9px 16px",
                border: "none",
                fontSize: 14,
                fontWeight: 600,
                ...ink,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
          {error.digest ? (
            <div style={{ ...ink3, marginTop: 24, fontFamily: "ui-monospace, monospace", fontSize: 11 }}>
              digest {error.digest}
            </div>
          ) : null}
        </div>
      </body>
    </html>
  );
}
