import { Image } from 'expo-image';
import { router } from 'expo-router';
import { MessageCircle, Music2, RefreshCw } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAlbumArt } from '../src/api/albumArt';
import { createRecommenderClient } from '../src/api/client';
import type { RecommendedTrackOut } from '../src/api/types';
import { AppHeader, BottomNav } from '../src/components/AppChrome';
import { useRecommenderConfig } from '../src/storage/recommenderConfig';

const GREEN = '#53E076';
const MOODS = [
  { key: 'happy', title: 'Para levantar o astral' },
  { key: 'calm', title: 'Para desacelerar' },
  { key: 'energetic', title: 'Energia para agora' },
  { key: 'focused', title: 'Foco sem distrações' },
  { key: 'romantic', title: 'Clima romântico' },
  { key: 'sad', title: 'Para dias introspectivos' },
];

function HomeTrackCard({ track }: { track: RecommendedTrackOut }) {
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
  const client = useMemo(() => config ? createRecommenderClient(config) : null, [config]);
  const [sections, setSections] = useState<{ title: string; tracks: RecommendedTrackOut[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const rotation = useRef(Math.floor(Math.random() * MOODS.length));

  const loadRecommendations = useCallback(async () => {
    if (!client) {
      setLoading(false);
      setError(true);
      return;
    }
    setLoading(true);
    setError(false);
    const offset = rotation.current;
    rotation.current = (rotation.current + 1) % MOODS.length;
    const selected = [MOODS[offset], MOODS[(offset + 2) % MOODS.length]];
    try {
      const results = await Promise.all(selected.map((mood) => client.getRecommendationsByMood(mood.key, 8)));
      setSections(selected.map((mood, index) => ({ title: mood.title, tracks: results[index] })));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [client]);

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
              renderItem={({ item }) => <HomeTrackCard track={item} />}
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
