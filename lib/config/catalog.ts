/**
 * The configuration field catalog — the single source of human names,
 * descriptions, bounds and impact explanations for every tunable, mirroring
 * the backend schema exactly. The structured editor renders from this; the
 * numeric bounds here are the same ones the backend zod schema enforces, so
 * the frontend cannot offer a value the backend would reject (the backend
 * remains the authority).
 */

export interface FieldSpec {
  /** Dotted path into the config document. */
  path: string;
  label: string;
  description: string;
  impact: string;
  min: number;
  max: number;
  step: number;
  integer?: boolean;
  /** When set, the control is a toggle. */
  boolean?: boolean;
  unit?: string;
  advanced?: boolean;
}

export interface ConfigGroup {
  id: string;
  title: string;
  description: string;
  fields: FieldSpec[];
}

export interface ConfigSection {
  id: string;
  title: string;
  description: string;
  groups: ConfigGroup[];
}

const weightField = (
  path: string,
  label: string,
  description: string,
  impact: string,
  max = 5,
): FieldSpec => ({
  path, label, description, impact,
  min: 0, max, step: 0.05,
});

export const CONFIG_SECTIONS: ConfigSection[] = [
  {
    id: "feed",
    title: "Feed Ranking",
    description: "The Home Feed's weighted objective. Each weight is a contribution to a normalised score — relative sizes are the tuning surface.",
    groups: [
      {
        id: "feed-weights",
        title: "Weights",
        description: "How strongly each signal moves a post's feed score.",
        fields: [
          weightField("feed.weights.interest", "Interest", "Affinity between the viewer and the post's game/topic.", "Increases the influence of user content affinity."),
          weightField("feed.weights.identityAffinity", "Identity Affinity", "Viewer's signed affinity for the author (follows, interactions).", "Increases the influence of who created the content."),
          weightField("feed.weights.social", "Social", "Follows and past interactions as a social signal.", "Boosts content from people the viewer knows."),
          weightField("feed.weights.quality", "Quality", "Statistically-shrunk content quality score.", "Favors well-received, high-retention content."),
          weightField("feed.weights.engagement", "Engagement", "The post's engagement rate.", "Favors content others interact with."),
          weightField("feed.weights.watch", "Watch", "Average watch duration (video posts only).", "Favor content people actually watch."),
          weightField("feed.weights.freshness", "Freshness", "How new the post is, half-life decayed.", "Favor recent content over older content."),
          weightField("feed.weights.popularity", "Popularity", "Log-compressed platform popularity.", "Favor broadly popular content."),
          { ...weightField("feed.weights.ownContent", "Own Content", "The viewer's own posts — bounded boost.", "How much a viewer's own content ranks in their feed.", 1.5), description: "Eligible but capped — own content can never be an auto-#1." },
          weightField("feed.weights.negativeFeedback", "Negative Feedback", "Penalty strength for negative signals.", "How hard reported/disliked content sinks."),
          { path: "feed.enabled", label: "Feed ranking", description: "The rollout switch. Off returns the feed to pure chronological order — a no-deploy operational lever.", impact: "Turns personalised ranking on or off for the Home Feed.", min: 0, max: 1, step: 1, boolean: true },
        ],
      },
      {
        id: "feed-freshness",
        title: "Freshness",
        description: "Decay curve applied to every post's age.",
        fields: [
          { path: "feed.freshness.halfLifeHours", label: "Half-life (hours)", description: "After this many hours a post's freshness component is worth half.", impact: "Smaller = feeds favor newer content more aggressively.", min: 0.5, max: 720, step: 1, unit: "h" },
          { path: "feed.freshness.floor", label: "Floor", description: "Minimum freshness — stops old-but-good content being erased.", impact: "Higher keeps older quality content rankable.", min: 0, max: 1, step: 0.01 },
          { path: "feed.freshness.graceMinutes", label: "Grace period", description: "Content newer than this is maximally fresh (no penalty yet).", impact: "Protects just-published posts from decay.", min: 0, max: 1440, step: 5, unit: "min", advanced: true },
        ],
      },
      {
        id: "feed-diversity",
        title: "Diversity",
        description: "Sliding-window limits over the final ordering — prevents a monotonous feed.",
        fields: [
          { path: "feed.diversity.maxPerAuthor", label: "Max per author", description: "Max posts by one author within the window.", impact: "Lower = stricter author variety.", min: 1, max: 10, step: 1, integer: true },
          { path: "feed.diversity.maxPerGame", label: "Max per game", description: "Max posts for one game/topic within the window.", impact: "Lower = stricter topic variety.", min: 1, max: 20, step: 1, integer: true },
          { path: "feed.diversity.maxPerContentType", label: "Max per content type", description: "Max posts of one content type within the window.", impact: "Lower = stricter format variety.", min: 1, max: 20, step: 1, integer: true },
          { path: "feed.diversity.windowSize", label: "Window size", description: "The trailing window the limits above are measured over.", impact: "Larger = limits apply over more consecutive results.", min: 2, max: 50, step: 1, integer: true },
          { path: "feed.diversity.repetitionPenalty", label: "Repetition penalty", description: "Per-exposure demotion for already-seen items (compounding, capped).", impact: "Higher = seen items sink faster on repeat.", min: 0, max: 1, step: 0.05 },
          { path: "feed.diversity.maxExposuresBeforeDrop", label: "Max exposures before drop", description: "Exposures at/above this count drop the item from slates entirely.", impact: "Lower = items retire from recommendations sooner.", min: 1, max: 20, step: 1, integer: true },
          { path: "feed.diversity.exposureWindowHours", label: "Exposure window (hours)", description: "How far back exposures are considered.", impact: "Longer = repetition control has more memory.", min: 1, max: 720, step: 1, unit: "h", integer: true, advanced: true },
        ],
      },
      {
        id: "feed-exploration",
        title: "Exploration",
        description: "Reserved slots for content the exploitative ordering would not choose.",
        fields: [
          { path: "feed.exploration.ratio", label: "Exploration ratio", description: "Share of the slate reserved for exploration (capped at 40%).", impact: "Higher = more discovery, less pure relevance.", min: 0, max: 0.4, step: 0.01 },
          { path: "feed.exploration.minQuality", label: "Min quality", description: "Quality floor an exploration pick must still clear.", impact: "Higher = exploration cannot surface low-grade content.", min: 0, max: 1, step: 0.01, advanced: true },
          { path: "feed.exploration.coldStartRatio", label: "Cold-start ratio", description: "Extra exploration allowance for viewers with no interest history.", impact: "Higher = new accounts see more variety while the model warms up.", min: 0, max: 0.8, step: 0.01 },
          { path: "feed.exploration.newContentMaxImpressions", label: "New content threshold", description: "Impressions below which content counts as 'new' for exploration.", impact: "Higher = more items qualify as new.", min: 0, max: 10000, step: 5, integer: true, advanced: true },
        ],
      },
    ],
  },
  {
    id: "shorts",
    title: "Shorts Ranking",
    description: "The Shorts objective is expected meaningful watch, not views.",
    groups: [
      {
        id: "shorts-weights",
        title: "Weights",
        description: "Watch-derived signals dominate by design.",
        fields: [
          weightField("shorts.weights.watchProbability", "Watch Probability", "P(this viewer meaningfully watches this clip).", "The core retention prediction term."),
          weightField("shorts.weights.expectedWatch", "Expected Watch", "watchProbability × expected duration.", "Favors clips people finish, not just start."),
          weightField("shorts.weights.completion", "Completion", "The clip's completion rate.", "Favor clips with strong endings."),
          weightField("shorts.weights.interest", "Interest", "Viewer→game/topic affinity.", "Favor games the viewer cares about."),
          weightField("shorts.weights.identityAffinity", "Identity Affinity", "Viewer→creator affinity.", "Favor creators the viewer follows/interacts with."),
          weightField("shorts.weights.quality", "Quality", "Shrunk content quality.", "Favor well-received clips."),
          weightField("shorts.weights.freshness", "Freshness", "Age decay — shorts go stale faster than posts.", "Favor recent clips."),
          weightField("shorts.weights.popularity", "Popularity", "Log-compressed popularity.", "Favor broadly watched clips."),
          { ...weightField("shorts.weights.ownContent", "Own Content", "The viewer's own shorts — bounded.", "How much a viewer's own shorts rank in their feed.", 1.5) },
          weightField("shorts.weights.negativeFeedback", "Negative Feedback", "Penalty strength for negative signals.", "How hard reported/disliked clips sink."),
          { path: "shorts.enabled", label: "Shorts ranking", description: "The rollout switch for shorts ranking.", impact: "Turns personalised ranking on or off for Shorts.", min: 0, max: 1, step: 1, boolean: true },
        ],
      },
      {
        id: "shorts-freshness",
        title: "Freshness",
        description: "Shorts default to a shorter half-life than feed posts.",
        fields: [
          { path: "shorts.freshness.halfLifeHours", label: "Half-life (hours)", description: "Shorts staler in a day by default.", impact: "Smaller = shorts favor newer clips more aggressively.", min: 0.5, max: 720, step: 1, unit: "h" },
          { path: "shorts.freshness.floor", label: "Floor", description: "Minimum freshness.", impact: "Keeps older quality shorts rankable.", min: 0, max: 1, step: 0.01 },
        ],
      },
      {
        id: "shorts-diversity",
        title: "Diversity",
        description: "Tighter author windows than the feed — repeated shorts retire faster.",
        fields: [
          { path: "shorts.diversity.maxPerAuthor", label: "Max per author", description: "Max clips by one creator within the window.", impact: "Lower = stricter creator variety.", min: 1, max: 10, step: 1, integer: true },
          { path: "shorts.diversity.windowSize", label: "Window size", description: "The trailing window limits are measured over.", impact: "Larger = limits apply over more consecutive results.", min: 2, max: 50, step: 1, integer: true },
          { path: "shorts.diversity.repetitionPenalty", label: "Repetition penalty", description: "Per-exposure demotion for seen clips.", impact: "Higher = seen clips sink faster.", min: 0, max: 1, step: 0.05 },
          { path: "shorts.diversity.maxExposuresBeforeDrop", label: "Max exposures", description: "Seen this many times → dropped from slates.", impact: "Lower = clips retire sooner.", min: 1, max: 20, step: 1, integer: true },
        ],
      },
    ],
  },
  {
    id: "search",
    title: "Search Ranking",
    description: "Relevance-dominant by schema: relevance ≥ 1.0 while every personalisation weight is capped at 0.5, and relevance is also a multiplicative gate.",
    groups: [
      {
        id: "search-weights",
        title: "Weights",
        description: "Personalisation bounds are hard schema limits — search can never become a recommendation feed.",
        fields: [
          { path: "search.weights.relevance", label: "Relevance", description: "The lexical match score. Minimum 1.0 by schema.", impact: "Higher = lexical match dominates more.", min: 1, max: 5, step: 0.05 },
          { ...weightField("search.weights.identityAffinity", "Identity Affinity", "Viewer→author affinity (max 0.5 by schema).", "Favor authors the viewer knows.", 0.5) },
          { ...weightField("search.weights.quality", "Quality", "Content quality (max 0.5 by schema).", "Favor high-quality results.", 0.5) },
          { ...weightField("search.weights.popularity", "Popularity", "Popularity (max 0.5 by schema).", "Favor popular results.", 0.5) },
          { ...weightField("search.weights.freshness", "Freshness", "Age decay (max 0.5 by schema).", "Favor recent results.", 0.5) },
          { path: "search.enabled", label: "Search ranking", description: "Off returns search to pure lexical order.", impact: "Turns ranked re-ordering of search results on or off.", min: 0, max: 1, step: 1, boolean: true },
        ],
      },
    ],
  },
  {
    id: "shared",
    title: "Shared Behaviour",
    description: "Signal weights for the interest model, decay, cold start and safety rails.",
    groups: [
      {
        id: "signal-weights",
        title: "Interest signal weights",
        description: "How much each user action counts toward topic/identity affinity. Applied on the next feature rebuild.",
        fields: [
          { path: "shared.signalWeights.impression", label: "Impression", description: "Content was rendered in a feed.", impact: "Barely counts — seeing is not engaging.", min: 0, max: 10, step: 0.1, advanced: true },
          { path: "shared.signalWeights.view", label: "View", description: "Content entered the viewport with dwell.", impact: "Counts more than an impression.", min: 0, max: 10, step: 0.1, advanced: true },
          { path: "shared.signalWeights.open", label: "Open", description: "Post detail opened.", impact: "A deliberate act.", min: 0, max: 10, step: 0.1, advanced: true },
          { path: "shared.signalWeights.watchProgress", label: "Watch progress", description: "Video watch progress event.", impact: "Watch interest accrues per event.", min: 0, max: 10, step: 0.1, advanced: true },
          { path: "shared.signalWeights.watchMilestone", label: "Watch milestone", description: "25/50/75% milestones.", impact: "Stronger than progress ticks.", min: 0, max: 10, step: 0.1, advanced: true },
          { path: "shared.signalWeights.complete", label: "Complete", description: "Video watched to the end.", impact: "One of the strongest watch signals.", min: 0, max: 10, step: 0.1, advanced: true },
          { path: "shared.signalWeights.reaction", label: "Reaction", description: "Love/fire/laughing/angry.", impact: "Active engagement with content.", min: 0, max: 10, step: 0.1 },
          { path: "shared.signalWeights.comment", label: "Comment", description: "Comment written.", impact: "High-effort engagement.", min: 0, max: 10, step: 0.1 },
          { path: "shared.signalWeights.save", label: "Save", description: "Saved for later.", impact: "High-intent engagement.", min: 0, max: 10, step: 0.1 },
          { path: "shared.signalWeights.share", label: "Share", description: "Shared via any path.", impact: "One of the strongest interest statements.", min: 0, max: 10, step: 0.1 },
          { path: "shared.signalWeights.follow", label: "Follow", description: "Followed the author.", impact: "The strongest single interest signal.", min: 0, max: 10, step: 0.1 },
          { path: "shared.signalWeights.profileView", label: "Profile view", description: "Visited the author's profile.", impact: "Mild interest in the author.", min: 0, max: 10, step: 0.1, advanced: true },
          { path: "shared.signalWeights.searchClick", label: "Search click", description: "Clicked a search result.", impact: "Validates search relevance.", min: 0, max: 10, step: 0.1, advanced: true },
          { path: "shared.signalWeights.unfollow", label: "Unfollow", description: "Unfollowed the author — negative by construction.", impact: "Negative: demotes affinity.", min: -10, max: 0, step: 0.1, advanced: true },
          { path: "shared.signalWeights.skip", label: "Skip", description: "Scrolled past quickly — mildly negative.", impact: "Negative: small demotion.", min: -10, max: 0, step: 0.1, advanced: true },
        ],
      },
      {
        id: "decay",
        title: "Decay & lookback",
        description: "Interest model time horizon.",
        fields: [
          { path: "shared.decay.interestHalfLifeDays", label: "Interest half-life (days)", description: "A burst raises affinity without erasing long-standing interest.", impact: "Smaller = recent behavior matters more.", min: 0.5, max: 365, step: 0.5, unit: "d" },
          { path: "shared.decay.lookbackDays", label: "Lookback (days)", description: "How far back the interest model reads events.", impact: "Longer = older activity still shapes affinities.", min: 1, max: 730, step: 1, unit: "d", integer: true },
        ],
      },
      {
        id: "cold-start",
        title: "Cold start",
        description: "Behavior before enough interactions exist.",
        fields: [
          { path: "shared.coldStart.interactionThreshold", label: "Interaction threshold", description: "Below this count a viewer is cold-start.", impact: "Higher = more viewers treated as cold-start.", min: 0, max: 1000, step: 1, integer: true },
          { path: "shared.coldStart.declaredInterestWeight", label: "Declared interest weight", description: "Weight given to onboarding-declared games.", impact: "Higher = declared games dominate the first feeds.", min: 0, max: 5, step: 0.05 },
          { path: "shared.coldStart.popularContentRatio", label: "Popular content ratio", description: "Share of a cold-start slate from popular/trending.", impact: "Higher = new accounts see more trending content.", min: 0, max: 1, step: 0.05 },
        ],
      },
      {
        id: "safety",
        title: "Safety rails",
        description: "Score floor, negative-rate ceiling and the intervention clamp band. These bound every boost/suppression — admin and per-viewer alike.",
        fields: [
          { path: "shared.safety.minScore", label: "Min score", description: "Candidates scoring below are dropped (0 = keep everything with a small catalogue).", impact: "Raise on a mature catalogue to filter filler.", min: 0, max: 1, step: 0.01 },
          { path: "shared.safety.maxNegativeRate", label: "Max negative rate", description: "Content above this negative-feedback rate is excluded from ranking.", impact: "Lower = stricter exclusion of reported content.", min: 0, max: 1, step: 0.01 },
          { path: "shared.safety.interventionMin", label: "Intervention min", description: "The floor composed intervention multipliers clamp to.", impact: "Lower bound on any boost/suppress stack.", min: 0.1, max: 1, step: 0.05, advanced: true },
          { path: "shared.safety.interventionMax", label: "Intervention max", description: "The ceiling composed intervention multipliers clamp to.", impact: "No admin or viewer control can boost past this.", min: 1, max: 5, step: 0.05, advanced: true },
        ],
      },
    ],
  },
];

/** Read a dotted path from a config object. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPath(obj: any, path: string): unknown {
  return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

/** Write a dotted path immutably; returns a new object. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setPath(obj: any, path: string, value: unknown): any {
  const keys = path.split(".");
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };
  let cursor = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    cursor[key] = Array.isArray(cursor[key]) ? [...cursor[key]] : { ...cursor[key] };
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
  return clone;
}
