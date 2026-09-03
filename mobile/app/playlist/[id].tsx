import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { ArrowLeft, Copy, Download, GripVertical, Merge, Plus, Search, Sparkles, Trash2, WandSparkles, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist';

import { createRecommenderClient } from '../../src/api/client';
import type { RecommendedTrackOut } from '../../src/api/types';
import { useLibrary, type PlaylistStrategy } from '../../src/storage/library';
import { useRecommenderConfig } from '../../src/storage/recommenderConfig';

const GREEN = '#53E076';
const STRATEGIES: { key: PlaylistStrategy; label: string; description: string }[] = [
  { key: 'smooth', label: 'Mix suave', description: 'Aproxima BPM, energia e tonalidade entre faixas.' },
  { key: 'energy', label: 'Jornada', description: 'Começa leve e cresce em energia.' },
  { key: 'variety', label: 'Variada', description: 'Evita artistas repetidos em sequência.' },
  { key: 'consistent', label: 'Consistente', description: 'Remove os maiores desvios e aproxima o conjunto.' },
];

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { playlists, addTrack, removeTrack, organizePlaylist, organizePlaylistFromPrompt, deletePlaylist, updatePlaylist, duplicatePlaylist, mergePlaylists, reorderPlaylist } = useLibrary();
  const { config } = useRecommenderConfig();
  const client = useMemo(() => config ? createRecommenderClient(config) : null, [config]);
  const playlist = playlists.find((item) => item.id === id);
  const [query, setQuery] = useState('');
  const [editableName, setEditableName] = useState(playlist?.name ?? '');
  const [organizerPrompt, setOrganizerPrompt] = useState('');
  const [results, setResults] = useState<RecommendedTrackOut[]>([]);

  useEffect(() => {
    if (!client || query.trim().length < 2) { setResults([]); return; }
    let active = true;
    const timer = setTimeout(() => client.searchTracks(query.trim(), 6).then((tracks) => active && setResults(tracks)).catch(() => active && setResults([])), 280);
    return () => { active = false; clearTimeout(timer); };
  }, [client, query]);

  if (!playlist) {
    return <SafeAreaView style={styles.screen}><Text style={styles.missing}>Playlist não encontrada.</Text></SafeAreaView>;
  }

  function applyStrategy(strategy: PlaylistStrategy) {
    organizePlaylist(playlist!.id, strategy);
    Alert.alert('Playlist organizada', STRATEGIES.find((item) => item.key === strategy)?.description);
  }

  function confirmDelete() {
    Alert.alert('Excluir playlist?', 'Essa ação remove apenas a playlist local.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => { deletePlaylist(playlist!.id); router.back(); } },
    ]);
  }

  function exportLinks() {
    Clipboard.setStringAsync(playlist!.tracks.map((track) => track.spotify_url).join('\n'));
    Alert.alert('Links copiados', 'A lista de links do Spotify está pronta para compartilhar.');
  }

  async function chooseCover() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) updatePlaylist(playlist!.id, { coverUri: result.assets[0].uri });
  }

  function mergeFirstAvailable() {
    const source = playlists.find((item) => item.id !== playlist!.id && item.tracks.length);
    if (!source) { Alert.alert('Nenhuma playlist disponível', 'Crie outra playlist com faixas para combinar.'); return; }
    mergePlaylists(playlist!.id, source.id);
    Alert.alert('Playlists combinadas', `As faixas de ${source.name} foram adicionadas sem duplicatas.`);
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton}><ArrowLeft color={GREEN} size={24} /></Pressable>
        <Text style={styles.brand}>Spot.AI</Text>
        <Pressable onPress={confirmDelete} style={styles.iconButton}><Trash2 color="#A9B1AA" size={20} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>PLAYLIST LOCAL</Text>
        <Pressable onPress={chooseCover} style={styles.coverPicker}>{playlist.coverUri ? <Image source={{ uri: playlist.coverUri }} style={styles.coverImage} /> : <><Sparkles color={GREEN} size={28} /><Text style={styles.coverLabel}>Escolher capa</Text></>}</Pressable>
        <TextInput value={editableName} onChangeText={setEditableName} onBlur={() => editableName.trim() && updatePlaylist(playlist.id, { name: editableName.trim() })} style={styles.titleInput} />
        <Text style={styles.meta}>{playlist.tracks.length} {playlist.tracks.length === 1 ? 'faixa' : 'faixas'} · salva neste aparelho</Text>
        <View style={styles.actions}>
          <Pressable style={styles.action} onPress={() => duplicatePlaylist(playlist.id)}><Copy color={GREEN} size={17} /><Text style={styles.actionText}>Duplicar</Text></Pressable>
          <Pressable style={styles.action} onPress={mergeFirstAvailable}><Merge color={GREEN} size={17} /><Text style={styles.actionText}>Combinar</Text></Pressable>
          <Pressable style={styles.action} onPress={exportLinks}><Download color={GREEN} size={17} /><Text style={styles.actionText}>Exportar</Text></Pressable>
        </View>

        <View style={styles.organizer}>
          <View style={styles.organizerTitle}><WandSparkles color={GREEN} size={18} /><Text style={styles.organizerText}>Organizar seleção</Text></View>
          <View style={styles.strategyRow}>{STRATEGIES.map((strategy) => <Pressable key={strategy.key} onPress={() => applyStrategy(strategy.key)} style={styles.strategy}><Text style={styles.strategyText}>{strategy.label}</Text></Pressable>)}</View>
          <View style={styles.promptRow}><TextInput value={organizerPrompt} onChangeText={setOrganizerPrompt} placeholder="Ex.: deixe mais consistente" placeholderTextColor="#7E8780" style={styles.promptInput} /><Pressable onPress={() => { if (!organizerPrompt.trim()) return; Alert.alert('Organização concluída', organizePlaylistFromPrompt(playlist.id, organizerPrompt)); setOrganizerPrompt(''); }} style={styles.promptButton}><WandSparkles color="#07150B" size={18} /></Pressable></View>
        </View>

        <Text style={styles.sectionTitle}>Adicionar músicas</Text>
        <View style={styles.searchBox}><Search color="#7F8980" size={19} /><TextInput value={query} onChangeText={setQuery} placeholder="Busque música ou artista" placeholderTextColor="#7F8980" style={styles.input} /></View>
        {results.length ? <View style={styles.results}>{results.map((track) => {
          const added = playlist.tracks.some((item) => item.spotify_url === track.spotify_url);
          return <Pressable key={track.spotify_url} disabled={added} onPress={() => addTrack(playlist.id, track)} style={styles.resultRow}><View style={styles.resultText}><Text style={styles.trackName} numberOfLines={1}>{track.name}</Text><Text style={styles.artist} numberOfLines={1}>{track.artist}</Text></View>{added ? <Text style={styles.added}>ADICIONADA</Text> : <Plus color={GREEN} size={20} />}</Pressable>;
        })}</View> : null}

        <Text style={[styles.sectionTitle, styles.tracksTitle]}>Faixas</Text>
        {playlist.tracks.length ? <DraggableFlatList
          data={playlist.tracks}
          keyExtractor={(track) => track.spotify_url}
          scrollEnabled={false}
          onDragEnd={({ data }) => reorderPlaylist(playlist.id, data)}
          renderItem={({ item: track, drag, getIndex }: RenderItemParams<RecommendedTrackOut>) => <Pressable onLongPress={drag} delayLongPress={140} style={styles.trackRow}>
            <GripVertical color="#687169" size={18} /><Text style={styles.index}>{(getIndex() ?? 0) + 1}</Text>
            <View style={styles.resultText}><Text style={styles.trackName} numberOfLines={1}>{track.name}</Text><Text style={styles.artist} numberOfLines={1}>{track.artist}</Text></View>
            <Pressable onPress={() => removeTrack(playlist.id, track.spotify_url)} style={styles.remove}><X color="#929B93" size={18} /></Pressable>
          </Pressable>}
        /> : <View style={styles.empty}><Sparkles color="#59615A" size={28} /><Text style={styles.emptyText}>Busque faixas acima ou salve uma seleção criada pela IA.</Text></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#131313' }, header: { height: 64, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#292B29' }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, brand: { color: GREEN, fontSize: 22, fontWeight: '800' }, content: { padding: 20, paddingBottom: 44 },
  eyebrow: { color: GREEN, fontSize: 10, fontWeight: '800' }, coverPicker: { width: 112, height: 112, marginTop: 14, borderRadius: 6, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#242824' }, coverImage: { width: '100%', height: '100%' }, coverLabel: { color: '#A7B0A8', fontSize: 11, marginTop: 7 }, titleInput: { color: '#F3F4F3', fontSize: 30, lineHeight: 38, fontWeight: '800', marginTop: 12, padding: 0 }, meta: { color: '#929B93', fontSize: 12, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 18 }, action: { flex: 1, height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 5, backgroundColor: '#242824' }, actionText: { color: '#CDD3CE', fontSize: 11, fontWeight: '700' },
  organizer: { marginTop: 22, padding: 14, borderWidth: 1, borderColor: '#354038', borderRadius: 7, backgroundColor: '#1D201E' }, organizerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 }, organizerText: { color: '#EDF0ED', fontSize: 15, fontWeight: '700' }, strategyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 }, strategy: { width: '48%', minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 5, backgroundColor: '#2A2E2B' }, strategyText: { color: '#CAD0CB', fontSize: 11, fontWeight: '700' }, promptRow: { height: 46, marginTop: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#343A35', borderRadius: 6, overflow: 'hidden' }, promptInput: { flex: 1, paddingHorizontal: 11, color: '#EDF0ED', fontSize: 12 }, promptButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: GREEN },
  sectionTitle: { color: '#F0F1F0', fontSize: 18, fontWeight: '800', marginTop: 26, marginBottom: 10 }, searchBox: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderWidth: 1, borderColor: '#363A36', borderRadius: 7, backgroundColor: '#1B1D1B' }, input: { flex: 1, color: '#F0F1F0', fontSize: 14 }, results: { marginTop: 8, borderWidth: 1, borderColor: '#303330', borderRadius: 7, overflow: 'hidden' }, resultRow: { minHeight: 56, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#2A2C2A' }, resultText: { flex: 1, minWidth: 0 }, trackName: { color: '#ECEEEC', fontSize: 14, fontWeight: '700' }, artist: { color: '#929B93', fontSize: 11, marginTop: 3 }, added: { color: '#778078', fontSize: 9, fontWeight: '800' },
  tracksTitle: { marginTop: 28 }, trackRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#292B29' }, index: { width: 28, color: '#737C74', fontSize: 12 }, remove: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, empty: { alignItems: 'center', paddingVertical: 36 }, emptyText: { maxWidth: 250, color: '#858E86', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 10 }, missing: { color: '#E5E2E1', margin: 24 },
});
