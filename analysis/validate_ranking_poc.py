"""Reproducible proof of concept for a popularity-aware recommender.

Run from the repository root:
    uv run python analysis/validate_ranking_poc.py

The script deliberately does not call Spotify or any other live service.  Its
results are a deterministic snapshot of the catalog currently tracked in this
repository.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.cluster import AgglomerativeClustering
from sklearn.metrics import silhouette_score
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

# Permit the documented ``python analysis/…`` invocation from the repository
# root, without requiring users to alter PYTHONPATH.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.data.loader import AUDIO_FEATURES, load_tracks
from app.services.recommender import GENRE_ALIASES


LIMIT = 10
CANDIDATE_POOL = 150
HIERARCHY_SAMPLE_PER_GENRE = 20
HIERARCHY_CLUSTERS = 12


def _print_tracks(title: str, rows: pd.DataFrame, distance: pd.Series) -> None:
    print(f"\n{title}")
    for position, (index, row) in enumerate(rows.head(LIMIT).iterrows(), start=1):
        print(
            f"{position:>2}. {row.track_name} — {row.artists} "
            f"| pop={row.popularity:>3} | dist={distance.loc[index]:.3f}"
        )


def _hierarchy_poc(frame: pd.DataFrame, features: list[str]) -> None:
    # A stratified, fixed-size sample makes Ward clustering inexpensive and
    # repeatable. In production, labels would be calculated offline and saved.
    sample = (
        frame.sort_values("track_id")
        .groupby("track_genre", group_keys=False)
        .head(HIERARCHY_SAMPLE_PER_GENRE)
        .reset_index(drop=True)
    )
    matrix = StandardScaler().fit_transform(sample[features])
    labels = AgglomerativeClustering(n_clusters=HIERARCHY_CLUSTERS, linkage="ward").fit_predict(matrix)
    sample = sample.assign(cluster=labels)
    silhouette = silhouette_score(matrix, labels, sample_size=min(2_000, len(sample)), random_state=42)

    print("\n=== POC: clusterização hierárquica (navegação, não ranking) ===")
    print(f"amostra estratificada: {len(sample)} faixas; clusters: {HIERARCHY_CLUSTERS}; silhouette: {silhouette:.3f}")
    print("clusters e gêneros dominantes:")
    for cluster, group in sample.groupby("cluster"):
        dominant = group["track_genre"].value_counts().head(3)
        description = ", ".join(f"{genre} ({count})" for genre, count in dominant.items())
        print(f"  cluster {cluster:>2}: {len(group):>3} faixas — {description}")


def main() -> None:
    frame = load_tracks().copy()
    audio_only = [feature for feature in AUDIO_FEATURES if feature != "popularity"]

    print("=== Validação do catálogo ===")
    print(f"faixas únicas: {len(frame)}; gêneros: {frame.track_genre.nunique()}")
    print(f"coluna de país/origem disponível: {any('country' in column.lower() or 'origin' in column.lower() for column in frame.columns)}")
    print(f"aliases atuais: {GENRE_ALIASES}")
    print(f"faixas na família rap/trap atual: {(frame.track_genre == 'hip-hop').sum()} (somente tag hip-hop)")

    # Pick a deterministic, well-known seed: the most popular hip-hop track.
    seed_index = frame[frame.track_genre == "hip-hop"].sort_values(
        ["popularity", "track_id"], ascending=[False, True]
    ).index[0]
    seed = frame.loc[seed_index]
    print(f"\nsemente: {seed.track_name} — {seed.artists} | pop={seed.popularity}")

    # Current production behaviour: popularity is included in the standardized
    # audio vector and is then applied once more by the reranker.
    current_matrix = StandardScaler().fit_transform(frame[AUDIO_FEATURES])
    current_distances, current_indices = NearestNeighbors(metric="euclidean").fit(current_matrix).kneighbors(
        current_matrix[seed_index].reshape(1, -1), n_neighbors=CANDIDATE_POOL + 1
    )
    current_candidates = frame.iloc[current_indices[0][1:]].copy()
    current_candidates["distance"] = current_distances[0][1:]
    current_ranked = current_candidates.assign(score=current_candidates.distance - 0.012 * current_candidates.popularity).sort_values("score")

    # Proposed behaviour: the vectors contain only audio characteristics.
    # Popularity generates a separate, explainable ranking over the same
    # relevant candidate pool.
    audio_matrix = StandardScaler().fit_transform(frame[audio_only])
    distances, indices = NearestNeighbors(metric="euclidean").fit(audio_matrix).kneighbors(
        audio_matrix[seed_index].reshape(1, -1), n_neighbors=CANDIDATE_POOL + 1
    )
    candidates = frame.iloc[indices[0][1:]].copy()
    candidates["distance"] = distances[0][1:]
    similarity = candidates.sort_values(["distance", "popularity"], ascending=[True, False])
    popular = candidates.sort_values(["popularity", "distance"], ascending=[False, True])

    _print_tracks("=== ranking atual: popularidade entra duas vezes ===", current_ranked, current_ranked.distance)
    _print_tracks("=== proposta A: mais parecidas (áudio somente) ===", similarity, similarity.distance)
    _print_tracks("=== proposta B: mais escutadas no mesmo universo ===", popular, popular.distance)
    print(
        "\nmédia de popularidade — atual: "
        f"{current_ranked.head(LIMIT).popularity.mean():.1f}; similares: {similarity.head(LIMIT).popularity.mean():.1f}; "
        f"mais escutadas: {popular.head(LIMIT).popularity.mean():.1f}"
    )

    _hierarchy_poc(frame, audio_only)
    print("\nConclusão: país requer enriquecimento externo versionado; os dois rankings e os clusters podem ser pré-calculados e expostos pela API.")


if __name__ == "__main__":
    main()
