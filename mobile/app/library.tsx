import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Heart, ListMusic, Music2, Plus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAlbumArt } from '../src/api/albumArt';
import type { RecommendedTrackOut } from '../src/api/types';
import { AppHeader, BottomNav } from '../src/components/AppChrome';
import { useLibrary } from '../src/storage/library';

const GREEN = '#53E076';

function FavoriteCard({ track }: { track: RecommendedTrackOut }) {
  const [art, setArt] = useState<string | null>(null);
  useEffect(() => { getAlbumArt(track.spotify_url).then(setArt); }, [track.spotify_url]);
  return (
    <Pressable style={styles.favorite} onPress={() => router.push({ pathname: '/recommendation', params: { name: track.name, artist: track.artist, url: track.spotify_url, art: art ?? '', distance: String(track.distance), features: JSON.stringify(track.audio_features ?? {}), genre: track.genre ?? '', context: 'Músicas salvas' } })}>
      <View style={styles.favoriteArt}>{art ? <Image source={{ uri: art }} style={styles.image} /> : <Music2 color="#758076" size={24} />}</View>
      <Text style={styles.favoriteName} numberOfLines={1}>{track.name}</Text>
      <Text style={styles.favoriteArtist} numberOfLines={1}>{track.artist}</Text>
    </Pressable>
  );
}

export default function LibraryScreen() {
  const { favorites, playlists, createPlaylist } = useLibrary();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  function submit() {
    const value = name.trim();
    if (!value) return;
    const id = createPlaylist(value);
    setName('');
    setCreating(false);
    router.push({ pathname: '/playlist/[id]', params: { id } });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleRow}>
          <View><Text style={styles.eyebrow}>SUA COLEÇÃO</Text><Text style={styles.title}>Biblioteca</Text></View>
          <Pressable onPress={() => setCreating(true)} style={styles.addButton}><Plus color="#07150B" size={22} strokeWidth={3} /></Pressable>
        </View>

        <Text style={styles.sectionTitle}>Playlists</Text>
        {playlists.length ? playlists.map((playlist) => (
          <Pressable key={playlist.id} style={styles.playlistRow} onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } })}>
            <View style={styles.playlistIcon}>{playlist.coverUri ? <Image source={{ uri: playlist.coverUri }} style={styles.image} /> : <ListMusic color={GREEN} size={25} />}</View>
            <View style={styles.playlistText}>
              <Text style={styles.playlistName} numberOfLines={1}>{playlist.name}</Text>
              <Text style={styles.playlistMeta}>{playlist.tracks.length} {playlist.tracks.length === 1 ? 'faixa' : 'faixas'}</Text>
            </View>
          </Pressable>
        )) : <Text style={styles.emptyText}>Crie uma playlist para organizar suas descobertas.</Text>}

        <View style={styles.savedTitle}><Heart color={GREEN} fill={GREEN} size={18} /><Text style={styles.savedSectionTitle}>Músicas salvas</Text></View>
        {favorites.length ? (
          <FlatList horizontal data={favorites} keyExtractor={(item) => item.spotify_url} renderItem={({ item }) => <FavoriteCard track={item} />} contentContainerStyle={styles.favoriteList} showsHorizontalScrollIndicator={false} scrollEnabled nestedScrollEnabled />
        ) : <Text style={styles.emptyText}>Toque no coração de uma faixa para salvá-la aqui.</Text>}
      </ScrollView>
      <BottomNav />

      <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <View style={styles.dialogHeader}><Text style={styles.dialogTitle}>Nova playlist</Text><Pressable onPress={() => setCreating(false)}><X color="#C8CEC9" size={22} /></Pressable></View>
            <TextInput autoFocus value={name} onChangeText={setName} onSubmitEditing={submit} placeholder="Nome da playlist" placeholderTextColor="#788179" style={styles.input} />
            <Pressable onPress={submit} style={styles.createButton}><Text style={styles.createText}>Criar playlist</Text></Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#131313' }, content: { paddingBottom: 32 },
  titleRow: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { color: GREEN, fontSize: 10, fontWeight: '800' }, title: { color: '#F2F3F2', fontSize: 30, fontWeight: '800', marginTop: 2 },
  addButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: '#F0F1F0', fontSize: 19, fontWeight: '800', marginHorizontal: 20, marginBottom: 12 },
  playlistRow: { minHeight: 70, marginHorizontal: 20, marginBottom: 8, padding: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#303330', borderRadius: 7, backgroundColor: '#1D1F1D' },
  playlistIcon: { width: 48, height: 48, backgroundColor: '#292D29', alignItems: 'center', justifyContent: 'center', borderRadius: 5 }, playlistText: { flex: 1, marginLeft: 12 },
  playlistName: { color: '#F0F1F0', fontSize: 16, fontWeight: '700' }, playlistMeta: { color: '#929B93', fontSize: 12, marginTop: 4 },
  emptyText: { color: '#8F9890', fontSize: 13, lineHeight: 19, marginHorizontal: 20, marginBottom: 24 },
  savedTitle: { flexDirection: 'row', alignItems: 'center', gap: 9, marginHorizontal: 20, marginTop: 24, marginBottom: 12 }, savedSectionTitle: { color: '#F0F1F0', fontSize: 19, fontWeight: '800' }, favoriteList: { paddingHorizontal: 20, gap: 12 }, favorite: { width: 118 },
  favoriteArt: { width: 118, height: 118, borderRadius: 5, overflow: 'hidden', backgroundColor: '#242724', alignItems: 'center', justifyContent: 'center' }, image: { width: '100%', height: '100%' },
  favoriteName: { color: '#EDEeed', fontSize: 13, fontWeight: '700', marginTop: 7 }, favoriteArtist: { color: '#929B93', fontSize: 11, marginTop: 2 },
  overlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.72)' }, dialog: { padding: 20, borderRadius: 8, borderWidth: 1, borderColor: '#343734', backgroundColor: '#202220' },
  dialogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, dialogTitle: { color: '#F1F2F1', fontSize: 20, fontWeight: '800' },
  input: { height: 50, marginTop: 20, paddingHorizontal: 14, borderWidth: 1, borderColor: '#3B403C', borderRadius: 6, color: '#F1F2F1', backgroundColor: '#171817' },
  createButton: { height: 48, marginTop: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 24, backgroundColor: GREEN }, createText: { color: '#07150B', fontWeight: '800' },
});
