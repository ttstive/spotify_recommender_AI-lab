from fastapi import APIRouter, Query, Request

from app.core.response import error_response, success_response
from app.models import RecommendedTrackOut, SongSearchResult
from app.services.recommender import (
    RecommendedTrack,
    list_genres,
    list_moods,
    recommend_by_artist,
    recommend_by_genre,
    recommend_by_mood,
    recommend_music,
    search_songs,
)

router = APIRouter(prefix="/api")


def _to_out(track: RecommendedTrack) -> dict:
    return {
        "name": track.name,
        "artist": track.artists,
        "spotify_url": track.spotify_url,
        "distance": track.distance,
    }


@router.get("/health")
def health(request: Request):
    endpoint = f"{request.url.path}"
    return success_response(
        endpoint=endpoint,
        mcp_tool="health_check",
        data={"status": "ok"},
        message="API está disponível",
        code=200,
    )


@router.get("/songs/search")
def songs_search(
    request: Request,
    q: str = Query(..., min_length=1),
    by: str = Query("song", pattern="^(song|artist)$"),
    limit: int = Query(20, ge=1, le=100),
):
    results = search_songs(q, by=by, limit=limit)
    endpoint = f"{request.url.path}?q={q}&by={by}&limit={limit}"
    
    if not results:
        search_type = "música" if by == "song" else "artista"
        return error_response(
            endpoint=endpoint,
            mcp_tool="search_songs",
            code=404,
            message=f"Nenhuma {search_type} foi encontrada para o termo '{q}'.",
            recommendation=f"Tente outro termo ou acesse /api/songs/search com um valor diferente.",
        )
    
    return success_response(
        endpoint=endpoint,
        mcp_tool="search_songs",
        data=[r.model_dump() for r in results],
        message="Dados obtidos com sucesso",
        code=200,
    )


@router.get("/genres")
def genres(request: Request):
    genres_list = list_genres()
    endpoint = f"{request.url.path}"
    return success_response(
        endpoint=endpoint,
        mcp_tool="list_genres",
        data={"genres": genres_list},
        message="Dados obtidos com sucesso",
        code=200,
    )


@router.get("/moods")
def moods(request: Request):
    moods_list = list_moods()
    endpoint = f"{request.url.path}"
    return success_response(
        endpoint=endpoint,
        mcp_tool="list_moods",
        data={"moods": moods_list},
        message="Dados obtidos com sucesso",
        code=200,
    )


@router.get("/recommendations")
def recommendations(
    request: Request,
    song: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
):
    tracks = recommend_music(song, limit=limit)
    endpoint = f"{request.url.path}?song={song}&limit={limit}"
    
    if not tracks:
        return error_response(
            endpoint=endpoint,
            mcp_tool="recommender_by_song",
            code=404,
            message=f"Nenhuma música foi encontrada para o termo '{song}'.",
            recommendation="Verifique a ortografia ou tente outro nome de música. Use /api/songs/search para explorar o catálogo.",
        )
    
    return success_response(
        endpoint=endpoint,
        mcp_tool="recommender_by_song",
        data=[_to_out(track) for track in tracks],
        message="Recomendações obtidas com sucesso",
        code=200,
    )


@router.get("/recommendations/by-artist")
def recommendations_by_artist(
    request: Request,
    artist: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
):
    tracks = recommend_by_artist(artist, limit=limit)
    endpoint = f"{request.url.path}?artist={artist}&limit={limit}"
    
    if not tracks:
        return error_response(
            endpoint=endpoint,
            mcp_tool="recommender_by_artist",
            code=404,
            message=f"Nenhum artista foi encontrado com o nome '{artist}'.",
            recommendation="Verifique a ortografia ou use /api/songs/search para buscar por artista.",
        )
    
    return success_response(
        endpoint=endpoint,
        mcp_tool="recommender_by_artist",
        data=[_to_out(track) for track in tracks],
        message="Recomendações por artista obtidas com sucesso",
        code=200,
    )


@router.get("/recommendations/by-genre")
def recommendations_by_genre(
    request: Request,
    genre: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
):
    tracks = recommend_by_genre(genre, limit=limit)
    endpoint = f"{request.url.path}?genre={genre}&limit={limit}"
    
    if not tracks:
        return error_response(
            endpoint=endpoint,
            mcp_tool="recommender_by_genre",
            code=404,
            message=f"Gênero '{genre}' não foi localizado no catálogo.",
            recommendation="Use /api/genres para ver os gêneros disponíveis.",
        )
    
    return success_response(
        endpoint=endpoint,
        mcp_tool="recommender_by_genre",
        data=[_to_out(track) for track in tracks],
        message="Recomendações por gênero obtidas com sucesso",
        code=200,
    )


@router.get("/recommendations/by-mood")
def recommendations_by_mood(
    request: Request,
    mood: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
):
    tracks = recommend_by_mood(mood, limit=limit)
    endpoint = f"{request.url.path}?mood={mood}&limit={limit}"
    
    if not tracks:
        return error_response(
            endpoint=endpoint,
            mcp_tool="recommender_by_mood",
            code=404,
            message=f"Mood '{mood}' não foi reconhecido.",
            recommendation="Use /api/moods para ver os moods disponíveis.",
        )
    
    return success_response(
        endpoint=endpoint,
        mcp_tool="recommender_by_mood",
        data=[_to_out(track) for track in tracks],
        message="Recomendações por mood obtidas com sucesso",
        code=200,
    )
