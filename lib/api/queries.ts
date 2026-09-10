"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api/client";
import type {
  AuditRow,
  ConfigValidationResponse,
  ConfigVersion,
  ContentStatsRow,
  DebugContent,
  DebugIdentitySearchResponse,
  DebugRankingResponse,
  DebugUserProfile,
  ExperimentRow,
  ExposureOverview,
  IdentityStats,
  InterventionRow,
  OverviewResponse,
  PagedRows,
  PostExposureHistory,
  TopCreatorRow,
  TopGameRow,
  TopPostRow,
  UserOverviewRow,
  ViewerControlRow,
} from "@/types";

/**
 * The typed query layer. One hook per backend read; mutations invalidate the
 * dependent query keys so activation/rollback/intervention changes propagate
 * without a page reload.
 */

const BASE = "/admin/recommendations";

/* --------------------------------------------------------------- overview */

export function useOverview() {
  return useQuery({
    queryKey: ["reco", "overview"],
    queryFn: () => fetchApi<OverviewResponse>(`${BASE}/overview`),
    staleTime: 30_000,
  });
}

export function useConfigHistory(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ["reco", "config-history", limit, offset],
    queryFn: async () => {
      // The backend pages the history as `{ items: [...] }`, not a bare array.
      // Every page consumes this hook as a list — unwrap once, here, so the
      // hook's contract stays "the versions" and no call site can trip on the
      // wire shape after the query resolves.
      const data = await fetchApi<{ items: ConfigVersion[] }>(
        `${BASE}/config/history?limit=${limit}&offset=${offset}`,
      );
      return data?.items ?? [];
    },
  });
}

export function useConfigVersion(versionId: string | null | undefined) {
  return useQuery({
    queryKey: ["reco", "config-version", versionId],
    queryFn: () => fetchApi<ConfigVersion>(`${BASE}/config/${versionId}`),
    enabled: Boolean(versionId),
  });
}

export function useAuditLog(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ["reco", "audit", limit, offset],
    queryFn: async () => {
      // Same `{ items: [...] }` wire shape as config history — see
      // useConfigHistory for why the unwrap lives here.
      const data = await fetchApi<{ items: AuditRow[] }>(
        `${BASE}/audit?limit=${limit}&offset=${offset}`,
      );
      return data?.items ?? [];
    },
  });
}

/* ------------------------------------------------------------------ debug */

export function useDebugRanking(params: {
  viewerId: string | null;
  surface: "feed" | "shorts" | "search";
  limit?: number;
  previewConfigVersionId?: string | null;
  query?: string;
  previewControls?: string | null;
  enabled?: boolean;
}) {
  const search = new URLSearchParams();
  if (params.limit) search.set("limit", String(params.limit));
  if (params.previewConfigVersionId) search.set("previewConfigVersionId", params.previewConfigVersionId);
  if (params.query) search.set("q", params.query);
  if (params.previewControls) search.set("previewControls", params.previewControls);
  return useQuery({
    queryKey: [
      "reco", "debug-ranking",
      params.viewerId, params.surface, params.limit ?? 20,
      params.previewConfigVersionId ?? null, params.query ?? null, params.previewControls ?? null,
    ],
    queryFn: () =>
      fetchApi<DebugRankingResponse>(
        `${BASE}/debug/ranking/${params.viewerId}/${params.surface}?${search.toString()}`,
      ),
    enabled: Boolean(params.viewerId) && (params.enabled ?? true),
  });
}

export function useDebugIdentitySearch(params: {
  viewerId: string | null;
  kind: "personal" | "team";
  query: string;
  limit?: number;
  enabled?: boolean;
}) {
  const search = new URLSearchParams({ kind: params.kind, q: params.query });
  if (params.limit) search.set("limit", String(params.limit));
  return useQuery({
    queryKey: ["reco", "debug-identity-search", params.viewerId, params.kind, params.query, params.limit ?? 20],
    queryFn: () =>
      fetchApi<DebugIdentitySearchResponse>(
        `${BASE}/debug/identity-search/${params.viewerId}?${search.toString()}`,
      ),
    enabled:
      Boolean(params.viewerId) && params.query.trim().length > 0 && (params.enabled ?? true),
  });
}

export function useDebugUser(identityId: string | null) {
  return useQuery({
    queryKey: ["reco", "debug-user", identityId],
    queryFn: () => fetchApi<DebugUserProfile>(`${BASE}/debug/user/${identityId}`),
    enabled: Boolean(identityId),
  });
}

export function useDebugContent(postId: string | null) {
  return useQuery({
    queryKey: ["reco", "debug-content", postId],
    queryFn: () => fetchApi<DebugContent>(`${BASE}/debug/content/${postId}`),
    enabled: Boolean(postId),
  });
}

/* ------------------------------------------------------ exposure analytics */

export function useExposureOverview(from: string, to: string, surface?: string) {
  const search = new URLSearchParams({ from, to });
  if (surface) search.set("surface", surface);
  return useQuery({
    queryKey: ["reco", "exposure-overview", from, to, surface ?? null],
    queryFn: () => fetchApi<ExposureOverview>(`${BASE}/exposure/overview?${search.toString()}`),
  });
}

export function useTopPosts(params: {
  from: string;
  to: string;
  surface?: string;
  kind?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams({ from: params.from, to: params.to });
  if (params.surface) search.set("surface", params.surface);
  if (params.kind) search.set("kind", params.kind);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  return useQuery({
    queryKey: ["reco", "top-posts", params.from, params.to, params.surface ?? null, params.kind ?? "all", params.limit ?? 25, params.offset ?? 0],
    queryFn: () => fetchApi<PagedRows<TopPostRow>>(`${BASE}/exposure/top-posts?${search.toString()}`),
  });
}

export function useTopCreators(params: { from: string; to: string; surface?: string; limit?: number; offset?: number }) {
  const search = new URLSearchParams({ from: params.from, to: params.to });
  if (params.surface) search.set("surface", params.surface);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  return useQuery({
    queryKey: ["reco", "top-creators", params.from, params.to, params.surface ?? null, params.limit ?? 25, params.offset ?? 0],
    queryFn: () => fetchApi<PagedRows<TopCreatorRow>>(`${BASE}/exposure/top-creators?${search.toString()}`),
  });
}

export function useTopGames(params: { from: string; to: string; surface?: string; limit?: number }) {
  const search = new URLSearchParams({ from: params.from, to: params.to });
  if (params.surface) search.set("surface", params.surface);
  if (params.limit) search.set("limit", String(params.limit));
  return useQuery({
    queryKey: ["reco", "top-games", params.from, params.to, params.surface ?? null, params.limit ?? 25],
    queryFn: () => fetchApi<{ total_impressions: number; rows: TopGameRow[] }>(`${BASE}/exposure/top-games?${search.toString()}`),
  });
}

/* ---------------------------------------------------------------- content */

export function useContentStats(params: {
  search?: string;
  kind?: string;
  status?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}) {
  const search = new URLSearchParams();
  if (params.search) search.set("search", params.search);
  if (params.kind) search.set("kind", params.kind);
  if (params.status) search.set("status", params.status);
  if (params.sort) search.set("sort", params.sort);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  return useQuery({
    queryKey: ["reco", "content-stats", params.search ?? null, params.kind ?? "all", params.status ?? "all", params.sort ?? "exposure", params.limit ?? 25, params.offset ?? 0],
    queryFn: () => fetchApi<PagedRows<ContentStatsRow>>(`${BASE}/content?${search.toString()}`),
  });
}

export function usePostExposureHistory(postId: string | null, days = 30) {
  return useQuery({
    queryKey: ["reco", "post-exposure-history", postId, days],
    queryFn: () => fetchApi<PostExposureHistory>(`${BASE}/content/${postId}/exposure-history?days=${days}`),
    enabled: Boolean(postId),
  });
}

/* ------------------------------------------------------------------- users */

export function useUsersOverview(params: { search?: string; coldStart?: string; limit?: number; offset?: number }) {
  const search = new URLSearchParams();
  if (params.search) search.set("search", params.search);
  if (params.coldStart) search.set("coldStart", params.coldStart);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  return useQuery({
    queryKey: ["reco", "users-overview", params.search ?? null, params.coldStart ?? "all", params.limit ?? 25, params.offset ?? 0],
    queryFn: () => fetchApi<PagedRows<UserOverviewRow>>(`${BASE}/users?${search.toString()}`),
  });
}

export function useViewerControls(identityId: string | null, surface: string) {
  return useQuery({
    queryKey: ["reco", "viewer-controls", identityId, surface],
    queryFn: () => fetchApi<{ rows: ViewerControlRow[] }>(`${BASE}/viewer-controls/${identityId}?surface=${surface}`),
    enabled: Boolean(identityId),
  });
}

/* -------------------------------------------------------------- identities */

export function useIdentityStats(identityId: string | null, days = 30) {
  return useQuery({
    queryKey: ["reco", "identity-stats", identityId, days],
    queryFn: () => fetchApi<IdentityStats>(`${BASE}/identities/${identityId}/stats?days=${days}`),
    enabled: Boolean(identityId),
  });
}

/* ----------------------------------------------------------- interventions */

export function useInterventions(includeExpired = false) {
  return useQuery({
    queryKey: ["reco", "interventions", includeExpired],
    queryFn: () => fetchApi<InterventionRow[]>(`${BASE}/interventions?includeExpired=${includeExpired}`),
  });
}

/* ------------------------------------------------------------- experiments */

export function useExperiments() {
  return useQuery({
    queryKey: ["reco", "experiments"],
    queryFn: () => fetchApi<ExperimentRow[]>(`${BASE}/experiments`),
  });
}

/* ---------------------------------------------------------------- mutations */

export function useInvalidateReco() {
  const qc = useQueryClient();
  return (keys?: string[]) => {
    if (keys?.length) {
      for (const key of keys) void qc.invalidateQueries({ queryKey: ["reco", key] });
    } else {
      void qc.invalidateQueries({ queryKey: ["reco"] });
    }
  };
}

export function useValidateConfig() {
  return useMutation({
    mutationFn: (config: unknown) =>
      fetchApi<ConfigValidationResponse>(`${BASE}/config/validate`, {
        method: "POST",
        body: JSON.stringify({ config }),
      }),
  });
}

export function useCreateDraft() {
  const invalidate = useInvalidateReco();
  return useMutation({
    mutationFn: (dto: { label: string; config: unknown; notes?: string }) =>
      fetchApi<ConfigVersion>(`${BASE}/config`, { method: "POST", body: JSON.stringify(dto) }),
    onSuccess: () => invalidate(["config-history", "overview"]),
  });
}

export function useActivateConfig() {
  const invalidate = useInvalidateReco();
  return useMutation({
    mutationFn: (dto: { versionId: string; note?: string; rollback?: boolean }) =>
      fetchApi<unknown>(`${BASE}/config/${dto.versionId}/activate`, {
        method: "POST",
        body: JSON.stringify({ note: dto.note, rollback: dto.rollback }),
      }),
    onSuccess: () => invalidate(["overview", "config-history", "debug-ranking", "exposure-overview"]),
  });
}

export function useCreateIntervention() {
  const invalidate = useInvalidateReco();
  return useMutation({
    mutationFn: (dto: {
      scope: "post" | "identity";
      scopeId: string;
      kind: "boost" | "suppress";
      multiplier: number;
      reason: string;
      expiresAt: string;
      surface?: "feed" | "shorts" | "search";
    }) =>
      fetchApi<InterventionRow>(`${BASE}/interventions`, {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidate(["interventions", "overview"]),
  });
}

export function useRevokeIntervention() {
  const invalidate = useInvalidateReco();
  return useMutation({
    mutationFn: (dto: { id: string; note?: string }) =>
      fetchApi<unknown>(`${BASE}/interventions/${dto.id}/revoke`, {
        method: "POST",
        body: JSON.stringify({ note: dto.note }),
      }),
    onSuccess: () => invalidate(["interventions", "overview"]),
  });
}

export function useSetViewerControls() {
  const invalidate = useInvalidateReco();
  return useMutation({
    mutationFn: (dto: {
      identityId: string;
      surface?: "feed" | "shorts" | "search" | null;
      controls: Record<string, unknown>;
      reason: string;
      expiresAt: string;
    }) =>
      fetchApi<ViewerControlRow>(`${BASE}/viewer-controls`, {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: (_data, variables) => {
      invalidate(["viewer-controls", "users-overview"]);
      void variables;
    },
  });
}

export function useRevokeViewerControls() {
  const invalidate = useInvalidateReco();
  return useMutation({
    mutationFn: (dto: { identityId: string; surface?: "feed" | "shorts" | "search" | null; note?: string }) =>
      fetchApi<unknown>(`${BASE}/viewer-controls/revoke`, {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidate(["viewer-controls", "users-overview"]),
  });
}

export function useCreateExperiment() {
  const invalidate = useInvalidateReco();
  return useMutation({
    mutationFn: (dto: {
      name: string;
      description?: string;
      surface: "feed" | "shorts" | "search";
      variantVersionId: string;
      variantPercent: number;
    }) =>
      fetchApi<ExperimentRow>(`${BASE}/experiments`, {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidate(["experiments"]),
  });
}

export function useStartExperiment() {
  const invalidate = useInvalidateReco();
  return useMutation({
    mutationFn: (experimentId: string) =>
      fetchApi<ExperimentRow>(`${BASE}/experiments/start`, {
        method: "POST",
        body: JSON.stringify({ experimentId }),
      }),
    onSuccess: () => invalidate(["experiments", "overview"]),
  });
}

export function useStopExperiment() {
  const invalidate = useInvalidateReco();
  return useMutation({
    mutationFn: (dto: { experimentId: string; reason?: string }) =>
      fetchApi<ExperimentRow>(`${BASE}/experiments/stop`, {
        method: "POST",
        body: JSON.stringify(dto),
      }),
    onSuccess: () => invalidate(["experiments", "overview"]),
  });
}

export function useRebuild() {
  const invalidate = useInvalidateReco();
  return useMutation({
    mutationFn: () => fetchApi<unknown>(`${BASE}/rebuild`, { method: "POST" }),
    onSuccess: () => invalidate(["overview", "debug-user", "debug-content", "content-stats"]),
  });
}
