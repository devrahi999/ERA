import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

/**
 * Configuration editor tests — the draft workflow's safety matrix: values
 * clamped to schema bounds, changed-vs-live marker, validation gating the
 * save button, and the structured diff rendering.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/configuration/new',
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/lib/api/queries', () => ({
  useOverview: vi.fn(),
  useConfigHistory: vi.fn(),
  useConfigVersion: vi.fn(),
  useCreateDraft: vi.fn(),
  useActivateConfig: vi.fn(),
  useValidateConfig: vi.fn(),
}));

import NewConfigPage from '@/app/(admin)/configuration/new/page';
import {
  useOverview,
  useConfigHistory,
  useConfigVersion,
  useValidateConfig,
  useCreateDraft,
} from '@/lib/api/queries';

const LIVE_CONFIG = {
  feed: {
    enabled: true,
    weights: {
      interest: 1.0,
      identityAffinity: 1.2,
      social: 0.8,
      quality: 1.0,
      engagement: 0.6,
      watch: 0.5,
      freshness: 1.1,
      popularity: 0.4,
      ownContent: 0.6,
      negativeFeedback: 1.0,
    },
    freshness: { halfLifeHours: 18, floor: 0.05, graceMinutes: 15 },
    diversity: {
      maxPerAuthor: 2, maxPerGame: 4, maxPerContentType: 5, windowSize: 10,
      repetitionPenalty: 0.45, maxExposuresBeforeDrop: 3, exposureWindowHours: 72,
    },
    exploration: { ratio: 0.15, minQuality: 0.05, coldStartRatio: 0.4, newContentMaxImpressions: 50 },
    candidateLimits: { perSource: 60, total: 400, freshHours: 72 },
  },
};

describe('Configuration draft editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOverview).mockReturnValue({
      data: { activeVersion: { id: 'live-1', label: 'v1-initial', fallback: false } },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useOverview>);
    vi.mocked(useConfigHistory).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConfigHistory>);
    vi.mocked(useConfigVersion).mockReturnValue({
      data: { id: 'live-1', version_label: 'v1-initial', status: 'active', config: LIVE_CONFIG, created_at: '2026-09-06T00:00:00Z', created_by: 'u1' },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useConfigVersion>);
    vi.mocked(useValidateConfig).mockReturnValue({
      data: undefined,
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      reset: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useValidateConfig>);
    vi.mocked(useCreateDraft).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateDraft>);
  });

  it('renders the structured editor with human-readable control names, not raw JSON first', async () => {
    render(<NewConfigPage />);
    expect(await screen.findByText('Feed Ranking')).toBeInTheDocument();
    expect(screen.getAllByText('Identity Affinity').length).toBeGreaterThanOrEqual(3); // feed, shorts and search each declare it
    expect(screen.getByText('Exploration ratio')).toBeInTheDocument();
    // The editor is structured by default — no <pre> JSON dump renders before
    // the user asks for it.
    expect(document.querySelector('pre')).toBeNull();
  });

  it('shows the live value of a field and marks it changed once edited', async () => {
    render(<NewConfigPage />);

    const interestInput = (await screen.findAllByLabelText('Interest numeric value'))[0];
    expect(interestInput).toHaveValue('1');
    expect(screen.queryByText('changed')).not.toBeInTheDocument();

    fireEvent.change(interestInput, { target: { value: '1.45' } });

    expect(screen.getByText('changed')).toBeInTheDocument();
  });

  it('clamps every control to its schema bounds — search personalisation caps at 0.5', async () => {
    render(<NewConfigPage />);

    const interestSlider = (await screen.findAllByLabelText('Interest slider'))[0];
    expect(interestSlider).toHaveAttribute('max', '5');
    expect(interestSlider).toHaveAttribute('min', '0');

    // Search personalisation is capped at 0.5 by schema — the control must
    // not be able to offer more.
    // The FIRST Identity Affinity slider is the feed's (max 5); the SEARCH section's is capped at 0.5.
    const affinitySliders = await screen.findAllByLabelText('Identity Affinity slider');
    const affinitySlider = affinitySliders[affinitySliders.length - 1];
    expect(affinitySlider).toHaveAttribute('max', '0.5');
  });

  it('gates the save button on a label AND edits AND validation', async () => {
    render(<NewConfigPage />);

    const saveButton = await screen.findByRole('button', { name: /save draft/i });
    expect(saveButton).toBeDisabled();

    // Even with a label, no edits means no save.
    const labelInput = screen.getByLabelText(/draft label/i);
    fireEvent.change(labelInput, { target: { value: 'v1.1-test' } });
    expect(saveButton).toBeDisabled();
  });

  it('runs validation and surfaces backend schema issues', async () => {
    vi.mocked(useValidateConfig).mockReturnValue({
      data: { valid: false, issues: [{ path: 'feed.weights.interest', message: 'must be ≤ 5' }] },
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      reset: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useValidateConfig>);

    render(<NewConfigPage />);

    // Make an edit so validation is enabled, run it, then read the
    // Validation tab.
    const interestInput = (await screen.findAllByLabelText('Interest numeric value'))[0];
    fireEvent.change(interestInput, { target: { value: '1.45' } });

    fireEvent.click(screen.getByRole('button', { name: /^Validate$/i }));
    fireEvent.click(screen.getByRole('tab', { name: /validation/i }));

    expect(await screen.findByText(/must be ≤ 5/i)).toBeInTheDocument();
    expect(screen.getByText('feed.weights.interest')).toBeInTheDocument();
  });

  it('the diff tab lists structured changes with old → new values', async () => {
    render(<NewConfigPage />);

    fireEvent.change((await screen.findAllByLabelText('Interest numeric value'))[0], {
      target: { value: '1.45' },
    });

    fireEvent.click(screen.getByRole('tab', { name: /diff/i }));
    await waitFor(() => {
      expect(screen.getByText('feed.weights.interest')).toBeInTheDocument();
      expect(screen.getByText('1.45')).toBeInTheDocument();
    });
  });
});
