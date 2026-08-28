from functools import lru_cache
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[2] / "files"
TRACKS_CSV = DATA_DIR / "dataset(in).csv"
CLUSTERED_CSV = DATA_DIR / "musicas_recomendadas.csv"

AUDIO_FEATURES = [
    "popularity",
    "duration_ms",
    "danceability",
    "energy",
    "key",
    "loudness",
    "mode",
    "speechiness",
    "acousticness",
    "instrumentalness",
    "liveness",
    "valence",
    "tempo",
    "time_signature",
]


@lru_cache
def load_tracks() -> pd.DataFrame:
    """Primary catalog: Kaggle-style tracks with full audio-feature vectors."""
    df = pd.read_csv(TRACKS_CSV)
    df = df.dropna(subset=["track_name", "artists", "album_name"])
    # Kaggle dump repeats the same track_id once per genre tag it carries.
    df = df.drop_duplicates(subset="track_id", keep="first")
    return df.reset_index(drop=True)


@lru_cache
def load_clustered_tracks() -> pd.DataFrame:
    """Secondary catalog: pre-clustered tracks with only a 2D PCA projection."""
    df = pd.read_csv(CLUSTERED_CSV)
    df = df.dropna(subset=["song", "id"])
    df = df.drop_duplicates(subset="id", keep="first")

    split = df["song"].str.split(" - ", n=1, expand=True)
    df = df.assign(artist=split[0].str.strip(), title=split[1].str.strip())
    df = df.dropna(subset=["artist", "title"])

    return df.reset_index(drop=True)
