import { Image } from 'expo-image';
import { router } from 'expo-router';
import { MessageCircle, Music2, RefreshCw, Search } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAlbumArt } from '../src/api/albumArt';
import { createRecommenderClient } from '../src/api/client';
import type { RecommendedTrackOut } from '../src/api/types';
import { AppHeader, BottomNav } from '../src/components/AppChrome';
import { useRecommenderConfig } from '../src/storage/recommenderConfig';
import { useLibrary } from '../src/storage/library';

const GREEN = '#53E076';
const CATALOG_ROWS = [
  { key: 'romantic', title: 'Clima romântico', accepts: (track: RecommendedTrackOut) => (track.audio_features?.valence ?? 0) >= 0.38 && (track.audio_features?.energy ?? 1) <= 0.68 },
  { key: 'energetic', title: 'Para treinar', accepts: (track: RecommendedTrackOut) => (track.audio_features?.energy ?? 0) >= 0.78 && (track.audio_features?.danceability ?? 0) >= 0.5 },
  { key: 'happy', title: 'Descobertas da semana', accepts: (track: RecommendedTrackOut) => (track.audio_features?.popularity ?? 0) >= 35 && track.distance <= 2.2 },
];

function reliableTracks(tracks: RecommendedTrackOut[], accepts: (track: RecommendedTrackOut) => boolean) {
  return tracks.filter((track) => accepts(track) && (track.audio_features?.popularity ?? 0) >= 25).slice(0, 8);
}

function HomeTrackCard({ track, context }: { track: RecommendedTrackOut; context: string }) {
  const [art, setArt] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getAlbumArt(track.spotify_url).then((url) => active && setArt(url));
    return () => { active = false; };
  }, [track.spotify_url]);

  return (
    <Pressable
      style={styles.trackCard}
      onPress={() => router.push({
        pathname: '/recommendation',
        params: {
          name: track.name,
          artist: track.artist,
          url: track.spotify_url,
          art: art ?? '',
          distance: String(track.distance),
          features: JSON.stringify(track.audio_features ?? {}),
          context,
          genre: track.genre ?? '',
        },
      })}
    >
      <View style={styles.artFrame}>
        {art ? <Image source={{ uri: art }} style={styles.art} contentFit="cover" transition={180} /> : <Music2 color="#687169" size={28} />}
      </View>
      <Text style={styles.trackName} numberOfLines={2}>{track.name}</Text>
      <Text style={styles.artist} numberOfLines={1}>{track.artist}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { config } = useRecommenderConfig();
  const { favorites, playlists, recentTracks } = useLibrary();
  const client = useMemo(() => config ? createRecommenderClient(config) : null, [config]);
  const [sections, setSections] = useState<{ title: string; tracks: RecommendedTrackOut[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadRecommendations = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setError(true);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const results = await Promise.all(CATALOG_ROWS.map((row) => client.getRecommendationsByMood(row.key, 30)));
      const generated = CATALOG_ROWS.map((row, index) => ({ title: row.title, tracks: reliableTracks(results[index], row.accepts) })).filter((section) => section.tracks.length >= 3);
      const personal = favorites.length ? [{ title: 'Para você', tracks: favorites.slice(0, 8) }] : [];
      const requested = playlists.flatMap((playlist) => playlist.tracks).filter((track, index, all) => all.findIndex((item) => item.spotify_url === track.spotify_url) === index).slice(0, 8);
      const basedOnRequests = requested.length ? [{ title: 'Baseado nos seus pedidos', tracks: requested }] : [];
      const recent = recentTracks.length ? [{ title: 'Ouvidas recentemente', tracks: recentTracks.slice(0, 8) }] : [];
      setSections([...personal, ...basedOnRequests, ...generated, ...recent]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [client, favorites, playlists, recentTracks]);

  useEffect(() => { loadRecommendations(); }, [loadRecommendations]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadRecommendations();
    });
    return () => subscription.remove();
  }, [loadRecommendations]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.eyebrow}>SEU MOMENTO</Text>
            <Text style={styles.heading}>O que vamos ouvir?</Text>
          </View>
          <Pressable onPress={loadRecommendations} style={styles.iconButton} accessibilityLabel="Atualizar recomendações">
            <RefreshCw color="#BCCBB9" size={20} />
          </Pressable>
        </View>

        <Pressable style={styles.searchBar} onPress={() => router.push('/browse')}>
          <Search color="#8E978F" size={19} />
          <Text style={styles.searchText}>Busque músicas, artistas e playlists</Text>
        </Pressable>

        <Pressable style={styles.askButton} onPress={() => router.push('/chat')}>
          <View style={styles.askIcon}><MessageCircle color="#07150B" fill="#07150B" size={22} /></View>
          <View style={styles.askText}>
            <Text style={styles.askTitle}>Peça uma recomendação</Text>
            <Text style={styles.askSubtitle}>Artista, música ou clima: a IA monta sua seleção.</Text>
          </View>
        </Pressable>

        {loading && sections.length === 0 ? <ActivityIndicator color={GREEN} style={styles.loading} /> : null}
        {error ? (
          <Pressable onPress={loadRecommendations} style={styles.errorState}>
            <Text style={styles.errorTitle}>Não foi possível carregar as músicas.</Text>
            <Text style={styles.errorAction}>Toque para tentar novamente</Text>
          </Pressable>
        ) : null}

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <FlatList
              horizontal
              data={section.tracks}
              keyExtractor={(track) => track.spotify_url}
              renderItem={({ item }) => <HomeTrackCard track={item} context={section.title} />}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          </View>
        ))}
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#131313' },
  content: { paddingBottom: 28 },
  greetingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 24 },
  eyebrow: { color: GREEN, fontSize: 11, fontWeight: '800', letterSpacing: 0 },
  heading: { color: '#F4F5F4', fontSize: 27, lineHeight: 34, fontWeight: '800', marginTop: 4 },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  askButton: { minHeight: 82, marginHorizontal: 20, marginTop: 22, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 13, borderWidth: 1, borderColor: 'rgba(83,224,118,0.32)', borderRadius: 8, backgroundColor: '#202220' },
  searchBar: { height: 48, marginHorizontal: 20, marginTop: 18, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 6, backgroundColor: '#232623' },
  searchText: { color: '#929B93', fontSize: 13 },
  askIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  askText: { flex: 1 },
  askTitle: { color: '#F4F5F4', fontSize: 16, fontWeight: '800' },
  askSubtitle: { color: '#AEB7AF', fontSize: 12, lineHeight: 17, marginTop: 3 },
  loading: { marginTop: 64 },
  errorState: { margin: 20, paddingVertical: 24, alignItems: 'center', borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#303230' },
  errorTitle: { color: '#E5E2E1', fontSize: 14 },
  errorAction: { color: GREEN, fontSize: 13, fontWeight: '700', marginTop: 5 },
  section: { marginTop: 28 },
  sectionTitle: { color: '#F4F5F4', fontSize: 20, fontWeight: '800', marginHorizontal: 20, marginBottom: 13 },
  horizontalList: { paddingHorizontal: 20, gap: 14 },
  trackCard: { width: 142 },
  artFrame: { width: 142, height: 142, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 6, backgroundColor: '#242724' },
  art: { width: '100%', height: '100%' },
  trackName: { color: '#F1F2F1', fontSize: 14, lineHeight: 18, fontWeight: '700', marginTop: 9 },
  artist: { color: '#949D95', fontSize: 12, marginTop: 3 },
});
