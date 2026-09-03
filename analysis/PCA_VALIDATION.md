# Validação do PCA

Dados avaliados: **89,740 faixas**, com **14 variáveis padronizadas**.

## Resultado executivo

A projeção em apenas duas componentes **não é adequada como espaço principal do recomendador**. Ela explica **32.3%** da variância e preserva **5.3%** dos 10 vizinhos mais próximos.
Com 11 componentes, a preservação sobe para **69.0%**. Por isso, o recomendador principal deve manter o espaço completo padronizado ou usar o número de componentes necessário para pelo menos 90% da variância; duas componentes servem para visualização.

## Variância explicada

- PC1: 21.34%
- PC2: 10.99%
- PC1 + PC2: 32.33%
- Componentes para 80%: 9
- Componentes para 90%: 11
- Componentes para 95%: 12
- Erro médio de reconstrução com 2 PCs: 0.6708

## Preservação da recomendação

- Sobreposição média dos 10 vizinhos, 2 PCs: 5.30%
- Sobreposição média dos 10 vizinhos, PCA 90%: 69.04%

## Variáveis mais influentes

- PC1: loudness (+0.501), energy (+0.490), acousticness (-0.423), valence (+0.294), instrumentalness (-0.273)
- PC2: valence (+0.475), danceability (+0.458), duration_ms (-0.389), instrumentalness (-0.335), acousticness (+0.334)
- PC3: liveness (+0.652), speechiness (+0.552), time_signature (-0.259), danceability (-0.217), instrumentalness (-0.210)

## Correlações relevantes

- `energy` x `loudness`: +0.759
- `energy` x `acousticness`: -0.733
- `loudness` x `acousticness`: -0.583

## Critérios

- As variáveis são padronizadas antes do PCA para impedir que duração, BPM ou loudness dominem apenas por escala.
- Variância explicada avalia compressão global; não garante recomendações corretas sozinha.
- A sobreposição de vizinhos mede diretamente quanto a redução altera o resultado do KNN.
- O teste usa amostra determinística (`random_state=42`) para ser reproduzível.
