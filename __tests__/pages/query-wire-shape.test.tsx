/**
 * Wire-shape regression tests — the 2026-09-10 delayed-crash class.
 *
 * The backend wraps every response in `{success, data}` (handled by
 * `fetchApi`), but several of ITS paged endpoints add a SECOND wrapper:
 * `/config/history` and `/audit` return `{items: [...]}`, while
 * `/experiments` returns a bare array and `/users` returns `{rows, total}`.
 *
 * `useConfigHistory`/`useAuditLog` were typed as bare arrays and returned the
 * `{items}` object untouched — so `/configuration`, `/ranking-lab`,
 * `/experiments` and `/audit` rendered their loading state, the query resolved
 * ~1s later, and the re-render called `.map`/`.filter` on the wrapper object:
 * `TypeError: ... is not a function`, page replaced by the error screen.
 *
 * The page-level vitest suites mock these hooks with arrays, which is exactly
 * why 45/45 passed while production crashed: nothing ever exercised the real
 * unwrapping. These tests mock `fetchApi` at the transport and pin the unwrap.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';

import type { ReactNode } from 'react';

vi.mock('@/lib/api/client', () => ({
  ApiError: class extends Error {},
  fetchApi: vi.fn(),
}));

import { fetchApi } from '@/lib/api/client';
import { useAuditLog, useConfigHistory } from '@/lib/api/queries';

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};

describe('useConfigHistory — the backend pages as {items}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the items array, not the wrapper object', async () => {
    (fetchApi as Mock).mockResolvedValue({
      items: [
        {
          id: 'v1',
          label: 'v1-initial',
          status: 'active',
          config: {},
          created_at: '2026-09-06T09:59:38Z',
          created_by: 'system',
        },
      ],
    });

    const { result } = renderHook(() => useConfigHistory(50, 0), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The hook's contract is "the versions" — an array every call site can
    // map/filter. This is the assertion that was missing when the pages
    // crashed in production with tests green.
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].id).toBe('v1');
  });

  it('a missing items list degrades to empty, never crashes the page', async () => {
    (fetchApi as Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useConfigHistory(50, 0), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data).toHaveLength(0);
  });
});

describe('useAuditLog — same {items} wire shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the items array, not the wrapper object', async () => {
    (fetchApi as Mock).mockResolvedValue({
      items: [
        {
          id: 'a1',
          version_id: null,
          action: 'create',
          actor_user_id: null,
          before_state: null,
          after_state: null,
          note: 'Initial Phase 1 defaults',
          created_at: '2026-09-06T09:59:38Z',
        },
      ],
    });

    const { result } = renderHook(() => useAuditLog(50, 0), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].action).toBe('create');
  });

  it('a missing items list degrades to empty, never crashes the page', async () => {
    (fetchApi as Mock).mockResolvedValue({});

    const { result } = renderHook(() => useAuditLog(50, 0), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data).toHaveLength(0);
  });
});
