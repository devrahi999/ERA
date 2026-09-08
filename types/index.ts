export interface User {
  id: string;
  email: string;
  role: string;
  capabilities?: string[];
}

export interface AuthSession {
  user: User;
  token: string;
}

/**
 * A config version as it actually arrives on the wire from the
 * reco_config_history / reco_config_version RPCs (snake_case, status is
 * draft | active | retired).
 */
export interface ConfigVersion {
  id: string;
  version_label: string;
  status: "draft" | "active" | "retired";
  // The full validated config document. Structured editors read known paths;
  // the raw JSON view is the advanced fallback.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any;
  created_at: string;
  created_by: string;
  activated_at?: string | null;
  deactivated_at?: string | null;
  config_hash?: string;
  notes?: string | null;
}

export interface PagedResponse<T> {
  data: T[];
  total: number;
}

/* =============================================================================
   Recommendation engine wire types — the shapes the NestJS admin surface and
   the reco_* SQL functions actually return. snake_case on purpose: these
   mirror the backend 1:1 and converting at the edge invites drift.
   ============================================================================= */

export interface ActiveVersionInfo {
  id: string;
  label: string;
  fallback: boolean;
}

export interface FeatureFreshness {
  content?: { rows?: number; last_computed_at?: string };
  identity?: { rows?: number; last_computed_at?: string };
  user?: { rows?: number; last_computed_at?: string };
}

export interface OverviewResponse {
  activeVersion: ActiveVersionInfo | null;
  config?: unknown;
  featureFreshness?: FeatureFreshness | null;
}

/** A per-component score breakdown, exactly as the ranker emits it. */
export interface ScoreExplanation {
  total: number;
  organic: number;
  components: Record<string, number>;
  penalties?: Record<string, number>;
  interventionMultiplier: number;
  viewerControlMultiplier?: number;
  exploration: boolean;
  source: string;
}

export interface DebugRankingResponse {
  meta: {
    surface: string;
    algorithmVersion: string;
    configVersionId: string;
    candidateCount: number;
    eligibleCount: number;
    resultCount: number;
    slateSize: number;
    coldStart: boolean;
    durationMs: number;
    cursorRejected?: unknown;
  };
  fallback: boolean;
  fallbackReason?: string;
  postIds: string[];
  explanations: Record<string, ScoreExplanation>;
  dropped: Array<{ postId: string; reason: string }>;
}

export interface DebugIdentitySearchResponse {
  lexical: Array<{ id: string; score: number }>;
  rankedIds: string[];
  fallback: boolean;
  fallbackReason?: string;
  algorithmVersion: string;
  configVersionId: string;
  explanations: Record<string, ScoreExplanation>;
  restrictedDropped: number;
}

export interface DebugUserProfile {
  identity?: {
    id: string;
    kind: string;
    username: string;
    display_name: string;
    status: string;
  } | null;
  features?: Record<string, unknown> | null;
  topics?: Array<{
    dimension: string;
    key: string;
    score: number;
    raw_weight: number;
    interactions: number;
    last_signal_at: string;
  }>;
  top_identities?: Array<{
    target_id: string;
    username: string | null;
    kind: string;
    score: number;
    follows: boolean;
    interactions: number;
    watch_time_ms: number;
    negatives: number;
  }>;
  recent_exposures?: Array<{
    surface: string;
    post_id: string;
    shown: number;
    last_shown_at: string;
  }>;
}

export interface DebugContent {
  post?: {
    id: string;
    author_id: string;
    type_id: string;
    visibility: string;
    created_at: string;
    deleted_at: string | null;
  } | null;
  features?: Record<string, unknown> | null;
  author?: Record<string, unknown> | null;
  eligibility?: {
    post_exists: boolean;
    deleted: boolean;
    author_active: boolean;
    author_restricted: boolean;
    moderation_actioned: boolean;
    has_live_video: boolean;
    visibility: string;
    has_features_row: boolean;
  } | null;
  interventions?: InterventionRow[];
}

export interface InterventionRow {
  id: string;
  scope: "post" | "identity";
  scope_id: string;
  surface_id: string | null;
  kind: "boost" | "suppress";
  multiplier: number;
  reason: string;
  created_by: string;
  created_at: string;
  starts_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export interface AuditRow {
  id: string;
  version_id: string | null;
  action: string;
  actor_user_id: string;
  before_state: unknown;
  after_state: unknown;
  note: string | null;
  created_at: string;
}

/* ------------------------------------------------------- exposure analytics */

export interface ExposureOverview {
  from: string;
  to: string;
  surface: string | null;
  totals: {
    impressions: number;
    posts: number;
    viewers: number;
    creators: number;
    days: number;
  };
  series: Array<{
    date: string;
    impressions: number;
    posts: number;
    viewers: number;
  }>;
  by_surface: Array<{
    surface: string;
    impressions: number;
    posts: number;
    viewers: number;
  }>;
}

export interface IdentityRef {
  id: string;
  username: string;
  display_name: string;
  kind: string;
  verified?: boolean;
}

export interface TopPostRow {
  post_id: string;
  impressions: number;
  reach: number;
  last_shown_at: string | null;
  post: {
    id: string;
    type_id: string;
    caption: string | null;
    created_at: string;
    deleted_at: string | null;
    moderation_status: string;
    visibility: string;
  };
  author: IdentityRef;
  game: string | null;
  features: {
    quality_score: number;
    popularity_score: number;
    engagement_rate: number;
    completion_rate: number;
    avg_watch_ms: number;
    negative_rate: number;
  } | null;
  engagement: {
    views: number | null;
    reactions: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
    watch_time_ms: number | null;
    watch_completes: number | null;
  } | null;
}

export interface TopCreatorRow {
  creator: IdentityRef;
  impressions: number;
  posts: number;
  reach: number;
  share: number;
}

export interface TopGameRow {
  game: string;
  name: string | null;
  impressions: number;
  posts: number;
  reach: number;
  share: number;
}

export interface ContentStatsRow {
  post_id: string;
  is_short: boolean;
  game: string | null;
  eligible: boolean;
  quality_score: number;
  popularity_score: number;
  engagement_rate: number;
  completion_rate: number;
  avg_watch_ms: number;
  negative_rate: number;
  confidence: number;
  impressions: number;
  exposure_impressions: number;
  exposure_viewers: number;
  post: {
    id: string;
    type_id: string;
    caption: string | null;
    created_at: string;
    deleted_at: string | null;
    moderation_status: string;
    visibility: string;
  };
  author: IdentityRef;
}

export interface PagedRows<T> {
  total: number;
  limit: number;
  offset: number;
  rows: T[];
}

export interface PostExposureHistory {
  post_id: string;
  from: string;
  to: string;
  summary: {
    impressions: number;
    viewers: number;
    first_shown_at: string | null;
    last_shown_at: string | null;
    surfaces: Array<{ surface: string; impressions: number }>;
  };
  series: Array<{ date: string; impressions: number; viewers: number }>;
}

export interface UserOverviewRow {
  identity_id: string;
  username: string;
  display_name: string;
  kind: string;
  is_cold_start: boolean;
  interaction_count: number;
  confidence: number;
  following_count: number;
  declared_game_ids: string[];
  exploration_appetite: number;
  last_active_at: string | null;
  computed_at: string;
  has_active_controls: boolean;
}

export interface IdentityStats {
  identity: {
    id: string;
    kind: string;
    username: string;
    display_name: string;
    status: string;
    verified: boolean;
    restricted: boolean;
  } | null;
  features: Record<string, unknown> | null;
  exposure: {
    impressions: number;
    posts: number;
    viewers: number;
    series: Array<{ date: string; impressions: number }>;
  };
  audience: Array<{
    viewer_id: string;
    username: string;
    kind: string;
    impressions: number;
  }>;
  interventions: InterventionRow[];
}

/* ---------------------------------------------------------- viewer controls */

export interface ViewerControlRow {
  identity_id: string;
  surface_id: string | null;
  controls: {
    boosts?: Record<string, number>;
    suppress?: Record<string, number>;
    exploration?: "low" | "default" | "high";
  };
  reason: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

/* ------------------------------------------------------------- experiments */

export interface ExperimentRow {
  id: string;
  name: string;
  description: string | null;
  surface: string;
  status: "draft" | "running" | "stopped" | "completed";
  variant_percent: number;
  control_version: { id: string; label: string } | null;
  variant_version: { id: string; label: string } | null;
  created_by: string;
  created_at: string;
  started_at: string | null;
  stopped_at: string | null;
  stop_reason: string | null;
  metrics: {
    control: { impressions: number; viewers: number; posts: number };
    variant: { impressions: number; viewers: number; posts: number };
  };
}

/* --------------------------------------------------------- config drafts */

export interface ConfigValidationIssue {
  path: string;
  message: string;
}

export interface ConfigValidationResponse {
  valid: boolean;
  config?: unknown;
  issues: ConfigValidationIssue[];
}
