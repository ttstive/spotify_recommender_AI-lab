// Types for the Python FastAPI recommender service (`app/api/routes.py`).
// Field names are copied verbatim from `app/models.py`.

export interface SongSearchResult {
  artist: string;
  song: string;
}

export interface RecommendedTrackOut {
  name: string;
  artist: string;
  spotify_url: string;
  distance: number;
}

export interface MoodListResponse {
  moods: string[];
}
