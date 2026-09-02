"""MCP server for the Music Recommender API.

Exposes playlist-generation tools (by song, artist, genre, or mood) to MCP clients.
This process is a thin HTTP client of the FastAPI app in app/main.py -- it does not
import anything from app/ directly, so the two stay independently runnable. Point it
at a non-default API instance via the MUSIC_API_BASE_URL environment variable.
"""

import json
from enum import Enum

from mcp.server.mcpserver import MCPServer
from mcp.types import ToolAnnotations
from pydantic import BaseModel, ConfigDict, Field

from mcp_server.client import api_get, format_api_error

mcp = MCPServer("music_recommender_mcp")


def _read_only_annotations(title: str) -> ToolAnnotations:
    return ToolAnnotations(
        title=title,
        read_only_hint=True,
        destructive_hint=False,
        idempotent_hint=True,
        open_world_hint=True,
    )


class SearchBy(str, Enum):
    SONG = "song"
    ARTIST = "artist"


class SearchSongInput(BaseModel):
    """Input for recommender_search_song."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    query: str = Field(
        ...,
        description="Text to search for, e.g. 'yellow' or 'coldplay'",
        min_length=1,
        max_length=200,
    )
    by: SearchBy = Field(
        default=SearchBy.SONG,
        description="Whether to match against song titles ('song') or artist names ('artist')",
    )
    limit: int = Field(default=20, description="Maximum number of results to return", ge=1, le=100)

class SimilarArtistsInput(BaseModel):
    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid",
    )

    artist: str = Field(
        ...,
        description="Exact artist name to find similar artists for",
        min_length=1,
        max_length=200,
    )

    limit: int = Field(
        default=10,
        description="Maximum number of similar artists to return",
        ge=1,
        le=50,
    )

@mcp.tool(
    name="recommender_search_song",
    annotations=_read_only_annotations("Search Songs"),
)
async def recommender_search_song(params: SearchSongInput) -> str:
    """Search the music dataset for songs by title or artist name.

    Use this to confirm a song or artist exists in the database -- and to find its
    exact spelling -- before calling recommender_create_playlist with
    seed_type="song" or seed_type="artist". Does NOT create or modify anything.

    Args:
        params (SearchSongInput): validated input containing:
            - query (str): search text, matched as a case-insensitive substring
            - by ("song"|"artist"): whether to match song titles or artist names
            - limit (int): maximum results, 1-100 (default 20)

    Returns:
        str: JSON list of {"artist": str, "song": str} matches, most popular first, or
        a plain-text message if nothing matched.

    Examples:
        - "Is 'Yellow' by Coldplay in the database?" -> query="yellow", by="song"
        - "What songs does Coldplay have?" -> query="coldplay", by="artist"
        - Don't use when: you already know the exact song/artist name and just want
          recommendations -- call recommender_create_playlist directly instead.
    """
    try:
        data = await api_get(
            "/songs/search",
            params={"q": params.query, "by": params.by.value, "limit": params.limit},
        )
    except Exception as exc:
        return format_api_error(exc, not_found_hint="search failed")

    if not data:
        return f"No songs found matching '{params.query}'."
    return json.dumps(data, indent=2)


@mcp.tool(
    name="recommender_list_genres",
    annotations=_read_only_annotations("List Genres"),
)
async def recommender_list_genres() -> str:
    """List every genre available for recommender_create_playlist(seed_type="genre").

    Call this first if you're not sure a genre exists or how it's spelled (e.g.
    "hip-hop" vs "hip hop") -- the dataset uses one fixed, lowercase spelling per
    genre.

    Returns:
        str: JSON list of genre strings, e.g. ["acoustic", "k-pop", "techno", ...].
    """
    try:
        data = await api_get("/genres")
    except Exception as exc:
        return format_api_error(exc, not_found_hint="could not list genres")
    return json.dumps(data["genres"], indent=2)


@mcp.tool(
    name="recommender_list_moods",
    annotations=_read_only_annotations("List Moods"),
)
async def recommender_list_moods() -> str:
    """List every mood available for recommender_create_playlist(seed_type="mood").

    Returns:
        str: JSON list of mood strings, e.g. ["happy", "sad", "energetic", "calm",
        "romantic", "angry", "focused"].
    """
    try:
        data = await api_get("/moods")
    except Exception as exc:
        return format_api_error(exc, not_found_hint="could not list moods")
    return json.dumps(data["moods"], indent=2)

@mcp.tool(
    name="recommender_find_similar_artists",
    annotations=_read_only_annotations("Find Similar Artists"),
)
async def recommender_find_similar_artists(
    params: SimilarArtistsInput,
) -> str:
    """Find artists with a similar musical profile.

    Uses the Music Recommender API to compare the average audio-feature
    profile of the requested artist against profiles of other artists.

    Returns:
        JSON list of artists ranked by musical distance.
    """
    try:
        data = await api_get(
            "/recommendations/similar-artists",
            params={
                "artist": params.artist,
                "limit": params.limit,
            },
        )
    except Exception as exc:
        return format_api_error(
            exc,
            not_found_hint=(
                "artist not found in the database. "
                "Call recommender_search_song with by='artist' first."
            ),
        )

    if not data:
        return f"No similar artists found for '{params.artist}'."

    return json.dumps(data, indent=2)

class SeedType(str, Enum):
    SONG = "song"
    ARTIST = "artist"
    GENRE = "genre"
    MOOD = "mood"


_SEED_ENDPOINTS: dict[SeedType, tuple[str, str]] = {
    SeedType.SONG: ("/recommendations", "song"),
    SeedType.ARTIST: ("/recommendations/by-artist", "artist"),
    SeedType.GENRE: ("/recommendations/by-genre", "genre"),
    SeedType.MOOD: ("/recommendations/by-mood", "mood"),
}

_NOT_FOUND_HINTS: dict[SeedType, str] = {
    SeedType.SONG: "song not found in the database. Call recommender_search_song first to confirm the exact title.",
    SeedType.ARTIST: "artist not found in the database. Call recommender_search_song with by='artist' first.",
    SeedType.GENRE: "genre not recognized. Call recommender_list_genres to see valid values.",
    SeedType.MOOD: "mood not recognized. Call recommender_list_moods to see valid values.",
}


class CreatePlaylistInput(BaseModel):
    """Input for recommender_create_playlist."""

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    seed_type: SeedType = Field(
        ..., description="What kind of seed to build the playlist from: 'song', 'artist', 'genre', or 'mood'"
    )
    seed: str = Field(
        ...,
        description=(
            "The seed value: an exact song title, an artist name, a genre "
            "(see recommender_list_genres), or a mood (see recommender_list_moods)"
        ),
        min_length=1,
        max_length=200,
    )
    size: int = Field(default=15, description="Number of tracks in the playlist", ge=1, le=50)


@mcp.tool(
    name="recommender_create_playlist",
    annotations=_read_only_annotations("Create Playlist"),
)
async def recommender_create_playlist(params: CreatePlaylistInput) -> str:
    """Generate a playlist from a song, artist, genre, or mood seed.

    This returns a ranked track list computed by the Music Recommender API's KNN
    model. It does NOT create or modify a real Spotify playlist or account -- there
    is no Spotify login involved. Each track includes a spotify_url the user can open
    directly.

    Args:
        params (CreatePlaylistInput): validated input containing:
            - seed_type ("song"|"artist"|"genre"|"mood"): which kind of seed to use
            - seed (str): the seed value -- an exact song title, an artist name, a
              genre, or a mood. If unsure of the exact value, call
              recommender_search_song, recommender_list_genres, or
              recommender_list_moods first.
            - size (int): number of tracks to return, 1-50 (default 15)

    Returns:
        str: JSON object with this schema:
        {
            "title": str,          # e.g. "Playlist inspired by Coldplay"
            "seed_type": str,
            "seed": str,
            "tracks": [
                {"name": str, "artist": str, "spotify_url": str, "distance": float}
            ]
        }

        Error response: "Error: <message>", naming which discovery tool to call first.

    Examples:
        - "Make me a playlist like Coldplay" -> seed_type="artist", seed="Coldplay"
        - "Playlist for when I'm feeling sad" -> seed_type="mood", seed="sad"
        - "More songs like Yellow" -> seed_type="song", seed="Yellow"
        - "Give me a techno playlist" -> seed_type="genre", seed="techno"
        - Don't use when: the user wants to search/browse rather than get
          recommendations -- use recommender_search_song instead.
    """
    path, param_name = _SEED_ENDPOINTS[params.seed_type]
    try:
        tracks = await api_get(path, params={param_name: params.seed, "limit": params.size})
    except Exception as exc:
        return format_api_error(exc, not_found_hint=_NOT_FOUND_HINTS[params.seed_type])

    return json.dumps(
        {
            "title": f"Playlist inspired by {params.seed}",
            "seed_type": params.seed_type.value,
            "seed": params.seed,
            "tracks": tracks,
        },
        indent=2,
    )


if __name__ == "__main__":
    mcp.run(transport="stdio")
