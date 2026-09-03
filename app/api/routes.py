from fastapi import APIRouter, HTTPException, Query

from app.models import GenreListResponse, MoodListResponse, RecommendedTrackOut, SongSearchResult
from app.services.recommender import (
    RecommendedTrack,
    list_genres,
    list_moods,
    recommend_by_artist,
    recommend_by_genre,
    recommend_by_mood,
    recommend_music,
    search_songs,
    tracks_by_artist,
)

router = APIRouter(prefix="/api")


def _to_out(track: RecommendedTrack) -> RecommendedTrackOut:
    return RecommendedTrackOut(
        name=track.name,
        artist=track.artists,
        spotify_url=track.spotify_url,
        distance=track.distance,
        audio_features=track.audio_features,
    )


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/songs/search", response_model=list[SongSearchResult])
def songs_search(
    q: str = Query(..., min_length=1),
    by: str = Query("song", pattern="^(song|artist)$"),
    limit: int = Query(20, ge=1, le=100),
):
    return search_songs(q, by=by, limit=limit)


@router.get("/genres", response_model=GenreListResponse)
def genres():
    return GenreListResponse(genres=list_genres())


@router.get("/moods", response_model=MoodListResponse)
def moods():
    return MoodListResponse(moods=list_moods())


@router.get("/recommendations", response_model=list[RecommendedTrackOut])
def recommendations(
    song: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
):
    tracks = recommend_music(song, limit=limit)
    if not tracks:
        raise HTTPException(status_code=404, detail="Song not found in dataset")
    return [_to_out(track) for track in tracks]


@router.get("/recommendations/by-artist", response_model=list[RecommendedTrackOut])
def recommendations_by_artist(
    artist: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
):
    tracks = recommend_by_artist(artist, limit=limit)
    if not tracks:
        raise HTTPException(status_code=404, detail="Artist not found in dataset")
    return [_to_out(track) for track in tracks]


@router.get("/tracks/by-artist", response_model=list[RecommendedTrackOut])
def artist_tracks(
    artist: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
):
    tracks = tracks_by_artist(artist, limit=limit)
    if not tracks:
        raise HTTPException(status_code=404, detail="Artist not found in dataset")
    return [_to_out(track) for track in tracks]


@router.get("/recommendations/by-genre", response_model=list[RecommendedTrackOut])
def recommendations_by_genre(
    genre: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
):
    tracks = recommend_by_genre(genre, limit=limit)
    if not tracks:
        raise HTTPException(status_code=404, detail="Genre not found. See GET /api/genres for valid values.")
    return [_to_out(track) for track in tracks]


@router.get("/recommendations/by-mood", response_model=list[RecommendedTrackOut])
def recommendations_by_mood(
    mood: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
):
    tracks = recommend_by_mood(mood, limit=limit)
    if not tracks:
        raise HTTPException(status_code=404, detail="Mood not recognized. See GET /api/moods for valid values.")
    return [_to_out(track) for track in tracks]
