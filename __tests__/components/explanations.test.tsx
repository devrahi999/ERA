import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ScoreBreakdown,
  RecommendationExplanation,
  EligibilityVerdict,
} from '@/components/ui/explanations';
import type { ScoreExplanation } from '@/types';

/**
 * Explanation component tests — the "why is this recommended" surface. The
 * contract: every number comes from the backend's ScoreExplanation, component
 * labels are human-readable, penalties/interventions/viewer-controls are
 surfaced, and the vocabulary is deterministic (never "AI decided").
 */

const explanation: ScoreExplanation = {
  total: 0.72,
  organic: 0.68,
  components: {
    interest: 0.62,
    identityAffinity: 0.31,
    freshness: 0.9,
    quality: 0.55,
    popularity: 0.2,
  },
  penalties: { repetition: 0.2 },
  interventionMultiplier: 1.0,
  viewerControlMultiplier: 1.5,
  exploration: true,
  source: 'identity_affinity',
};

describe('ScoreBreakdown', () => {
  it('renders every component with its human label and value', () => {
    render(<ScoreBreakdown explanation={explanation} />);
    expect(screen.getByText('Identity affinity')).toBeInTheDocument();
    expect(screen.getByText('Interest')).toBeInTheDocument();
    expect(screen.getByText('Freshness')).toBeInTheDocument();
    expect(screen.getByText('Quality')).toBeInTheDocument();
    expect(screen.getByText('Popularity')).toBeInTheDocument();
  });

  it('orders components by magnitude — the dominant factor reads first', () => {
    render(<ScoreBreakdown explanation={explanation} />);
    const labels = screen.getAllByText(/Interest|Freshness|Identity affinity|Quality|Popularity/);
    // Freshness (0.9) is the largest and must appear before quality (0.55).
    const freshnessIndex = labels.findIndex((el) => el.textContent === 'Freshness');
    const qualityIndex = labels.findIndex((el) => el.textContent === 'Quality');
    expect(freshnessIndex).toBeGreaterThan(-1);
    expect(freshnessIndex).toBeLessThan(qualityIndex);
  });

  it('surfaces penalties, viewer-control and organic separately', () => {
    render(<ScoreBreakdown explanation={explanation} />);
    expect(screen.getByText(/Repetition penalty/i)).toBeInTheDocument();
    expect(screen.getByText(/viewer control/i)).toBeInTheDocument();
    expect(screen.getByText(/organic/i)).toBeInTheDocument();
  });

  it('renders an explicit empty state when no component signal exists', () => {
    render(
      <ScoreBreakdown
        explanation={{ ...explanation, components: {}, penalties: {}, viewerControlMultiplier: undefined }}
      />,
    );
    expect(screen.getByText(/No component signal on this item/i)).toBeInTheDocument();
  });
});

describe('RecommendationExplanation', () => {
  it('names the candidate source in human words', () => {
    render(<RecommendationExplanation explanation={explanation} />);
    // The source and the reasons share one line; assert on the composed text.
    expect(document.body.textContent).toMatch(/Identity affinity — /);
  });

  it('uses truthful, deterministic vocabulary — never claims AI/ML decided', () => {
    render(<RecommendationExplanation explanation={explanation} />);
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/AI|machine learning|neural|LLM/i);
    expect(text).toMatch(/exploration candidate/);
  });

  it('marks own content as bounded when the ownContent component is present', () => {
    render(
      <RecommendationExplanation
        explanation={{
          ...explanation,
          components: { ...explanation.components, ownContent: 1 },
          source: 'following',
        }}
      />,
    );
    expect(screen.getByText(/your own content \(bounded\)/i)).toBeInTheDocument();
  });
});

describe('EligibilityVerdict', () => {
  it('reports eligible when no hard rule blocks the content', () => {
    render(
      <EligibilityVerdict
        eligibility={{
          post_exists: true,
          deleted: false,
          author_active: true,
          author_restricted: false,
          moderation_actioned: false,
          has_live_video: true,
          visibility: 'public',
          has_features_row: true,
        }}
      />,
    );
    expect(screen.getByText('Eligible')).toBeInTheDocument();
    expect(screen.getByText(/enforced before scoring/i)).toBeInTheDocument();
  });

  it('reports the blocking rule when hard eligibility fails', () => {
    render(
      <EligibilityVerdict
        eligibility={{
          post_exists: true,
          deleted: true,
          author_active: true,
          author_restricted: false,
          moderation_actioned: false,
          has_live_video: true,
          visibility: 'public',
          has_features_row: true,
        }}
      />,
    );
    expect(screen.getByText('Excluded from ranking')).toBeInTheDocument();
    expect(screen.getByText('Not deleted')).toBeInTheDocument();
  });
});
