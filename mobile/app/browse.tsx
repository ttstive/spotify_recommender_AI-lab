import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ListMusic, Music2, Search, Sparkles, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAlbumArt } from '../src/api/albumArt';
import { createRecommenderClient } from '../src/api/client';
import type { RecommendedTrackOut, SongSearchResult } from '../src/api/types';
import { AppHeader, BottomNav } from '../src/components/AppChrome';
import { useLibrary } from '../src/storage/library';
import { useRecommenderConfig } from '../src/storage/recommenderConfig';

const GREEN = '#53E076';
type SearchMode = 'general' | 'song' | 'artist' | 'genre';
const SEARCH_MODES: { key: SearchMode; label: string }[] = [
  { key: 'general', label: 'Geral' }, { key: 'song', label: 'Música' },
  { key: 'artist', label: 'Artista' }, { key: 'genre', label: 'Gênero' },
];
const MOODS = [
  { key: 'happy', label: 'Feliz' }, { key: 'calm', label: 'Calmo' },
  { key: 'energetic', label: 'Treino' }, { key: 'focused', label: 'Foco' },
  { key: 'romantic', label: 'Romântico' }, { key: 'sad', label: 'Introspectivo' },
];
const MOOD_ALIASES: Record<string, string> = {
  feliz: 'happy', alegre: 'happy', calmo: 'calm', calma: 'calm', relaxar: 'calm',
  treino: 'energetic', academia: 'energetic', energético: 'energetic', energetico: 'energetic',
  foco: 'focused', estudar: 'focused', romântico: 'romantic', romantico: 'romantic',
  triste: 'sad', introspectivo: 'sad',
};

function SearchTrack({ track, context }: { track: RecommendedTrackOut; context: string }) {
  const [art, setArt] = useState<string | null>(null);
  useEffect(() => { getAlbumArt(track.spotify_url).then(setArt); }, [track.spotify_url]);
  const open = () => router.push({ pathname: '/recommendation', params: {
    name: track.name, artist: track.artist, url: track.spotify_url, art: art ?? '',
    distance: String(track.distance), features: JSON.stringify(track.audio_features ?? {}),
    context, genre: track.genre ?? '',
  } });
  return <Pressable style={styles.result} onPress={open}>
    <View style={styles.art}>{art ? <Image source={{ uri: art }} style={styles.image} /> : <Music2 color="#727B73" size={22} />}</View>
    <View style={styles.resultText}><Text style={styles.resultName} numberOfLines={1}>{track.name}</Text><Text style={styles.resultMeta} numberOfLines={1}>{track.artist}{track.genre ? ` · ${track.genre}` : ''}</Text></View>
  </Pressable>;
}

export default function SearchScreen() {
  const { config } = useRecommenderConfig();
  const client = useMemo(() => config ? createRecommenderClient(config) : null, [config]);
  const { playlists } = useLibrary();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('general');
  const [tracks, setTracks] = useState<RecommendedTrackOut[]>([]);
  const [suggestions, setSuggestions] = useState<SongSearchResult[]>([]);
  const [moodTracks, setMoodTracks] = useState<RecommendedTrackOut[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [resultLabel, setResultLabel] = useState('Músicas e artistas');
  const [loading, setLoading] = useState(false);
  const normalized = query.trim().toLocaleLowerCase();
  const matchedPlaylists = mode === 'general' && normalized ? playlists.filter((playlist) => playlist.name.toLocaleLowerCase().includes(normalized)) : [];

  useEffect(() => { if (client) client.listGenres().then((data) => setGenres(data.genres)).catch(() => setGenres([])); }, [client]);
  useEffect(() => {
    if (!client || normalized.length < 2) { setTracks([]); setSuggestions([]); setLoading(false); return; }
    let active = true; setLoading(true);
    const timer = setTimeout(async () => {
      try {
        if (mode === 'song' || mode === 'artist') {
          const found = await client.searchSongs(normalized, mode, 12);
          if (active) { setSuggestions(found); setTracks([]); }
          return;
        }
        if (mode === 'genre') {
          if (active) { setSuggestions([]); setTracks([]); }
          return;
        }
        const mood = MOOD_ALIASES[normalized];
        const genre = genres.find((item) => item.toLocaleLowerCase() === normalized);
        const items = mood ? await client.getRecommendationsByMood(mood, 10) : genre ? await client.getRecommendationsByGenre(genre, 10) : await client.searchTracks(normalized, 10);
        if (active) { setSuggestions([]); setTracks(items); setResultLabel(mood ? `Para um clima ${query}` : genre ? `No gênero ${genre}` : 'Músicas e artistas'); }
      } catch { if (active) { setTracks([]); setSuggestions([]); } }
      finally { if (active) setLoading(false); }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [client, genres, mode, normalized]);

  async function pickMood(key: string) {
    if (!client) return;
    setLoading(true); setQuery(''); setTracks([]);
    try { setMoodTracks(await client.getRecommendationsByMood(key, 10)); }
    finally { setLoading(false); }
  }

  async function chooseSeed(seed: string, selectedMode: 'song' | 'artist' | 'genre') {
    if (!client) return;
    setLoading(true); setSuggestions([]);
    try {
      const items = selectedMode === 'song' ? await client.getRecommendationsBySong(seed, 12) : selectedMode === 'artist' ? await client.getRecommendationsByArtist(seed, 12) : await client.getRecommendationsByGenre(seed, 12);
      setTracks(items); setResultLabel(selectedMode === 'song' ? `Parecidas com ${seed}` : selectedMode === 'artist' ? `No universo de ${seed}` : `No gênero ${seed}`);
    } finally { setLoading(false); }
  }

  const visibleTracks = moodTracks.length ? moodTracks : tracks;
  return <SafeAreaView style={styles.screen} edges={['top']}>
    <AppHeader />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Buscar</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeBar}>{SEARCH_MODES.map((item) => <Pressable key={item.key} onPress={() => { setMode(item.key); setTracks([]); setSuggestions([]); setMoodTracks([]); }} style={[styles.mode, mode === item.key && styles.modeActive]}><Text style={[styles.modeText, mode === item.key && styles.modeTextActive]}>{item.label}</Text></Pressable>)}</ScrollView>
      <View style={styles.searchBox}><Search color="#8D978E" size={20} /><TextInput value={query} onChangeText={(value) => { setQuery(value); setTracks([]); setMoodTracks([]); }} placeholder={mode === 'general' ? 'Música, artista, gênero, clima ou playlist' : mode === 'song' ? 'Qual música será a referência?' : mode === 'artist' ? 'Qual artista será a referência?' : 'Qual gênero você quer ouvir?'} placeholderTextColor="#818A82" style={styles.input} />{query ? <Pressable onPress={() => setQuery('')}><X color="#A4ADA5" size={19} /></Pressable> : null}</View>
      {!normalized && !moodTracks.length && mode === 'general' ? <><Text style={styles.sectionTitle}>Explore por momento</Text><View style={styles.moods}>{MOODS.map((mood) => <Pressable key={mood.key} onPress={() => pickMood(mood.key)} style={styles.mood}><Sparkles color={GREEN} size={14} /><Text style={styles.moodText}>{mood.label}</Text></Pressable>)}</View></> : null}
      {loading ? <ActivityIndicator color={GREEN} style={styles.loading} /> : null}
      {matchedPlaylists.length ? <View style={styles.section}><Text style={styles.sectionTitle}>Playlists da sua biblioteca</Text>{matchedPlaylists.map((playlist) => <Pressable key={playlist.id} style={styles.result} onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } })}><View style={styles.art}><ListMusic color={GREEN} size={23} /></View><View style={styles.resultText}><Text style={styles.resultName}>{playlist.name}</Text><Text style={styles.resultMeta}>{playlist.tracks.length} faixas</Text></View></Pressable>)}</View> : null}
      {suggestions.length ? <View style={styles.section}><Text style={styles.sectionTitle}>{mode === 'artist' ? 'Escolha o artista' : 'Escolha a música de referência'}</Text>{suggestions.filter((item, index, all) => mode === 'song' || all.findIndex((other) => other.artist === item.artist) === index).map((item) => <Pressable key={`${item.artist}-${item.song}`} style={styles.result} onPress={() => chooseSeed(mode === 'artist' ? item.artist.split(';').find((name) => name.toLocaleLowerCase().includes(normalized))?.trim() || item.artist : item.song, mode as 'song' | 'artist')}><View style={styles.art}><Music2 color={GREEN} size={21} /></View><View style={styles.resultText}><Text style={styles.resultName} numberOfLines={1}>{mode === 'artist' ? item.artist : item.song}</Text><Text style={styles.resultMeta} numberOfLines={1}>{mode === 'artist' ? `Ex.: ${item.song}` : item.artist}</Text></View></Pressable>)}</View> : null}
      {mode === 'genre' && normalized.length >= 2 ? <View style={styles.section}><Text style={styles.sectionTitle}>Escolha o gênero</Text>{genres.filter((genre) => genre.toLocaleLowerCase().includes(normalized)).slice(0, 12).map((genre) => <Pressable key={genre} style={styles.genreResult} onPress={() => chooseSeed(genre, 'genre')}><View><Text style={styles.resultName}>{genre}</Text>{genre === 'rap' || genre === 'trap' ? <Text style={styles.resultMeta}>Família hip-hop</Text> : null}</View><Sparkles color={GREEN} size={16} /></Pressable>)}</View> : null}
      {visibleTracks.length ? <View style={styles.section}><Text style={styles.sectionTitle}>{moodTracks.length ? 'Recomendações' : resultLabel}</Text>{visibleTracks.map((track) => <SearchTrack key={track.spotify_url} track={track} context={moodTracks.length ? 'momento escolhido' : `busca por ${query}`} />)}</View> : null}
      {normalized.length >= 2 && !loading && !tracks.length && !suggestions.length && !matchedPlaylists.length && mode !== 'genre' ? <Text style={styles.empty}>Nenhum resultado encontrado. Tente outro nome.</Text> : null}
    </ScrollView><BottomNav />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#131313' }, content: { padding: 20, paddingBottom: 36 },
  title: { color: '#F3F4F3', fontSize: 30, fontWeight: '800', marginBottom: 16 },
  modeBar: { gap: 8, paddingBottom: 12 }, mode: { height: 36, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 1, borderColor: '#343934' }, modeActive: { borderColor: GREEN, backgroundColor: '#203326' }, modeText: { color: '#9CA49D', fontSize: 13, fontWeight: '700' }, modeTextActive: { color: GREEN },
  searchBox: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: '#384039', borderRadius: 7, backgroundColor: '#1C1F1D' },
  input: { flex: 1, minWidth: 0, color: '#F0F2F0', fontSize: 14 }, section: { marginTop: 22 },
  sectionTitle: { color: '#EDF0ED', fontSize: 18, fontWeight: '800', marginTop: 24, marginBottom: 12 },
  moods: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, mood: { height: 42, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 5, backgroundColor: '#232724' },
  moodText: { color: '#DCE1DD', fontSize: 13, fontWeight: '700' }, loading: { marginTop: 24 },
  result: { minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#292C29' },
  art: { width: 50, height: 50, borderRadius: 5, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#252925' },
  image: { width: '100%', height: '100%' }, resultText: { flex: 1, minWidth: 0, marginLeft: 12 },
  resultName: { color: '#EFF1EF', fontSize: 15, fontWeight: '700' }, resultMeta: { color: '#929B93', fontSize: 12, marginTop: 4 },
  empty: { color: '#89928A', textAlign: 'center', marginTop: 42 },
  genreResult: { height: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#292C29' },
});
