import type { MoodListResponse, RecommendedTrackOut, SongSearchResult } from './types';

export type RecommenderErrorKind = 'network' | 'not-found' | 'server' | 'unknown';

export class RecommenderError extends Error {
  kind: RecommenderErrorKind;
  status?: number;

  constructor(message: string, kind: RecommenderErrorKind, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

export interface RecommenderClientConfig {
  baseUrl: string;
}

async function request<T>(config: RecommenderClientConfig, path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl.replace(/\/$/, '')}${path}`);
  } catch {
    throw new RecommenderError('Could not reach the recommender server', 'network');
  }

  if (response.status === 404) {
    const body = await response.json().catch(() => null);
    throw new RecommenderError(body?.detail ?? 'Not found', 'not-found', 404);
  }
  if (!response.ok) throw new RecommenderError(`Server error (${response.status})`, 'server', response.status);

  return (await response.json()) as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export function createRecommenderClient(config: RecommenderClientConfig) {
  return {
    config,

    checkHealth: () => request<{ status: string }>(config, '/api/health'),

    searchSongs: (q: string, by: 'song' | 'artist' = 'song', limit = 20) =>
      request<SongSearchResult[]>(config, `/api/songs/search${qs({ q, by, limit })}`),

    listMoods: () => request<MoodListResponse>(config, '/api/moods'),

    getRecommendationsBySong: (song: string, limit = 20) =>
      request<RecommendedTrackOut[]>(config, `/api/recommendations${qs({ song, limit })}`),

    getRecommendationsByArtist: (artist: string, limit = 20) =>
      request<RecommendedTrackOut[]>(config, `/api/recommendations/by-artist${qs({ artist, limit })}`),

    getTracksByArtist: (artist: string, limit = 20) =>
      request<RecommendedTrackOut[]>(config, `/api/tracks/by-artist${qs({ artist, limit })}`),

    getRecommendationsByMood: (mood: string, limit = 20) =>
      request<RecommendedTrackOut[]>(config, `/api/recommendations/by-mood${qs({ mood, limit })}`),
  };
}

export type RecommenderClient = ReturnType<typeof createRecommenderClient>;
