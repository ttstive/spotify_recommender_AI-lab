# Analise exploratoria

Esta pasta concentra os materiais da frente de analise de dados do projeto.

## Objetivo

Destrinchar a base Spotify em profundidade e gerar evidencias, graficos e insights para apoiar:

- notebook de prova de conceito;
- relatorio tecnico;
- apresentacao/Canva;
- justificativa das escolhas do modelo de recomendacao.

## Arquivos

- `spotify_dataset_analysis.ipynb`: notebook principal da analise exploratoria e prova de conceito.

## Perguntas-guia

Antes das perguntas do grupo, o notebook traz uma analise inicial e um raio X aprofundado:

- base bruta vs base limpa;
- duplicidades e dados removidos;
- dicionario de colunas, tipos, nulos e exemplos;
- uso de memoria;
- cobertura por musicas, artistas, albuns, generos e conteudo explicito;
- faixas de popularidade;
- quantis e valores extremos;
- rankings de artistas, albuns e generos;
- perfil medio dos generos por features musicais;
- matriz de correlacao;
- segmentos musicais simples;
- analise do catalogo PCA secundario;
- limitacoes da base.

O notebook tambem inclui uma camada de metodologia robusta para evitar conclusoes frageis:

- comparacao entre media, media aparada e mediana;
- IQR e MAD para medir dispersao;
- quantis para identificar assimetria e extremos;
- auditoria sistematica de correlacoes com Pearson e Spearman;
- auditoria com Kendall Tau para associacoes por ranking;
- ranking das correlacoes mais fortes entre pares de variaveis;
- popularidade por quartis das features;
- popularidade por decis das features para detectar relacoes nao lineares;
- analise de efeito entre faixas baixas e altas;
- teste Kruskal-Wallis para diferenca de popularidade entre generos;
- Mann-Whitney U e Cliff's delta para comparar musicas explicitas e nao explicitas;
- rankings por genero e artista com tamanho minimo de grupo;
- interacoes entre energia, loudness, dancabilidade e valencia;
- diagnostico das variaveis mais adequadas para recomendacao.

- Quantas musicas, artistas e generos existem na base?
- Quais generos aparecem com mais frequencia?
- Como a popularidade se distribui?
- Como features como `energy`, `danceability`, `valence`, `tempo` e `acousticness` se comportam?
- O KNN retorna recomendacoes coerentes nos exemplos escolhidos?

Depois da analise inicial, o notebook responde as perguntas definidas pelo grupo:

| # | Pergunta | Categoria |
|---|---|---|
| 1 | O fator `energy` tem correlacao com dancabilidade? | Similaridade |
| 2 | Quanto menor a duracao da musica, maior a popularidade dela? | Vies |
| 3 | Quanto mais explicita a musica, a popularidade dela e menor? | Vies |
| 4 | Quais sao os artistas mais populares? | Mais escutados |
| 5 | O genero da musica afeta a popularidade dela? | Categorias / Mais populares |
| 6 | Quanto mais energetica uma musica, mais alta ela e? | Similaridade |
| 7 | Musicas acusticas costumam ter valores de `speechiness` e `instrumentalness` relacionados? | Similaridade |
| 8 | Quais sao os generos mais explicitos? | Discrepantes |
| 9 | Dados relacionados a idade dos ouvintes afetariam a percepcao de popularidade? | Demografico / Similaridade |
| 10 | Como saber se uma musica de energia semelhante pode ser parecida com minha musica favorita? | Similaridade |
| 11 | Quais sao as variaveis mais importantes para um sistema de recomendacao? | Correlacao |
