from pydantic import BaseModel


class SongSearchResult(BaseModel):
    artist: str
    song: str


class RecommendedTrackOut(BaseModel):
    name: str
    artist: str
    spotify_url: str
    distance: float


class GenreListResponse(BaseModel):
    genres: list[str]


class MoodListResponse(BaseModel):
    moods: list[str]

class RecommendedArtistOut(BaseModel):
    artist: str
    distance: float