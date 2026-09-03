import { Image } from 'expo-image';
import { ExternalLink } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { getAlbumArt } from '../../api/albumArt';
import type { RecommendedTrackOut } from '../../api/types';
import { useColors } from '../../theme/colors';
import { useLibrary } from '../../storage/library';

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

function ResultTrack({ track }: { track: RecommendedTrackOut }) {
  const colors = useColors();
  const [art, setArt] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getAlbumArt(track.spotify_url).then((url) => active && setArt(url));
    return () => { active = false; };
  }, [track.spotify_url]);

  return (
    <Pressable style={[styles.track, { borderColor: colors.border }]} onPress={() => Linking.openURL(track.spotify_url)}>
      <View style={styles.coverFrame}>
        {art ? <Image source={{ uri: art }} style={styles.cover} contentFit="cover" transition={150} /> : null}
      </View>
      <View style={styles.trackText}>
        <Text style={[styles.trackName, { color: colors.text }]} numberOfLines={1}>{track.name}</Text>
        <Text style={[styles.artist, { color: colors.textMuted }]} numberOfLines={1}>{track.artist}</Text>
      </View>
      <ExternalLink color={colors.accent} size={17} />
    </Pressable>
  );
}

export function RecommendationResultCard({ result }: { result: PlaylistToolResult }) {
  const colors = useColors();
  const { createPlaylist } = useLibrary();
  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {result.title ?? (result.seed ? `Seleção inspirada em ${result.seed}` : 'Recomendações')}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {result.seed_type === 'artist' && result.seed
          ? `Faixas de ${result.seed}`
          : result.seed_type === 'similar_artist' && result.seed
            ? `Artistas do mesmo universo musical de ${result.seed}`
          : result.seed_type === 'genre' && result.seed
            ? `Faixas selecionadas dentro do gênero ${result.seed}`
            : 'Resultados calculados pelo recomendador'}
      </Text>
      <View style={styles.list}>
        {result.tracks.slice(0, 6).map((track) => <ResultTrack key={track.spotify_url} track={track} />)}
      </View>
      {result.tracks.length > 6 && <Text style={[styles.more, { color: colors.textMuted }]}>+ {result.tracks.length - 6} faixas na seleção</Text>}
      <Pressable
        style={styles.saveButton}
        onPress={() => createPlaylist(result.title || `Seleção ${result.seed || 'Spot.AI'}`, 'Criada com a IA do Spot.AI', result.tracks)}
      >
        <Text style={styles.saveText}>Salvar na Biblioteca</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: { fontSize: 12, marginBottom: 2 },
  list: { gap: 7 },
  track: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6, borderWidth: 1, borderRadius: 6, backgroundColor: '#171817' },
  coverFrame: { width: 44, height: 44, borderRadius: 4, overflow: 'hidden', backgroundColor: '#2A2D2A' },
  cover: { width: '100%', height: '100%' },
  trackText: { flex: 1 },
  trackName: { fontSize: 14, fontWeight: '700' },
  artist: { fontSize: 12, marginTop: 2 },
  more: { fontSize: 12, textAlign: 'center', paddingTop: 2 },
  saveButton: { height: 42, marginTop: 4, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#53E076' },
  saveText: { color: '#07150B', fontSize: 13, fontWeight: '800' },
});
