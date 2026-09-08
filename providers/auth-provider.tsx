"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@/types";
import { useRouter, usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

const USER_CACHE_KEY = "esporta_admin_user";

/**
 * A pure display cache for the operator's name/email — never an auth source.
 * Always null-safe: a missing, malformed, or `"undefined"` string yields null
 * instead of throwing, and never reaches JSON.parse unguarded.
 */
function readCachedUser(): User | null {
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY);
    if (!raw || raw === "undefined" || raw === "null") return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof parsed.id !== "string") return null;
    return parsed as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      // The auth source of truth is the server session, not localStorage: the
      // proxy attaches the HttpOnly cookie as the bearer header, so /auth/me
      // answers with the identity the backend itself has verified. A cached
      // user (if any) renders immediately, then this confirms or replaces it.
      const cached = readCachedUser();
      if (cached && !cancelled) {
        setUser(cached);
        setLoading(false);
      }

      try {
        const res = await fetch("/api/v1/auth/me", { credentials: "same-origin" });
        if (res.ok) {
          const body = await res.json();
          const me = body && typeof body === "object" && body.data ? body.data : body;
          if (me && typeof me === "object" && typeof me.user?.id === "string") {
            const verified: User = {
              id: me.user.id,
              email: me.user.email ?? cached?.email ?? "",
              role: me.user.role ?? cached?.role ?? "",
              capabilities: cached?.capabilities ?? [],
            };
            if (!cancelled) {
              setUser(verified);
              try {
                window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(verified));
              } catch {
                // Cache is cosmetic; failing to write it is not an error.
              }
              setLoading(false);
            }
            return;
          }
        }
        // 401/no valid session: the cookie is gone or expired. Clear any stale
        // cache so the UI cannot render a ghost "authenticated" state.
        if (!cancelled) {
          try {
            window.localStorage.removeItem(USER_CACHE_KEY);
          } catch {
            // See above — the cache is optional.
          }
          setUser(null);
        }
      } catch {
        // Backend unreachable on init: keep the cached user (if any) rather
        // than bouncing a signed-in operator. With no cache either, the
        // route guard below sends them to /login.
        if (!cancelled && !cached) {
          setUser(null);
        }
      }
      if (!cancelled) setLoading(false);
    };

    initAuth();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = (user: User) => {
    try {
      window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
    } catch {
      // Cache is cosmetic; the HttpOnly cookie is the real session.
    }
    setUser(user);
    router.push("/overview");
  };

  const logout = async () => {
    try {
      window.localStorage.removeItem(USER_CACHE_KEY);
    } catch {
      // See above.
    }
    await logoutAction();
    setUser(null);
    router.push("/login");
  };

  useEffect(() => {
    // Only guard once initialization has finished: guarding during `loading`
    // is what turns a slow /auth/me into a redirect→reload→redirect loop.
    if (!loading && !user && pathname !== "/login" && pathname !== "/unauthorized") {
      router.push("/login");
    }
  }, [user, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
