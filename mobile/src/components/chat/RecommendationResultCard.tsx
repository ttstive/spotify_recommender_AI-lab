import { StyleSheet, Text, View } from 'react-native';

import type { RecommendedTrackOut } from '../../api/types';
import { useColors } from '../../theme/colors';
import { TrackList } from '../catalog/TrackList';

export interface PlaylistToolResult {
  title?: string;
  seed_type?: string;
  seed?: string;
  tracks: RecommendedTrackOut[];
}

function isTrack(value: unknown): value is RecommendedTrackOut {
  const t = value as RecommendedTrackOut;
  return (
    typeof t === 'object' &&
    t !== null &&
    typeof t.name === 'string' &&
    typeof t.artist === 'string' &&
    typeof t.spotify_url === 'string'
  );
}

/** `recommender_create_playlist`'s tool output is a JSON string with no
 * schema guarantee from the OpenCode API layer -- this is the one place that
 * trusts it, and only renders the card when the shape actually matches. */
export function parsePlaylistResult(output: string): PlaylistToolResult | null {
  try {
    const parsed = JSON.parse(output);
    if (!parsed || !Array.isArray(parsed.tracks)) return null;
    const tracks = parsed.tracks.filter(isTrack);
    if (tracks.length === 0) return null;
    return { title: parsed.title, seed_type: parsed.seed_type, seed: parsed.seed, tracks };
  } catch {
    return null;
  }
}

export function RecommendationResultCard({ result }: { result: PlaylistToolResult }) {
  const colors = useColors();
  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {result.title ?? (result.seed ? `Playlist inspired by "${result.seed}"` : 'Recommendations')}
      </Text>
      <TrackList tracks={result.tracks} scrollEnabled={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 12,
    padding: 10,
    marginVertical: 4,
    gap: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
});
