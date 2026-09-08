export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * The backend wraps every response in `{ success, data, error, meta }`
 * (esporta-backend's global ResponseInterceptor). This unwraps it once, here,
 * so every call site receives the payload directly.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrapEnvelope<T>(body: any): T | null {
  if (body && typeof body === 'object' && 'success' in body) {
    if (body.success === false) return null;
    return (body.data ?? null) as T | null;
  }
  return (body ?? null) as T | null;
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  // Fetch relatively so the Next.js proxy can inject the HttpOnly cookie token
  // as the Authorization header — the browser itself holds no token.
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1';

  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
    credentials: 'same-origin',
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { message: response.statusText };
    }
    // The session cookie died, expired, or was never valid: drop the stale
    // display cache and send the operator to sign in, instead of rendering a
    // console full of 401s. This is deliberately a hard navigation — every
    // in-memory page state must be discarded, not just the route.
    if (response.status === 401 && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('esporta_admin_user');
      } catch {
        // localStorage can be unavailable (private mode) — the redirect below
        // still restores a correct auth state.
      }
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign('/login');
    }
    throw new ApiError(
      response.status,
      errorData?.error?.message || errorData?.message || 'An error occurred',
      errorData
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  const body = await response.json().catch(() => null);
  const data = unwrapEnvelope<T>(body);
  if (data === null) {
    throw new ApiError(response.status, 'The backend returned no data.', body);
  }
  return data;
}
