from dataclasses import dataclass
from functools import lru_cache

import numpy as np
import pandas as pd
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

from app.data.loader import AUDIO_FEATURES, load_clustered_tracks, load_tracks
from app.models import SongSearchResult

MOOD_TARGETS: dict[str, dict[str, float]] = {
    "happy": {"valence": 0.80, "energy": 0.70, "danceability": 0.70, "acousticness": 0.20, "tempo": 120, "loudness": -6},
    "sad": {"valence": 0.15, "energy": 0.25, "danceability": 0.35, "acousticness": 0.60, "tempo": 75, "loudness": -12},
    "energetic": {"valence": 0.60, "energy": 0.90, "danceability": 0.70, "acousticness": 0.10, "tempo": 135, "loudness": -4},
    "calm": {"valence": 0.50, "energy": 0.20, "danceability": 0.40, "acousticness": 0.70, "tempo": 80, "loudness": -14},
    "romantic": {"valence": 0.55, "energy": 0.35, "danceability": 0.45, "acousticness": 0.50, "tempo": 90, "loudness": -9},
    "angry": {"valence": 0.20, "energy": 0.85, "danceability": 0.50, "acousticness": 0.05, "tempo": 140, "loudness": -4},
    "focused": {"valence": 0.40, "energy": 0.35, "danceability": 0.40, "acousticness": 0.60, "tempo": 100, "loudness": -11},
}


@dataclass
class RecommendedTrack:
    name: str
    artists: str
    spotify_url: str
    distance: float


@dataclass
class _Catalog:
    frame: pd.DataFrame
    matrix: np.ndarray
    model: NearestNeighbors
    name_col: str
    artist_col: str
    id_col: str
    scaler: StandardScaler | None = None

@dataclass
class _ArtistCatalog:
    artists: list[str]
    matrix: np.ndarray
    model: NearestNeighbors

def _spotify_url(track_id: str) -> str:
    return f"https://open.spotify.com/track/{track_id}"


def _build_main_catalog() -> _Catalog:
    df = load_tracks()
    scaler = StandardScaler()
    matrix = scaler.fit_transform(df[AUDIO_FEATURES])
    model = NearestNeighbors(metric="euclidean").fit(matrix)
    return _Catalog(
        frame=df,
        matrix=matrix,
        model=model,
        name_col="track_name",
        artist_col="artists",
        id_col="track_id",
        scaler=scaler,
    )

def _build_artist_catalog(main: _Catalog) -> _ArtistCatalog:
    artist_vectors: dict[str, list[np.ndarray]] = {}

    for idx, row in main.frame.iterrows():
        artist_cell = row[main.artist_col]

        for artist in artist_cell.split(";"):
            artist = artist.strip()
            if not artist:
                continue

            artist_vectors.setdefault(artist, []).append(main.matrix[idx])

    artists = sorted(artist_vectors.keys())

    matrix = np.vstack([
        np.mean(artist_vectors[artist], axis=0)
        for artist in artists
    ])

    model = NearestNeighbors(metric="euclidean").fit(matrix)

    return _ArtistCatalog(
        artists=artists,
        matrix=matrix,
        model=model,
    )

def _build_clustered_catalog() -> _Catalog:
    df = load_clustered_tracks()
    matrix = df[["0", "1"]].to_numpy()
    model = NearestNeighbors(metric="euclidean").fit(matrix)
    return _Catalog(
        frame=df,
        matrix=matrix,
        model=model,
        name_col="title",
        artist_col="artist",
        id_col="id",
    )


@lru_cache
def _catalogs() -> tuple[_Catalog, _Catalog]:
    return _build_main_catalog(), _build_clustered_catalog()

@lru_cache
def _artist_catalog() -> _ArtistCatalog:
    main, _ = _catalogs()

    artist_vectors: dict[str, list[np.ndarray]] = {}

    for idx, row in main.frame.iterrows():
        artist_cell = row[main.artist_col]

        for artist in artist_cell.split(";"):
            artist = artist.strip()

            if not artist:
                continue

            artist_vectors.setdefault(artist, []).append(
                main.matrix[idx]
            )

    artists = sorted(artist_vectors.keys())

    matrix = np.vstack([
        np.mean(artist_vectors[artist], axis=0)
        for artist in artists
    ])

    model = NearestNeighbors(
        metric="euclidean"
    ).fit(matrix)

    return _ArtistCatalog(
        artists=artists,
        matrix=matrix,
        model=model,
    )

def warm_cache() -> None:
    """Fit both KNN models eagerly so the first request isn't slow."""
    _catalogs()


def _match_column(catalog: _Catalog, by: str) -> str:
    return catalog.name_col if by == "song" else catalog.artist_col


def search_songs(query: str, by: str = "song", limit: int = 20) -> list[SongSearchResult]:
    q = query.strip().lower()
    if not q:
        return []

    results: list[SongSearchResult] = []
    seen: set[tuple[str, str]] = set()

    main, clustered = _catalogs()

    main_matches = main.frame[main.frame[_match_column(main, by)].str.lower().str.contains(q, na=False, regex=False)]
    main_matches = main_matches.sort_values("popularity", ascending=False)
    for _, row in main_matches.iterrows():
        key = (row[main.artist_col].lower(), row[main.name_col].lower())
        if key in seen:
            continue
        seen.add(key)
        results.append(SongSearchResult(artist=row[main.artist_col], song=row[main.name_col]))
        if len(results) >= limit:
            return results

    clustered_matches = clustered.frame[
        clustered.frame[_match_column(clustered, by)].str.lower().str.contains(q, na=False, regex=False)
    ]
    for _, row in clustered_matches.iterrows():
        key = (row[clustered.artist_col].lower(), row[clustered.name_col].lower())
        if key in seen:
            continue
        seen.add(key)
        results.append(SongSearchResult(artist=row[clustered.artist_col], song=row[clustered.name_col]))
        if len(results) >= limit:
            return results

    return results


def list_genres() -> list[str]:
    main, _ = _catalogs()
    return sorted(main.frame["track_genre"].dropna().unique().tolist())


def list_moods() -> list[str]:
    return sorted(MOOD_TARGETS.keys())


def _find_index(catalog: _Catalog, song: str) -> int | None:
    matches = catalog.frame.index[catalog.frame[catalog.name_col].str.lower() == song.strip().lower()]
    if len(matches) == 0:
        return None
    if len(matches) == 1:
        return int(matches[0])
    if "popularity" in catalog.frame.columns:
        return int(catalog.frame.loc[matches, "popularity"].idxmax())
    return int(matches[0])


def _artist_rows(main: _Catalog, artist: str) -> pd.DataFrame:
    q = artist.strip().lower()

    def matches(cell: str) -> bool:
        return any(name.strip().lower() == q for name in cell.split(";"))

    mask = main.frame[main.artist_col].apply(matches)
    if not mask.any():
        mask = main.frame[main.artist_col].str.lower().str.contains(q, na=False, regex=False)
    return main.frame[mask]


def _mood_vector(main: _Catalog, mood: str) -> np.ndarray | None:
    targets = MOOD_TARGETS.get(mood.strip().lower())
    if targets is None:
        return None

    raw = main.frame[AUDIO_FEATURES].mean()
    for feature, value in targets.items():
        raw[feature] = value

    return main.scaler.transform([raw[AUDIO_FEATURES].to_numpy()])[0]


def _recommend_from_vector(
    catalog: _Catalog, vector: np.ndarray, exclude: set[int], limit: int
) -> list[RecommendedTrack]:
    n_neighbors = min(limit + len(exclude), len(catalog.frame))
    distances, indices = catalog.model.kneighbors(vector.reshape(1, -1), n_neighbors=n_neighbors)

    recommendations: list[RecommendedTrack] = []
    for dist, neighbor_idx in zip(distances[0], indices[0]):
        if neighbor_idx in exclude:
            continue
        row = catalog.frame.iloc[neighbor_idx]
        recommendations.append(
            RecommendedTrack(
                name=row[catalog.name_col],
                artists=row[catalog.artist_col],
                spotify_url=_spotify_url(row[catalog.id_col]),
                distance=float(dist),
            )
        )
        if len(recommendations) >= limit:
            break

    return recommendations


def recommend_music(song: str, limit: int = 10) -> list[RecommendedTrack]:
    main, clustered = _catalogs()

    catalog = main
    idx = _find_index(catalog, song)
    if idx is None:
        catalog = clustered
        idx = _find_index(catalog, song)
    if idx is None:
        return []

    return _recommend_from_vector(catalog, catalog.matrix[idx], {idx}, limit)


def recommend_by_artist(artist: str, limit: int = 10) -> list[RecommendedTrack]:
    main, _ = _catalogs()
    rows = _artist_rows(main, artist)
    if rows.empty:
        return []

    positions = rows.index.to_numpy()
    vector = main.matrix[positions].mean(axis=0)
    return _recommend_from_vector(main, vector, set(positions), limit)

def recommend_similar_artists(
    artist: str,
    limit: int = 10,
) -> list[tuple[str, float]]:
    main, _ = _catalogs()
    artist_catalog = _artist_catalog()

    rows = _artist_rows(main, artist)

    if rows.empty:
        return []

    positions = rows.index.to_numpy()

    vector = main.matrix[positions].mean(axis=0)

    distances, indices = artist_catalog.model.kneighbors(
        vector.reshape(1, -1),
        n_neighbors=min(
            limit + 1,
            len(artist_catalog.artists),
        ),
    )

    source_artists = {
        name.strip().lower()
        for cell in rows[main.artist_col]
        for name in cell.split(";")
        if name.strip()
    }

    recommendations: list[tuple[str, float]] = []

    for distance, index in zip(
        distances[0],
        indices[0],
    ):
        candidate = artist_catalog.artists[index]

        if candidate.strip().lower() in source_artists:
            continue

        recommendations.append(
            (candidate, float(distance))
        )

        if len(recommendations) >= limit:
            break

    return recommendations

def recommend_by_genre(genre: str, limit: int = 10) -> list[RecommendedTrack]:
    main, _ = _catalogs()
    rows = main.frame[main.frame["track_genre"].str.lower() == genre.strip().lower()]
    if rows.empty:
        return []

    vector = main.matrix[rows.index.to_numpy()].mean(axis=0)
    return _recommend_from_vector(main, vector, set(), limit)


def recommend_by_mood(mood: str, limit: int = 10) -> list[RecommendedTrack]:
    main, _ = _catalogs()
    vector = _mood_vector(main, mood)
    if vector is None:
        return []

    return _recommend_from_vector(main, vector, set(), limit)
