import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Null-embed regression tests — the 2026-09-09 production crash class.
 *
 * The backend's SQL builds `author` / `creator` / `post` embeds and
 * `actor_user_id` with correlated subqueries; when the identity or post row
 * is gone (system actor, permanently deleted profile) the value arrives as
 * `null`. Pages dereferenced them unguarded, so the page rendered its
 * loading state, the data landed, the re-render threw `TypeError: Cannot
 * read properties of null`, and the route error boundary replaced the whole
 * page — reported as "the page loads then disappears".
 *
 * The live `reco_config_audit` table contains two `actor_user_id IS NULL`
 * rows (the system's initial defaults creation/activation), which is what
 * made this intermittent in production: the crash only fires when those
 * rows are inside the fetched page.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/audit',
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api/queries', () => ({
  useAuditLog: vi.fn(),
}));

import AuditPage from '@/app/(admin)/audit/page';
import { useAuditLog } from '@/lib/api/queries';
import { identityHandle, identityName, identityKey } from '@/types';

const emptyQuery = {
  data: undefined,
  isLoading: false,
  error: null as unknown,
  refetch: vi.fn(),
};

describe('Audit page — null actor rows (production crash regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders system-actor rows without crashing', () => {
    vi.mocked(useAuditLog).mockReturnValue({
      ...emptyQuery,
      data: [
        {
          id: 'sys-1',
          version_id: null,
          action: 'create',
          actor_user_id: null,
          before_state: null,
          after_state: null,
          note: 'Initial Phase 1 defaults — every value from the schema defaults.',
          created_at: '2026-09-06T09:59:38.674536+00',
        },
        {
          id: 'usr-1',
          version_id: null,
          action: 'activate',
          actor_user_id: 'ef66b1e5-fad9-4a78-9854-75c2b1c2981c',
          before_state: null,
          after_state: null,
          note: 'initial activation',
          created_at: '2026-09-06T09:59:38.674536+00',
        },
      ],
    } as unknown as ReturnType<typeof useAuditLog>);

    render(<AuditPage />);
    expect(screen.getByText('system')).toBeInTheDocument();
    expect(screen.getByText('ef66b1e5')).toBeInTheDocument();
  });

  it('renders an entirely system-actor page (the exact live-data shape)', () => {
    vi.mocked(useAuditLog).mockReturnValue({
      ...emptyQuery,
      data: [
        {
          id: 'sys-1',
          version_id: null,
          action: 'create',
          actor_user_id: null,
          before_state: null,
          after_state: null,
          note: 'Initial Phase 1 defaults — every value from the schema defaults.',
          created_at: '2026-09-06T09:59:38.674536+00',
        },
      ],
    } as unknown as ReturnType<typeof useAuditLog>);

    render(<AuditPage />);
    expect(screen.getByText('system')).toBeInTheDocument();
  });
});

describe('identity embed helpers', () => {
  it('identityHandle degrades to @deleted instead of throwing', () => {
    expect(identityHandle(null)).toBe('@deleted');
    expect(identityHandle(undefined)).toBe('@deleted');
    expect(identityHandle({ id: '1', username: 'rahi', display_name: 'Rahi', kind: 'personal' })).toBe('@rahi');
  });

  it('identityName degrades to Deleted profile instead of throwing', () => {
    expect(identityName(null)).toBe('Deleted profile');
    expect(identityName(undefined)).toBe('Deleted profile');
    expect(identityName({ id: '1', username: 'rahi', display_name: 'Rahi', kind: 'personal' })).toBe('Rahi');
  });

  it('identityKey falls back to a stable key for list rendering', () => {
    expect(identityKey(null, 'creator-0')).toBe('creator-0');
    expect(identityKey(undefined, 'creator-1')).toBe('creator-1');
    expect(identityKey({ id: 'abc', username: 'rahi', display_name: 'Rahi', kind: 'personal' }, 'fallback')).toBe('abc');
  });
});
