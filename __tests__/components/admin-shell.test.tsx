import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppShell } from '@/components/layout/admin-shell';

/**
 * Shell regression suite. The 2026-09-07 crash — "Objects are not valid as a
 * React child (found: object with keys {id, label, fallback})" — was the
 * topbar rendering the overview's activeVersion OBJECT. The shell mounts on
 * every (admin) page, so that crash took down the entire console. The new
 * shell keeps the same wire-shape contract: render the LABEL string, never
 * the object, and survive every overview state.
 */

vi.mock('next/navigation', () => ({
  usePathname: () => '/overview',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'admin@esporta.com', role: 'admin' },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

import { useQuery } from '@tanstack/react-query';

const REAL_OVERVIEW = {
  activeVersion: {
    id: '4b05de53-eb6c-435b-914e-a4319694b582',
    label: 'v1-initial',
    fallback: false,
  },
  featureFreshness: null,
};

describe('AppShell topbar (backend wire shape)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders activeVersion as its label string, never the object', async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: REAL_OVERVIEW,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useQuery>);

    const { container } = render(
      <AppShell>
        <div>page content</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(screen.getByText('v1-initial')).toBeInTheDocument();
    });
    expect(container.textContent).not.toContain('[object Object]');
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('marks fallback (built-in defaults) state visibly', async () => {
    vi.mocked(useQuery).mockReturnValue({
      data: {
        activeVersion: { id: 'defaults', label: 'built-in-defaults', fallback: true },
        featureFreshness: null,
      },
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useQuery>);

    render(
      <AppShell>
        <div>page content</div>
      </AppShell>,
    );

    await waitFor(() => {
      expect(screen.getByText('built-in-defaults')).toBeInTheDocument();
    });
    expect(screen.getByText('defaults active')).toBeInTheDocument();
  });

  it('survives a null overview (loading / error states)', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('backend unreachable'),
    } as unknown as ReturnType<typeof useQuery>);

    const { container } = render(
      <AppShell>
        <div>page content</div>
      </AppShell>,
    );

    // No crash, no object leak — the shell stays usable when the overview
    // endpoint fails, and reports the backend as unreachable.
    expect(container.textContent).toContain('defaults');
    expect(container.textContent).toContain('Backend unreachable');
    expect(container.textContent).toContain('page content');
  });

  it('renders the full navigation — Monitor, Control, Analytics, System', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: REAL_OVERVIEW,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useQuery>);

    render(
      <AppShell>
        <div>page content</div>
      </AppShell>,
    );

    const nav = screen.getByLabelText('Primary navigation');
    for (const label of [
      'Overview', 'Feed', 'Shorts', 'Content', 'Users', 'Identities',
      'Configuration', 'Ranking Lab', 'Experiments', 'Interventions',
      'Exposure', 'Performance', 'Health',
      'Debugger', 'Audit', 'System',
    ]) {
      expect(nav).toHaveTextContent(label);
    }
  });

  it('marks the active nav entry with aria-current', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: REAL_OVERVIEW,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useQuery>);

    render(
      <AppShell>
        <div>page content</div>
      </AppShell>,
    );

    const nav = screen.getByLabelText('Primary navigation');
    const active = nav.querySelector('[aria-current="page"]');
    expect(active).not.toBeNull();
    expect(active).toHaveTextContent('Overview');
  });
});
