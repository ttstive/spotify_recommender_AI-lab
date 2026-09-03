import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ExternalLink, Heart, MoreVertical, Sparkles } from 'lucide-react-native';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLibrary } from '../src/storage/library';
import type { RecommendedTrackOut } from '../src/api/types';
import { generateTrackInsight } from '../src/api/trackInsight';
import { createOpenCodeClient } from '../src/opencode/client';
import { useConnectionConfig } from '../src/storage/connectionConfig';

const fallbackArt = require('../assets/figma/metallica-master-of-puppets.png');
const GREEN = '#53E076';

const FEATURE_LABELS: Record<string, string> = {
  acousticness: 'sonoridade acustica',
  danceability: 'ritmo dancante',
  energy: 'energia',
  instrumentalness: 'presenca instrumental',
  liveness: 'sensacao de performance ao vivo',
  speechiness: 'presenca vocal',
  valence: 'clima positivo',
};

function buildInsight(features: Record<string, number>, distance?: number) {
  const traits = Object.entries(features)
    .filter(([key, value]) => key in FEATURE_LABELS && Number.isFinite(value))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 2)
    .map(([key]) => FEATURE_LABELS[key]);
  const description = traits.length === 2 ? `${traits[0]} e ${traits[1]}` : traits[0];
  const proximity = distance == null
    ? ''
    : distance < 1.5
      ? ' Ela esta entre as faixas mais proximas do perfil escolhido.'
      : ' Ela amplia a selecao sem fugir do perfil escolhido.';

  return description
    ? `Recomendamos esta faixa principalmente pela ${description}.${proximity}`
    : `Esta faixa foi selecionada pela proximidade musical com os parametros da sua busca.${proximity}`;
}

export default function RecommendationScreen() {
  const params = useLocalSearchParams<{
    name?: string;
    artist?: string;
    url?: string;
    art?: string;
    distance?: string;
    features?: string;
    context?: string;
    genre?: string;
  }>();
  const name = params.name || 'Master Of Puppets';
  const artist = params.artist || 'Metallica';
  const art = params.art ? { uri: params.art } : fallbackArt;
  const distance = params.distance ? Number(params.distance) : undefined;
  const { isFavorite, toggleFavorite, addRecentTrack } = useLibrary();
  const { config } = useConnectionConfig();
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  let features: Record<string, number> = {};
  try {
    features = params.features ? JSON.parse(params.features) : {};
  } catch {
    features = {};
  }
  const track: RecommendedTrackOut = { name, artist, spotify_url: params.url || '', distance: distance ?? 0, genre: params.genre, audio_features: features };
  const favorite = params.url ? isFavorite(params.url) : false;
  useEffect(() => { addRecentTrack(track); }, [params.url]);
  useEffect(() => {
    if (!config || !params.url) return;
    let active = true;
    setLoadingInsight(true);
    generateTrackInsight(createOpenCodeClient(config), track, params.context || 'recomendação atual')
      .then((text) => active && text && setAiInsight(text))
      .catch(() => undefined)
      .finally(() => active && setLoadingInsight(false));
    return () => { active = false; };
  }, [params.url, params.context, config?.baseUrl]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Voltar"><ArrowLeft color={GREEN} size={25} /></Pressable>
        <Text style={styles.logo}>Spot.AI</Text>
        <MoreVertical color="#BCCBB9" size={23} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Image source={art} style={styles.cover} contentFit="cover" />
        <View style={styles.trackRow}>
          <View style={styles.trackText}>
            <Text style={styles.title}>{name}</Text>
            <Text style={styles.artist}>{artist}</Text>
          </View>
          <Pressable onPress={() => params.url && toggleFavorite(track)} accessibilityLabel={favorite ? 'Remover das músicas salvas' : 'Salvar música'}>
            <Heart color={GREEN} fill={favorite ? GREEN : 'transparent'} size={27} />
          </Pressable>
        </View>

        <View style={styles.insight}>
          <View style={styles.insightLabel}>
            <Sparkles color={GREEN} size={14} />
            <Text style={styles.insightLabelText}>POR QUE ESTA FAIXA</Text>
          </View>
          <Text style={styles.insightText}>{aiInsight || buildInsight(features, distance)}</Text>
          {loadingInsight && !aiInsight ? <View style={styles.refining}><ActivityIndicator color={GREEN} size="small" /><Text style={styles.refiningText}>Personalizando análise...</Text></View> : null}
        </View>

        <Pressable disabled={!params.url} onPress={() => params.url && Linking.openURL(params.url)} style={[styles.spotifyButton, !params.url && styles.spotifyButtonDisabled]}>
          <ExternalLink color="#003914" size={20} />
          <Text style={styles.spotifyText}>Abrir no Spotify</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#131313' },
  header: { height: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  logo: { color: GREEN, fontSize: 24, fontWeight: '800' },
  content: { width: '100%', maxWidth: 430, alignSelf: 'center', padding: 20, paddingBottom: 36 },
  cover: { width: '86%', maxWidth: 320, aspectRatio: 1, alignSelf: 'center', marginVertical: 20 },
  trackRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  trackText: { flex: 1, marginRight: 16 },
  title: { color: '#E5E2E1', fontSize: 22, lineHeight: 28, fontWeight: '800' },
  artist: { color: '#BCCBB9', fontSize: 16, marginTop: 3 },
  insight: { marginTop: 22, padding: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(83,224,118,0.25)', backgroundColor: 'rgba(32,31,31,0.72)' },
  insightLabel: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  insightLabelText: { color: GREEN, fontSize: 11, letterSpacing: 0, fontWeight: '700' },
  insightText: { color: '#BCCBB9', fontSize: 14, lineHeight: 22 },
  refining: { marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }, refiningText: { color: '#7F8980', fontSize: 11 },
  spotifyButton: { height: 56, marginTop: 24, borderRadius: 28, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: GREEN },
  spotifyButtonDisabled: { opacity: 0.45 },
  spotifyText: { color: '#003914', fontSize: 18, fontWeight: '800' },
});
