// Album art with no OAuth, no API key, and no backend changes: Spotify's
// public oEmbed endpoint accepts any open.spotify.com track URL (which every
// recommendation already carries as `spotify_url`) and returns a
// `thumbnail_url` for it. Results are cached in-memory for the life of the
// app so the same track is never fetched twice in one session.
const cache = new Map<string, Promise<string | null>>();

async function fetchThumbnail(spotifyUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`);
    if (!response.ok) return null;
    const data = (await response.json()) as { thumbnail_url?: string };
    return data.thumbnail_url ?? null;
  } catch {
    return null;
  }
}

export function getAlbumArt(spotifyUrl: string): Promise<string | null> {
  let pending = cache.get(spotifyUrl);
  if (!pending) {
    pending = fetchThumbnail(spotifyUrl);
    cache.set(spotifyUrl, pending);
  }
  return pending;
}
