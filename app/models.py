from pydantic import BaseModel


class SongSearchResult(BaseModel):
    artist: str
    song: str


class RecommendedTrackOut(BaseModel):
    name: str
    artist: str
    spotify_url: str
    distance: float
    audio_features: dict[str, float] | None = None


class GenreListResponse(BaseModel):
    genres: list[str]


class MoodListResponse(BaseModel):
    moods: list[str]
