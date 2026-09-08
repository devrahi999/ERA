'use server';

import { cookies } from 'next/headers';

const TOKEN_COOKIE = 'esporta_admin_token';

/** Shape of the backend's `{ success, data }` envelope (plan §30). */
interface Envelope<T> {
  success: boolean;
  data?: T | null;
  error?: { code?: string; message?: string } | null;
}

interface BackendSession {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  expires_in?: number;
  user?: {
    id: string;
    email?: string | null;
    role?: string | null;
  };
}

function backendUrl(path: string): string {
  const base = (process.env.ESPORTA_BACKEND_URL || 'https://private.esporta.site').replace(/\/$/, '');
  return `${base}/api/v1${path}`;
}

/**
 * Signs the operator in against the NestJS backend and keeps the access token
 * in one place only: an HttpOnly cookie the proxy forwards as a bearer header.
 * The browser never holds the token, and no token value ever crosses this
 * function's return boundary.
 */
export async function loginAction(
  email: string,
  password: string,
): Promise<{ error?: string; user?: { id: string; email: string; role: string } }> {
  try {
    const res = await fetch(backendUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const envelope = (await res.json().catch(() => null)) as Envelope<BackendSession> | null;

    if (!res.ok || !envelope || envelope.success === false || !envelope.data?.access_token) {
      return {
        error:
          envelope?.error?.message ||
          (res.ok ? 'Malformed login response.' : 'Invalid login credentials'),
      };
    }

    const session = envelope.data;
    const store = await cookies();

    // Align the cookie's lifetime with the token's: when expires_at is known,
    // the cookie dies with the session instead of outliving it by 7 days.
    const maxAge =
      typeof session.expires_at === 'number'
        ? Math.max(60, Math.floor(session.expires_at - Date.now() / 1000))
        : 60 * 60 * 24 * 7;

    store.set(TOKEN_COOKIE, session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge,
    });

    // The user is verified from the token itself, not from the client's input:
    // /auth/me proves the whole chain (JWT → user) before the client is told
    // login succeeded.
    try {
      const meRes = await fetch(backendUrl('/auth/me'), {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: 'no-store',
      });
      const meEnvelope = (await meRes.json().catch(() => null)) as Envelope<{
        user: { id: string; email?: string | null; role?: string | null };
      }> | null;
      const me = meEnvelope?.data?.user;
      if (meRes.ok && meEnvelope?.success !== false && me?.id) {
        return {
          user: {
            id: me.id,
            email: me.email ?? session.user?.email ?? '',
            role: me.role ?? session.user?.role ?? '',
          },
        };
      }
    } catch {
      // /auth/me is a verification nicety, not the login itself — fall back to
      // the user echoed by the login response.
    }

    if (session.user?.id) {
      return { user: { id: session.user.id, email: session.user.email ?? '', role: session.user.role ?? '' } };
    }
    return { error: 'Login succeeded but the account could not be verified.' };
  } catch {
    return { error: 'Failed to communicate with authentication server' };
  }
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(TOKEN_COOKIE);
}
