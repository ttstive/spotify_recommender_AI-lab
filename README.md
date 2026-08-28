# Spotify Recommender AI Lab

A content-based music recommender: a FastAPI + scikit-learn KNN service, plus an MCP
server so an LLM client (e.g. Claude) can turn a song, artist, genre, or mood into a
generated playlist.

Two local catalogs back the recommendations:
- `files/dataset(in).csv` — ~90k unique tracks (after de-duping) with full audio-feature
  vectors (danceability, energy, tempo, etc.), used to fit a `NearestNeighbors` model
  over standardized features. Also the only catalog with genre labels, used for
  artist/genre/mood-based recommendations.
- `files/musicas_recomendadas.csv` — ~17k tracks already reduced to a 2D PCA projection,
  used to fit a second `NearestNeighbors` model over those coordinates. Song-seed only.

A search or recommendation request checks both catalogs, so a song is matched and
recommended from whichever source contains it.

## Requirements

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (recommended) or `pip`

## Setup

```bash
uv sync
```

Or with plain `pip`:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

No API keys or `.env` file are required — everything runs against the local CSVs in
`files/`, and the MCP server talks to this same API rather than to Spotify directly.

## Run the API

```bash
uv run python main.py
```

This starts the API on `http://localhost:8000` with autoreload. Equivalently:

```bash
uv run uvicorn app.main:app --reload
```

On startup, both KNN models are fit and cached in memory, so the first request isn't
slow but boot takes a few seconds. The MCP server (below) requires this to be running.

## API

- `GET /api/health` — liveness check.
- `GET /api/songs/search?q=<text>&by=song|artist&limit=<n>` — search tracks by song
  name or artist across both catalogs.
- `GET /api/genres` — list every genre available for `by-genre` recommendations.
- `GET /api/moods` — list every mood available for `by-mood` recommendations.
- `GET /api/recommendations?song=<exact track name>&limit=<n>` — nearest neighbors to
  a track, by audio-feature or PCA-coordinate distance.
- `GET /api/recommendations/by-artist?artist=<name>&limit=<n>` — nearest neighbors to
  the centroid of an artist's tracks (main catalog only).
- `GET /api/recommendations/by-genre?genre=<name>&limit=<n>` — nearest neighbors to
  the centroid of a genre's tracks (main catalog only).
- `GET /api/recommendations/by-mood?mood=<name>&limit=<n>` — nearest neighbors to a
  fixed target feature vector for that mood (main catalog only).

All `recommendations*` endpoints return `404` if the seed isn't found/recognized. See
[`specs/mcp_server.md`](specs/mcp_server.md) for the recommendation math and the mood
taxonomy.

Interactive docs are available at `http://localhost:8000/docs` while the server is
running.

## MCP server

`mcp_server/` is a separate process — a thin stdio MCP server that calls the API above
over HTTP (it does not import anything from `app/`). It generates track lists; it does
**not** create or modify a real Spotify playlist, so no Spotify login is involved.

Tools exposed:
- `recommender_search_song` — search by song title or artist name.
- `recommender_list_genres` / `recommender_list_moods` — discover valid seed values.
- `recommender_create_playlist` — build a playlist from `seed_type` (`song` / `artist`
  / `genre` / `mood`) + `seed` + `size`.

The server speaks stdio MCP, so it's meant to be launched *by* a client, not run and
left sitting in a terminal on its own. Make sure the API is running first
(`uv run python main.py`), then open it one of these ways:

### Claude Code

This repo includes a project-level [`.mcp.json`](.mcp.json), so opening the repo in
Claude Code registers the `music_recommender` server — but Claude Code only reads
`.mcp.json` at session start, so **restart the session** (exit and run `claude` again)
after this file is added or changed; `/mcp` itself won't reload it. The first time,
Claude Code also asks you to approve a new project-scoped server — accept the prompt
(if you'd previously dismissed it, run `claude mcp reset-project-choices` to get asked
again). Then `/mcp` should list `music_recommender` with its 4 tools, and you can just
ask for a playlist in normal chat (e.g. "make me a playlist for when I'm feeling
calm").

### Claude Desktop

Add this to your `claude_desktop_config.json`, then fully restart Claude Desktop:

```json
{
  "mcpServers": {
    "music_recommender": {
      "command": "uv",
      "args": ["run", "--directory", "/absolute/path/to/spotify_recommender_AI-lab", "python", "-m", "mcp_server.server"]
    }
  }
}
```

The tools then appear under the 🔌/tools icon in the chat box.

### OpenCode

OpenCode does **not** read `.mcp.json` (that's Claude's format) — it uses its own
[`opencode.json`](opencode.json) at the project root, already included:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "music_recommender": {
      "type": "local",
      "command": ["uv", "run", "python", "-m", "mcp_server.server"],
      "enabled": true,
      "environment": {
        "MUSIC_API_BASE_URL": "http://localhost:8000/api"
      }
    }
  }
}
```

As with Claude Code, OpenCode reads this file at startup, so restart OpenCode after it
changes for the server to show up.

### MCP Inspector (no LLM client needed)

To browse and call the tools by hand — useful for testing without going through an
LLM:

```bash
npx @modelcontextprotocol/inspector uv run python -m mcp_server.server
```

This opens a local web UI where you can pick a tool (e.g. `recommender_create_playlist`),
fill in its arguments in a form, and see the raw JSON response.

---

The API base URL defaults to `http://localhost:8000/api`; override it with the
`MUSIC_API_BASE_URL` environment variable (set in `.mcp.json` or your client config)
if the API runs elsewhere.

## Project layout

```
app/
  main.py                   FastAPI app + startup lifespan (warms the KNN models)
  api/routes.py             Route handlers
  core/config.py            Settings (CORS origin, .env support)
  data/loader.py            CSV loading and cleaning
  services/recommender.py   KNN catalogs, search and recommendation logic
  models.py                 Pydantic request/response schemas
mcp_server/
  server.py                 MCP tool definitions (music_recommender_mcp)
  client.py                 Shared HTTP client + error formatting for the API above
files/                      Source datasets
specs/                      Design specs (see specs/mcp_server.md for the MCP server)
.mcp.json                   Claude Code project MCP config
```

## Not built (by design)

See [`specs/mcp_server.md`](specs/mcp_server.md) for the full list — notably: no real
Spotify OAuth or playlist writes, no moods beyond the fixed 7, no HTTP transport or
auth on the MCP server.
