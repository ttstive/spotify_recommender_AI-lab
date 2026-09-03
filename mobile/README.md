# OpenCode Chat (mobile)

An Expo/React Native chat client for [OpenCode](https://opencode.ai) — lets you send prompts to your OpenCode agent (backed by OpenRouter models) from your phone instead of the CLI. It also has a **Browse Catalog** screen for searching the music catalog directly by song, artist, or mood, without going through chat.

This app talks to **two separately-run servers**: `opencode serve` over HTTP/SSE for chat, and the repo-root Python FastAPI app (`app/`) directly for the Browse Catalog screen (and as the backing service for the `music_recommender` MCP tool used in chat). Both need to be running and reachable from your phone — see step 1 below.

Album art in both the chat's recommendation results and the Browse Catalog screen comes from Spotify's public, unauthenticated oEmbed endpoint (`https://open.spotify.com/oembed?url=...`), keyed off the real Spotify track IDs already present in every `spotify_url` the API returns. No Spotify API key or OAuth is involved, and no backend changes were needed to support it.

> Note on folder names: this Expo project's routes live in `mobile/app/` (required by Expo Router). That's unrelated to the repo-root `app/` (the Python FastAPI service) — don't confuse the two when searching the repo.

## Prerequisites

- Node.js LTS
- [Expo Go](https://expo.dev/go) on your phone, or a dev client build
- The [`opencode`](https://opencode.ai) CLI installed on your computer
- An [OpenRouter](https://openrouter.ai) API key

## 1. Run the OpenCode server

From the **repo root** (not `mobile/`) — this matters, since `opencode.json` at the repo root registers the `music_recommender` MCP server, and OpenCode only picks that up when started from there:

```bash
# from the repo root
export OPENROUTER_API_KEY=sk-or-v1-...        # or: opencode auth login
export OPENCODE_SERVER_PASSWORD=some-password  # optional, but recommended once you leave localhost
opencode serve --hostname 0.0.0.0 --port 4096
```

Find your computer's LAN IP (macOS): `ipconfig getifaddr en0`

Verify it's reachable:

```bash
curl http://<lan-ip>:4096/global/health
```

Start the FastAPI app too (from the repo root) — required for both `music_recommender` tool calls in chat and the Browse Catalog screen. It already binds `0.0.0.0:8000`, same as `opencode serve`, so the same LAN IP works, just on a different port:

```bash
uv run python main.py
```

```bash
curl http://<lan-ip>:8000/api/health
```

## 2. Alternative connection methods

A raw LAN IP only works when your phone and computer are on the same Wi-Fi. If that's not the case, point the app at one of these instead:

- [Tailscale Serve](https://tailscale.com/kb/1312/serve)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- An SSH port-forward (`ssh -R` / `-L`) to a reachable host

## 3. Run the mobile app

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with Expo Go. If Metro isn't reachable from your phone, try `npx expo start --tunnel` (this is separate from the opencode-server LAN setup above — it only affects how your phone reaches the dev server).

### If Expo Go says the project needs a newer version

This app targets a recent Expo SDK. If your phone's Expo Go is already up to date and *still* refuses to open the project ("Project is incompatible with this version of Expo Go"), Expo Go's public release hasn't caught up to this SDK yet — this happens right after a new SDK ships. Use a **development build** instead; it compiles a small custom app that installs on your phone like any other app and then behaves like Expo Go for live reload.

**iOS:**

```bash
brew install cocoapods   # one-time, if you don't have it
```

1. Connect your iPhone via USB and unlock it; tap **Trust This Computer** if prompted.
2. On the iPhone: Settings → Privacy & Security → **Developer Mode** → enable → restart the phone (required on iOS 16+).
3. Open Xcode once and sign in with your Apple ID (Xcode → Settings → Accounts) — a free Apple ID is enough for local device testing.
4. From `mobile/`, run:
   ```bash
   npx expo run:ios --device
   ```
   Pick your iPhone from the list. The first build takes a few minutes (it generates a native `ios/` project, installs Pods, then builds and installs the app).
5. First launch may show "Untrusted Developer" — on the phone, go to Settings → General → VPN & Device Management → select your Apple ID → **Trust**.
6. From then on, start the dev server with `npx expo start --dev-client` and open it from the installed app icon (not Expo Go).

**Android:** the equivalent is `npx expo run:android --device`, which needs Android Studio + platform tools (`adb`) installed and USB debugging enabled on the phone.

## 4. First run in the app

1. Open Settings (gear icon).
2. Enter the OpenCode server URL from step 1 (or your tunnel URL from step 2), the username (defaults to `opencode`), and the password if you set one.
3. Tap **Test Connection**. Once it succeeds, **Save** unlocks.
4. Scroll down to **Recommender API** — it's pre-filled with the same host on port 8000 (override it only if the FastAPI app runs somewhere else). Tap **Test Connection**, then **Save**.
5. Start chatting, or tap 🔍 in the chat header to open **Browse Catalog** and search by song, artist, or mood directly. Use the header's model button to pick a specific OpenRouter model, or leave it on "Default model" to use whatever OpenCode is configured with.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| "Could not reach that address" | Wrong URL/port, `opencode serve` not running, or not bound to `0.0.0.0` |
| "Wrong username or password" | `OPENCODE_SERVER_PASSWORD`/username mismatch |
| Tool calls never appear | The FastAPI app (`app/`) and/or the MCP server aren't running |
| `GET /mcp` shows `music_recommender` as `"status": "failed"` | Confirm that `uv` is available on `PATH`, stop OpenCode, return to the repository root, and restart `opencode serve`. The portable `opencode.json` intentionally contains no Windows or macOS user paths. |
| Everything connects but responses never start | Check `opencode serve`'s own logs — the OpenRouter key or model config may be invalid |
| Browse Catalog: "Recommender server not configured" | The Recommender API URL in Settings is empty and couldn't be auto-derived (no OpenCode server configured yet) — set it manually |
| Browse Catalog: "Could not reach the recommender server" | The FastAPI app (`uv run python main.py`) isn't running, or the Recommender API URL's host/port is wrong — `curl http://<lan-ip>:8000/api/health` from your computer to confirm it's reachable |
| Album art never loads (placeholder stays forever) | The phone needs general internet access to reach `open.spotify.com`'s oEmbed endpoint — a LAN-only network (no internet) will fetch tracks fine but never show art |

## Project layout

```
mobile/
  app/
    _layout.tsx     # root Stack, providers
    index.tsx       # chat screen
    browse.tsx      # Browse Catalog screen (song/artist/mood search)
    settings.tsx    # connection settings (modal)
  src/
    opencode/       # HTTP client, SSE hook, chat-session hook, types (opencode serve)
    api/            # HTTP client, types, album-art lookup (FastAPI recommender)
    storage/        # SecureStore (credentials) + AsyncStorage (session/cache/recommender URL) helpers
    components/
      chat/         # chat part renderers, incl. RecommendationResultCard
      catalog/      # shared TrackList/TrackListItem (chat + Browse Catalog)
    theme/          # color tokens
```
