import type { NextConfig } from 'next';
import { readdirSync, watch } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));

/**
 * Esporta Recommendation Control Center — Next.js configuration.
 *
 * `outputFileTracingRoot` / `turbopack.root` are pinned to this directory so
 * the build does not walk up to the Flutter repo root (which carries its own
 * package-lock.json) when inferring the workspace — that keeps a standalone
 * Vercel deploy with Root Directory = `recommendation-admin` self-contained.
 *
 * ## Development file watching
 *
 * Everything below `WATCH` exists for ONE reason: on this Termux/Android host
 * the kernel will not hand out enough inotify watches to run a webpack dev
 * server (`ENOSPC`), and the failure mode is misleading: the watcher escalates
 * to parent directories (`~/Esporta` → `~` → `/data/data` → `/data`, the last
 * two `EACCES`) and Next misreads the broken watcher as "the project directory
 * was deleted" and restarts in a loop. Production is untouched — the polling
 * branch is gated on the development-server phase, so `next build` and
 * `next start` behave exactly as before.
 */

// --------------------------------------------------------------------- WATCH

/** Poll interval used when inotify is unavailable. Overridable for tuning. */
const POLL_INTERVAL_MS = Math.max(250, Number(process.env.NEXT_WATCH_POLL_MS) || 1000);

/**
 * How many concurrent inotify watches a dev server needs before it stops
 * thrashing. A webpack dev server watches the project root, every source
 * directory, the config files and each resolution "missing" path — a dozen is
 * a floor, not a target. Anything under this and polling is the honest choice.
 */
const MIN_USABLE_WATCHES = 8;

/** Directories a probe can safely watch: real, inside the project, not build output. */
function probeTargets(limit: number): string[] {
  const skip = new Set(['node_modules', '.next', '.git', 'out', 'build']);
  const found: string[] = [projectRoot];
  const queue: string[] = [projectRoot];

  while (queue.length > 0 && found.length < limit) {
    const current = queue.shift() as string;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || skip.has(entry.name)) continue;
      const child = join(current, entry.name);
      found.push(child);
      queue.push(child);
      if (found.length >= limit) break;
    }
  }
  return found;
}

/**
 * Whether this host can actually give a dev server the inotify watches it needs.
 *
 * Probing beats guessing. `/proc/sys/fs/inotify/max_user_watches` is not
 * readable on Android, and platform sniffing would miss the same failure
 * inside a constrained container. So we ask the kernel directly: open real
 * watches on real directories, count how many survive, close them all.
 *
 * The critical detail is that ONE watch succeeding proves nothing — on the
 * Termux/Android host this console is developed on, the budget is exactly one.
 * A naive `fs.watch(root)` smoke test passes there and the dev server still
 * collapses, which is why the bar is {@link MIN_USABLE_WATCHES}.
 */
function inotifyBudgetIsUsable(): boolean {
  const targets = probeTargets(MIN_USABLE_WATCHES);
  if (targets.length < MIN_USABLE_WATCHES) return true;

  const open: Array<{ close: () => void }> = [];
  try {
    for (const target of targets) {
      open.push(watch(target, { persistent: false }, () => {}));
    }
    return true;
  } catch {
    return false;
  } finally {
    for (const handle of open) {
      try {
        handle.close();
      } catch {
        // A watcher that cannot be closed is already gone.
      }
    }
  }
}

/**
 * Decides the dev watch strategy.
 *
 * `NEXT_WATCH_POLL=1|0` forces it either way (useful in CI, or to reproduce a
 * host-specific bug); otherwise the inotify probe decides. Returns null when
 * native watching is fine, so hosts with a healthy inotify budget keep the fast
 * path and pay nothing for this file.
 */
function pollIntervalForDev(): number | null {
  const forced = process.env.NEXT_WATCH_POLL;
  if (forced === '0' || forced === 'false') return null;
  if (forced === '1' || forced === 'true') return POLL_INTERVAL_MS;
  return inotifyBudgetIsUsable() ? null : POLL_INTERVAL_MS;
}

/**
 * Anything outside this project directory. Used to bound the dev watcher so a
 * resolution miss cannot pull `~/Esporta`, `~`, or `/data` into the watch set.
 */
const OUTSIDE_PROJECT = new RegExp(
  `^(?!${projectRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|/))`,
);

// -------------------------------------------------------------------- CONFIG

/**
 * Next's own value for the dev-server phase. Inlined rather than imported from
 * `next/constants`, which has no ESM subpath export — importing it makes the
 * compiled config fail to load with `ERR_MODULE_NOT_FOUND`.
 */
const PHASE_DEVELOPMENT_SERVER = 'phase-development-server';

export default function config(phase: string): NextConfig {
  const isDevServer = phase === PHASE_DEVELOPMENT_SERVER;
  const pollMs = isDevServer ? pollIntervalForDev() : null;

  /**
   * Watchpack reads `WATCHPACK_POLLING` at module load and applies it to EVERY
   * watcher in the process, including the one `next dev` creates for itself to
   * notice `next.config.ts` changing or the project directory disappearing.
   * `watchOptions.pollIntervalMs` below only reaches the webpack compiler's
   * watcher, and that internal one is precisely the watcher whose failure
   * produces the bogus "the directory was deleted" restart loop — so the env
   * var is the lever that has to be pulled, and it has to be pulled here,
   * before the dev server requires watchpack.
   */
  if (pollMs !== null && !process.env.WATCHPACK_POLLING) {
    process.env.WATCHPACK_POLLING = String(pollMs);
  }

  return {
    outputFileTracingRoot: projectRoot,
    turbopack: { root: projectRoot },

    /**
     * Next 16's dev server logs every Server Function invocation with its
     * stringified arguments — including loginAction("email", "password") —
     * and offers no redaction hook. Auth credentials must never reach the
     * terminal, so function-invocation logging is disabled outright; the route
     * log lines (method, path, status, duration) remain available.
     */
    logging: {
      serverFunctions: false,
      browserToTerminal: false,
    },

    // Only set in development, and only when the probe says inotify cannot cope.
    // In production this is undefined and Next's defaults apply untouched.
    ...(pollMs !== null ? { watchOptions: { pollIntervalMs: pollMs } } : {}),

    /**
     * Bound the dev watch set to this directory.
     *
     * Next already ignores `node_modules`, `.git` and `.next`. What it does not
     * ignore is the long tail of NON-EXISTENT paths webpack records while
     * resolving a bare import — every `node_modules` candidate from here up to
     * `/`. Watchpack answers a missing path by watching its nearest existing
     * ancestor, so those turn into watches on `~/Esporta`, `~`, `/data/data`
     * (EACCES on Android) and `/`. Excluding everything outside the project
     * root keeps development watching where it belongs.
     *
     * webpack's schema accepts `ignored` as ONE RegExp, or a list of glob
     * strings — never a mixed list. Next's default is a RegExp, so the two are
     * merged by alternation. Dev-only: `next build` does not watch, and a build
     * must never have its dependency graph narrowed by a watch filter.
     */
    webpack(webpackConfig, { dev }) {
      if (!dev) return webpackConfig;

      const existing = webpackConfig.watchOptions?.ignored;
      if (existing !== undefined && !(existing instanceof RegExp)) return webpackConfig;

      const ignored =
        existing instanceof RegExp
          ? new RegExp(`(?:${existing.source})|(?:${OUTSIDE_PROJECT.source})`)
          : OUTSIDE_PROJECT;

      webpackConfig.watchOptions = { ...webpackConfig.watchOptions, ignored };
      return webpackConfig;
    },
  };
}
