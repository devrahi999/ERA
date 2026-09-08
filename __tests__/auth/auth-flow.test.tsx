import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/**
 * Regression tests for the admin-auth flow fixed 2026-09-07.
 *
 * The backend wraps every response in `{ success, data, error, meta }`
 * (esporta-backend's global ResponseInterceptor). The old loginAction read
 * `access_token` from the envelope's top level — so every login "succeeded"
 * with an undefined token, the session cookie was set to garbage, and
 * AuthProvider's JSON.parse(localStorage) crashed on the literal string
 * "undefined". These tests pin the corrected contract.
 */

// --- recommendation-admin loginAction -------------------------------------
describe('loginAction (recommendation-admin)', () => {
  const cookieStore = new Map<string, string>();

  beforeEach(() => {
    cookieStore.clear();
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  async function loadAction() {
    vi.doMock('next/headers', () => ({
      cookies: vi.fn(async () => ({
        set: (name: string, value: string) => cookieStore.set(name, value),
        delete: (name: string) => cookieStore.delete(name),
      })),
    }));
    const mod = await import('../../app/login/actions');
    return mod.loginAction;
  }

  function mockLoginOnce({ status = 201, body }: { status?: number; body: unknown }) {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status }),
    );
  }

  it('unwraps the {success,data} envelope and sets the cookie to the real access_token', async () => {
    mockLoginOnce({
      body: {
        success: true,
        data: {
          access_token: 'real-token-value',
          refresh_token: 'rt',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: { id: 'u1', email: 'admin@esporta.com', role: 'authenticated' },
        },
      },
    });
    // /auth/me verification call
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, data: { user: { id: 'u1', email: 'admin@esporta.com', role: 'admin' } } }), { status: 200 }),
    );

    const loginAction = await loadAction();
    const result = await loginAction('admin@esporta.com', 'correct-password');

    expect(result.error).toBeUndefined();
    expect(result.user?.id).toBe('u1');
    expect(cookieStore.get('esporta_admin_token')).toBe('real-token-value');
    // The token must never leak back to the client through the return value.
    expect(JSON.stringify(result)).not.toContain('real-token-value');
  });

  it('rejects credentials when the backend answers success:false inside a 200/201 envelope', async () => {
    mockLoginOnce({
      status: 200,
      body: { success: false, error: { code: 'auth/invalid-credentials', message: 'Invalid login credentials' } },
    });

    const loginAction = await loadAction();
    const result = await loginAction('admin@esporta.com', 'wrong-password');

    expect(result.user).toBeUndefined();
    expect(result.error).toBe('Invalid login credentials');
    expect(cookieStore.has('esporta_admin_token')).toBe(false);
  });

  it('never stores anything when the response has no data envelope', async () => {
    mockLoginOnce({ status: 401, body: { success: false, error: { message: 'Invalid login credentials' } } });

    const loginAction = await loadAction();
    await loginAction('x@esporta.com', 'y');
    expect(cookieStore.has('esporta_admin_token')).toBe(false);
  });
});

// --- AuthProvider's cached-user guard -------------------------------------
describe('readCachedUser guard (auth-provider)', () => {
  const originalEnv = process.env.NODE_ENV;
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    window.localStorage.clear();
  });

  it('treats the legacy "undefined" cache as absent instead of throwing SyntaxError', async () => {
    window.localStorage.setItem('esporta_admin_user', 'undefined');
    // The pre-fix code did JSON.parse("undefined") here and crashed with:
    //   SyntaxError: "undefined" is not valid JSON
    const { AuthProvider, useAuth } = await import('../../providers/auth-provider');
    const { render, waitFor, act } = await import('@testing-library/react');

    let captured: { user: unknown; loading: boolean } | undefined;
    function Probe() {
      const auth = useAuth();
      captured = { user: auth.user, loading: auth.loading };
      return null;
    }
    await act(async () => {
      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });
    await waitFor(() => expect(captured?.loading).toBe(false));
    // No session cookie → the server session check fails → unauthenticated,
    // but NO crash: that is the regression this test pins.
    expect(captured?.user).toBeNull();
  });
});
