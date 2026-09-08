import { z } from 'zod';

const weight = () => z.number().min(0).max(5);
const ratio = () => z.number().min(0).max(1);

export const freshnessSchema = z.object({
  halfLifeHours: z.number().min(0.5).max(720).default(18),
  floor: ratio().default(0.05),
  graceMinutes: z.number().min(0).max(1440).default(15),
});

export const diversitySchema = z.object({
  maxPerAuthor: z.number().int().min(1).max(10).default(2),
  maxPerGame: z.number().int().min(1).max(20).default(4),
  maxPerContentType: z.number().int().min(1).max(20).default(5),
  windowSize: z.number().int().min(2).max(50).default(10),
  repetitionPenalty: ratio().default(0.45),
  maxExposuresBeforeDrop: z.number().int().min(1).max(20).default(3),
  exposureWindowHours: z.number().int().min(1).max(720).default(72),
});

export const explorationSchema = z.object({
  ratio: z.number().min(0).max(0.4).default(0.15),
  minQuality: ratio().default(0.05),
  coldStartRatio: z.number().min(0).max(0.8).default(0.4),
  newContentMaxImpressions: z.number().int().min(0).max(10000).default(50),
});

export const candidateLimitsSchema = z.object({
  perSource: z.number().int().min(5).max(200).default(60),
  total: z.number().int().min(10).max(1000).default(400),
  freshHours: z.number().int().min(1).max(2160).default(72),
});

export const feedWeightsSchema = z.object({
  interest: weight().default(1.0),
  identityAffinity: weight().default(1.2),
  social: weight().default(0.8),
  quality: weight().default(1.0),
  engagement: weight().default(0.6),
  watch: weight().default(0.5),
  freshness: weight().default(1.1),
  popularity: weight().default(0.4),
  ownContent: z.number().min(0).max(1.5).default(0.6),
  negativeFeedback: weight().default(1.0),
});

export const shortsWeightsSchema = z.object({
  watchProbability: weight().default(1.4),
  expectedWatch: weight().default(1.3),
  completion: weight().default(1.0),
  interest: weight().default(0.9),
  identityAffinity: weight().default(1.0),
  quality: weight().default(0.8),
  freshness: weight().default(0.9),
  popularity: weight().default(0.3),
  ownContent: z.number().min(0).max(1.5).default(0.4),
  negativeFeedback: weight().default(1.2),
});

export const searchWeightsSchema = z.object({
  relevance: z.number().min(1).max(5).default(3.0),
  identityAffinity: z.number().min(0).max(0.5).default(0.25),
  quality: z.number().min(0).max(0.5).default(0.2),
  popularity: z.number().min(0).max(0.5).default(0.15),
  freshness: z.number().min(0).max(0.5).default(0.1),
});

export const signalWeightsSchema = z.object({
  impression: z.number().min(0).max(10).default(0.1),
  view: z.number().min(0).max(10).default(0.5),
  open: z.number().min(0).max(10).default(1.0),
  watchProgress: z.number().min(0).max(10).default(1.0),
  watchMilestone: z.number().min(0).max(10).default(2.0),
  complete: z.number().min(0).max(10).default(3.0),
  reaction: z.number().min(0).max(10).default(3.0),
  comment: z.number().min(0).max(10).default(4.0),
  save: z.number().min(0).max(10).default(4.0),
  share: z.number().min(0).max(10).default(5.0),
  follow: z.number().min(0).max(10).default(6.0),
  profileView: z.number().min(0).max(10).default(1.0),
  searchClick: z.number().min(0).max(10).default(1.5),
  unfollow: z.number().min(-10).max(0).default(-4.0),
  skip: z.number().min(-10).max(0).default(-0.5),
});

export const decaySchema = z.object({
  interestHalfLifeDays: z.number().min(0.5).max(365).default(14),
  lookbackDays: z.number().int().min(1).max(730).default(90),
});

export const coldStartSchema = z.object({
  interactionThreshold: z.number().int().min(0).max(1000).default(10),
  declaredInterestWeight: weight().default(1.5),
  popularContentRatio: ratio().default(0.5),
});

export const safetySchema = z.object({
  minScore: ratio().default(0),
  maxNegativeRate: ratio().default(0.5),
  interventionMin: z.number().min(0.1).max(1).default(0.25),
  interventionMax: z.number().min(1).max(5).default(3),
});

export const feedSurfaceSchema = z.object({
  enabled: z.boolean().default(true),
  weights: feedWeightsSchema,
  freshness: freshnessSchema,
  diversity: diversitySchema,
  exploration: explorationSchema,
  candidateLimits: candidateLimitsSchema,
});

export const shortsSurfaceSchema = z.object({
  enabled: z.boolean().default(true),
  weights: shortsWeightsSchema,
  freshness: freshnessSchema.default({ halfLifeHours: 12, floor: 0.05, graceMinutes: 15 }),
  diversity: diversitySchema.default({
    maxPerAuthor: 2,
    maxPerGame: 5,
    maxPerContentType: 20,
    windowSize: 8,
    repetitionPenalty: 0.6,
    maxExposuresBeforeDrop: 2,
    exposureWindowHours: 48,
  }),
  exploration: explorationSchema,
  candidateLimits: candidateLimitsSchema,
});

export const searchSurfaceSchema = z.object({
  enabled: z.boolean().default(true),
  weights: searchWeightsSchema,
  freshness: freshnessSchema.default({ halfLifeHours: 336, floor: 0.2, graceMinutes: 15 }),
  candidateLimits: candidateLimitsSchema,
});

export const sharedSchema = z.object({
  signalWeights: signalWeightsSchema,
  decay: decaySchema,
  coldStart: coldStartSchema,
  safety: safetySchema,
  configCacheSeconds: z.number().int().min(0).max(3600).default(60),
  debugLogSampleRate: ratio().default(0.01),
});

export const recommendationConfigSchema = z.object({
  feed: feedSurfaceSchema,
  shorts: shortsSurfaceSchema,
  search: searchSurfaceSchema,
  shared: sharedSchema,
});

export type RecommendationConfig = z.infer<typeof recommendationConfigSchema>;
