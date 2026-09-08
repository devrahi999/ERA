"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  LayoutGrid,
  Newspaper,
  Film,
  Search,
  FileText,
  Users,
  Fingerprint,
  Settings2,
  FlaskConical,
  GitCompare,
  ShieldAlert,
  TrendingUp,
  Gauge,
  ClipboardList,
  Server,
  Bug,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  CircleCheck,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/providers/auth-provider";
import { fetchApi } from "@/lib/api/client";
import type { OverviewResponse } from "@/types";
import { timeAgo } from "@/lib/formatters/format";

/* =============================================================================
   The application shell: sidebar (collapsible, drawer on mobile) + topbar
   (active version, health, theme, admin identity). No decorative borders —
   separation via surfaces and dividers only.
   ============================================================================= */

interface NavEntry {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  entries: NavEntry[];
}

const NAV: NavGroup[] = [
  {
    label: "Monitor",
    entries: [
      { href: "/overview", label: "Overview", icon: LayoutGrid },
      { href: "/feed", label: "Feed", icon: Newspaper },
      { href: "/shorts", label: "Shorts", icon: Film },
      { href: "/search-analytics", label: "Search", icon: Search },
      { href: "/content", label: "Content", icon: FileText },
      { href: "/users", label: "Users", icon: Users },
      { href: "/identities", label: "Identities", icon: Fingerprint },
    ],
  },
  {
    label: "Control",
    entries: [
      { href: "/configuration", label: "Configuration", icon: Settings2 },
      { href: "/ranking-lab", label: "Ranking Lab", icon: FlaskConical },
      { href: "/experiments", label: "Experiments", icon: GitCompare },
      { href: "/interventions", label: "Interventions", icon: ShieldAlert },
    ],
  },
  {
    label: "Analytics",
    entries: [
      { href: "/analytics/exposure", label: "Exposure", icon: TrendingUp },
      { href: "/analytics/performance", label: "Performance", icon: Gauge },
      { href: "/analytics/health", label: "Health", icon: Activity },
    ],
  },
  {
    label: "System",
    entries: [
      { href: "/debugger", label: "Debugger", icon: Bug },
      { href: "/audit", label: "Audit", icon: ClipboardList },
      { href: "/system", label: "System", icon: Server },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const { data: overview, isLoading: overviewLoading, error: overviewError } = useQuery({
    queryKey: ["reco", "overview"],
    queryFn: () => fetchApi<OverviewResponse>("/admin/recommendations/overview"),
    staleTime: 30_000,
    retry: 2,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    try {
      setCollapsed(window.localStorage.getItem("rc-sidebar-collapsed") === "1");
    } catch {
      /* private mode — default expanded */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem("rc-sidebar-collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  if (!user) return null;

  const activeLabel = overview?.activeVersion?.label;
  const isFallback = overview?.activeVersion?.fallback;

  return (
    <div className="min-h-screen bg-page">
      {/* Mobile drawer backdrop */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col bg-surface transition-[width,transform] duration-200 ease-out",
          collapsed ? "w-[68px]" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
        aria-label="Primary navigation"
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
          <Image src="/logo.jpg" alt="" width={28} height={28} className="h-7 w-7 rounded-md object-contain" />
          {!collapsed ? (
            <div className="min-w-0 leading-tight">
              <div className="text-[15px] font-semibold tracking-tight text-ink">Esporta</div>
              <div className="truncate text-[10.5px] font-medium uppercase tracking-[0.1em] text-ink-4">
                Recommendation Control
              </div>
            </div>
          ) : null}
          <button
            className="ml-auto rounded-lg p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed ? (
                <div className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-4">
                  {group.label}
                </div>
              ) : (
                <div className="mx-3 mb-2 h-px bg-line" aria-hidden="true" />
              )}
              <ul className="space-y-0.5">
                {group.entries.map((entry) => {
                  const active =
                    pathname === entry.href ||
                    (pathname.startsWith(`${entry.href}/`) && entry.href !== "/overview");
                  const Icon = entry.icon;
                  return (
                    <li key={entry.href}>
                      <Link
                        href={entry.href}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? entry.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                          active
                            ? "bg-brand/15 text-brand"
                            : "text-ink-2 hover:bg-surface-3 hover:text-ink",
                          collapsed && "justify-center px-0",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {!collapsed ? entry.label : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="hidden shrink-0 px-2 pb-3 lg:block">
          <button
            onClick={toggleCollapsed}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-ink-4 transition-colors hover:bg-surface-3 hover:text-ink-2"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="mx-auto h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[padding] duration-200 ease-out",
          collapsed ? "lg:pl-[68px]" : "lg:pl-60",
        )}
      >
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-page/90 px-4 backdrop-blur sm:px-6">
          <button
            className="rounded-lg p-2 text-ink-3 hover:bg-surface-3 hover:text-ink lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>

          {/* Active version — clickable through to configuration */}
          <Link
            href="/configuration"
            className="flex min-w-0 items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-[12.5px] transition-colors hover:bg-surface-3"
            title="Active recommendation configuration"
          >
            {overviewError ? (
              <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden="true" />
            ) : isFallback ? (
              <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
            ) : (
              <CircleCheck className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
            )}
            <span className="hidden text-ink-4 sm:inline">Config</span>
            <span className="truncate font-mono text-[12px] font-medium text-ink">
              {overviewLoading ? "…" : (activeLabel ?? "defaults")}
            </span>
            {isFallback ? (
              <span className="hidden text-warning md:inline">defaults active</span>
            ) : null}
          </Link>

          {/* Environment */}
          <span className="hidden items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-[12.5px] text-ink-3 md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />
            Production
          </span>

          <div className="ml-auto flex items-center gap-1.5">
            {mounted ? (
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
                aria-label="Toggle color theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            ) : (
              <span className="h-9 w-9" />
            )}
            <div className="mx-1 hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-[13px] font-medium text-ink">Super Admin</div>
              <div className="text-[11px] text-ink-4">{user.email || "Admin"}</div>
            </div>
            <button
              onClick={logout}
              className="rounded-lg p-2 text-ink-3 transition-colors hover:bg-danger/15 hover:text-danger"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Last-change strip — quiet, below the topbar */}
        <div className="px-4 pb-1 pt-0.5 sm:px-6">
          <div className="flex items-center gap-2 text-[11px] text-ink-4">
            {overview?.featureFreshness?.user?.last_computed_at ? (
              <>
                <span>Feature rebuild {timeAgo(overview.featureFreshness.user.last_computed_at)}</span>
                <span aria-hidden="true">·</span>
              </>
            ) : null}
            {overviewError ? (
              <span className="text-danger">Backend unreachable — showing cached state</span>
            ) : (
              <span>{overviewLoading ? "Connecting…" : "Engine healthy"}</span>
            )}
          </div>
        </div>

        <main className="page-in mx-auto w-full max-w-[1200px] flex-1 px-4 pb-16 pt-4 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
