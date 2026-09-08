import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Overview page tests — the operations dashboard. Covers the spec's test
 * matrix: active config indicator, exposure metrics from the backend, empty
 * states (no recorded exposure), loading and backend-unavailable states.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/overview',
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api/queries', () => ({
  useOverview: vi.fn(),
  useExposureOverview: vi.fn(),
  useTopPosts: vi.fn(),
  useTopCreators: vi.fn(),
  useInterventions: vi.fn(),
}));

import OverviewPage from '@/app/(admin)/overview/page';
import {
  useOverview,
  useExposureOverview,
  useTopPosts,
  useTopCreators,
  useInterventions,
} from '@/lib/api/queries';

const emptyQuery = {
  data: undefined,
  isLoading: false,
  error: null as unknown,
  refetch: vi.fn(),
};

describe('Overview page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOverview).mockReturnValue({
      ...emptyQuery,
      data: {
        activeVersion: { id: 'v1', label: 'v1-initial', fallback: false },
        featureFreshness: { user: { rows: 9, last_computed_at: '2026-09-08T00:15:10Z' } },
      },
    } as unknown as ReturnType<typeof useOverview>);
    vi.mocked(useExposureOverview).mockReturnValue({
      ...emptyQuery,
      data: {
        from: '2026-09-02',
        to: '2026-09-08',
        surface: null,
        totals: { impressions: 42, posts: 12, viewers: 9, creators: 3, days: 7 },
        series: [{ date: '2026-09-08', impressions: 42, posts: 12, viewers: 9 }],
        by_surface: [{ surface: 'feed', impressions: 42, posts: 12, viewers: 9 }],
      },
    } as unknown as ReturnType<typeof useExposureOverview>);
    vi.mocked(useTopPosts).mockReturnValue({
      ...emptyQuery,
      data: { total: 0, limit: 5, offset: 0, rows: [] },
    } as unknown as ReturnType<typeof useTopPosts>);
    vi.mocked(useTopCreators).mockReturnValue({
      ...emptyQuery,
      data: { total: 0, limit: 5, offset: 0, rows: [] },
    } as unknown as ReturnType<typeof useTopCreators>);
    vi.mocked(useInterventions).mockReturnValue({
      ...emptyQuery,
      data: [],
    } as unknown as ReturnType<typeof useInterventions>);
  });

  it('renders the active config label as a link, never the object', async () => {
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText('v1-initial')).toBeInTheDocument();
    });
  });

  it('renders exposure totals from the backend', async () => {
    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('9')).toBeInTheDocument();
    });
  });

  it('marks built-in defaults visibly when fallback is serving', async () => {
    vi.mocked(useOverview).mockReturnValue({
      ...emptyQuery,
      data: {
        activeVersion: { id: 'd', label: 'built-in-defaults', fallback: true },
        featureFreshness: null,
      },
    } as unknown as ReturnType<typeof useOverview>);

    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText('built-in-defaults')).toBeInTheDocument();
    });
    // The Signals section states the fallback state plainly.
    expect(screen.getByText(/Built-in defaults serving/i)).toBeInTheDocument();
  });

  it('states clearly when no exposure has been recorded yet (no fake numbers)', () => {
    render(<OverviewPage />);
    expect(
      screen.getByText(/No recorded recommendations in this window yet/i),
    ).toBeInTheDocument();
  });

  it('shows the backend-unavailable state without crashing', () => {
    vi.mocked(useOverview).mockReturnValue({
      ...emptyQuery,
      error: new Error('backend unreachable'),
    } as unknown as ReturnType<typeof useOverview>);

    render(<OverviewPage />);
    expect(screen.getByText('Backend unreachable')).toBeInTheDocument();
  });

  it('surfaces active interventions as a signal row', async () => {
    vi.mocked(useInterventions).mockReturnValue({
      ...emptyQuery,
      data: [
        {
          id: 'iv1',
          scope: 'identity',
          scope_id: 's1',
          surface_id: null,
          kind: 'boost',
          multiplier: 1.5,
          reason: 'featured',
          created_by: 'u1',
          created_at: '2026-09-08T00:00:00Z',
          starts_at: '2026-09-08T00:00:00Z',
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
          revoked_at: null,
        },
      ],
    } as unknown as ReturnType<typeof useInterventions>);

    render(<OverviewPage />);
    await waitFor(() => {
      expect(screen.getByText(/1 live — review on the Interventions page/i)).toBeInTheDocument();
    });
  });
});
