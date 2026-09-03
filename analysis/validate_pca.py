"""Valida se PCA preserva informação suficiente para recomendar músicas."""

from pathlib import Path
import sys

import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.data.loader import AUDIO_FEATURES, load_tracks

REPORT = ROOT / "analysis" / "PCA_VALIDATION.md"
RANDOM_STATE = 42


def neighborhood_overlap(full: np.ndarray, reduced: np.ndarray, neighbors: int = 10) -> float:
    full_ids = NearestNeighbors(n_neighbors=neighbors + 1).fit(full).kneighbors(return_distance=False)[:, 1:]
    reduced_ids = NearestNeighbors(n_neighbors=neighbors + 1).fit(reduced).kneighbors(return_distance=False)[:, 1:]
    return float(np.mean([len(set(a) & set(b)) / neighbors for a, b in zip(full_ids, reduced_ids)]))


def main() -> None:
    frame = load_tracks()
    values = frame[AUDIO_FEATURES].astype(float)
    standardized = StandardScaler().fit_transform(values)
    pca = PCA(random_state=RANDOM_STATE).fit(standardized)
    cumulative = np.cumsum(pca.explained_variance_ratio_)
    thresholds = {target: int(np.searchsorted(cumulative, target) + 1) for target in (0.80, 0.90, 0.95)}

    rng = np.random.default_rng(RANDOM_STATE)
    sample_ids = rng.choice(len(standardized), size=min(2000, len(standardized)), replace=False)
    sample = standardized[sample_ids]
    reduced_2 = pca.transform(sample)[:, :2]
    reduced_90 = pca.transform(sample)[:, : thresholds[0.90]]
    reconstructed_2 = reduced_2 @ pca.components_[:2] + pca.mean_

    loadings = pd.DataFrame(pca.components_[:3].T, index=AUDIO_FEATURES, columns=["PC1", "PC2", "PC3"])
    strongest = {
        column: ", ".join(f"{name} ({loadings.loc[name, column]:+.3f})" for name in loadings[column].abs().nlargest(5).index)
        for column in loadings.columns
    }
    high_correlations = []
    corr = values.corr(numeric_only=True)
    for i, left in enumerate(AUDIO_FEATURES):
        for right in AUDIO_FEATURES[i + 1:]:
            value = float(corr.loc[left, right])
            if abs(value) >= 0.50:
                high_correlations.append((left, right, value))
    high_correlations.sort(key=lambda item: abs(item[2]), reverse=True)

    two_variance = float(cumulative[1])
    overlap_2 = neighborhood_overlap(sample, reduced_2)
    overlap_90 = neighborhood_overlap(sample, reduced_90)
    reconstruction_mse = float(np.mean((sample - reconstructed_2) ** 2))
    verdict = "não é adequada" if two_variance < 0.70 or overlap_2 < 0.60 else "é aceitável"

    lines = [
        "# Validação do PCA",
        "",
        f"Dados avaliados: **{len(frame):,} faixas**, com **{len(AUDIO_FEATURES)} variáveis padronizadas**.",
        "",
        "## Resultado executivo",
        "",
        f"A projeção em apenas duas componentes **{verdict} como espaço principal do recomendador**. "
        f"Ela explica **{two_variance:.1%}** da variância e preserva **{overlap_2:.1%}** dos 10 vizinhos mais próximos.",
        f"Com {thresholds[0.90]} componentes, a preservação sobe para **{overlap_90:.1%}**. "
        "Por isso, o recomendador principal deve manter o espaço completo padronizado ou usar o número de componentes necessário para pelo menos 90% da variância; duas componentes servem para visualização.",
        "",
        "## Variância explicada",
        "",
        f"- PC1: {pca.explained_variance_ratio_[0]:.2%}",
        f"- PC2: {pca.explained_variance_ratio_[1]:.2%}",
        f"- PC1 + PC2: {two_variance:.2%}",
        f"- Componentes para 80%: {thresholds[0.80]}",
        f"- Componentes para 90%: {thresholds[0.90]}",
        f"- Componentes para 95%: {thresholds[0.95]}",
        f"- Erro médio de reconstrução com 2 PCs: {reconstruction_mse:.4f}",
        "",
        "## Preservação da recomendação",
        "",
        f"- Sobreposição média dos 10 vizinhos, 2 PCs: {overlap_2:.2%}",
        f"- Sobreposição média dos 10 vizinhos, PCA 90%: {overlap_90:.2%}",
        "",
        "## Variáveis mais influentes",
        "",
        *[f"- {component}: {description}" for component, description in strongest.items()],
        "",
        "## Correlações relevantes",
        "",
        *([f"- `{left}` x `{right}`: {value:+.3f}" for left, right, value in high_correlations] or ["- Nenhum par apresentou |correlação| >= 0,50."]),
        "",
        "## Critérios",
        "",
        "- As variáveis são padronizadas antes do PCA para impedir que duração, BPM ou loudness dominem apenas por escala.",
        "- Variância explicada avalia compressão global; não garante recomendações corretas sozinha.",
        "- A sobreposição de vizinhos mede diretamente quanto a redução altera o resultado do KNN.",
        "- O teste usa amostra determinística (`random_state=42`) para ser reproduzível.",
    ]
    REPORT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Relatório gerado em {REPORT}")


if __name__ == "__main__":
    main()
