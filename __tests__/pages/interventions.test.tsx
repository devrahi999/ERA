import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Interventions page tests — the spec's safety matrix: bounded multipliers,
 * expiry states, revoke flow, empty states, and the hard-eligibility
 * statement that interventions can never bypass.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/interventions',
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api/queries', () => ({
  useInterventions: vi.fn(),
  useRevokeIntervention: vi.fn(),
  useCreateIntervention: vi.fn(),
  useUsersOverview: vi.fn(),
}));

import InterventionsPage from '@/app/(admin)/interventions/page';
import {
  useInterventions,
  useRevokeIntervention,
  useCreateIntervention,
  useUsersOverview,
} from '@/lib/api/queries';

const activeIntervention = {
  id: 'iv-1',
  scope: 'identity' as const,
  scope_id: 'aaaaaaaa-0000-0000-0000-000000000001',
  surface_id: null,
  kind: 'boost' as const,
  multiplier: 1.5,
  reason: 'featured creator',
  created_by: 'u1',
  created_at: '2026-09-01T00:00:00Z',
  starts_at: '2026-09-01T00:00:00Z',
  expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  revoked_at: null,
};

const expiredIntervention = {
  ...activeIntervention,
  id: 'iv-2',
  kind: 'suppress' as const,
  multiplier: 0.5,
  expires_at: '2026-09-02T00:00:00Z',
};

const revokedIntervention = {
  ...activeIntervention,
  id: 'iv-3',
  revoked_at: '2026-09-03T00:00:00Z',
};

describe('Interventions page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useInterventions).mockReturnValue({
      data: [activeIntervention, expiredIntervention, revokedIntervention],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useInterventions>);
    vi.mocked(useRevokeIntervention).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useRevokeIntervention>);
    vi.mocked(useCreateIntervention).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateIntervention>);
    vi.mocked(useUsersOverview).mockReturnValue({
      data: { total: 0, limit: 100, offset: 0, rows: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useUsersOverview>);
  });

  it('lists active interventions with their bounded multiplier', async () => {
    render(<InterventionsPage />);
    await waitFor(() => {
      expect(screen.getByText('1.50×')).toBeInTheDocument();
    });
  });

  it('the Active tab shows only live rows; expired and revoked are history', async () => {
    render(<InterventionsPage />);
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
    // Active tab count = 1 (only the un-expired, un-revoked row).
    expect(screen.getByText('1', { selector: '.text-\\[11px\\]' })).toBeInTheDocument();
  });

  it('states the hard-eligibility contract explicitly', () => {
    render(<InterventionsPage />);
    expect(
      screen.getByText(/never bypass eligibility/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Deleted, private,\s*blocked, restricted and under-review content stays excluded/i),
    ).toBeInTheDocument();
  });

  it('shows an empty state when nothing is active', () => {
    vi.mocked(useInterventions).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useInterventions>);

    render(<InterventionsPage />);
    expect(screen.getByText(/No live overrides/i)).toBeInTheDocument();
  });

  it('opens the create dialog from the header action', async () => {
    render(<InterventionsPage />);
    const newButton = screen.getByRole('button', { name: /new intervention/i });
    newButton.click();
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('shows a revoke button for live rows only', async () => {
    render(<InterventionsPage />);
    await waitFor(() => {
      const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
      // One revoke button for the one active row (dialog is closed).
      expect(revokeButtons.length).toBe(1);
    });
  });
});
