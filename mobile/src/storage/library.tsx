import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { RecommendedTrackOut } from '../api/types';

const STORAGE_KEY = 'spotai_local_library_v1';

export type PlaylistStrategy = 'smooth' | 'energy' | 'variety' | 'consistent';

export interface LocalPlaylist {
  id: string;
  name: string;
  description: string;
  coverUri?: string;
  tracks: RecommendedTrackOut[];
  createdAt: number;
  updatedAt: number;
}

interface LibraryState {
  favorites: RecommendedTrackOut[];
  playlists: LocalPlaylist[];
  recentTracks: RecommendedTrackOut[];
}

interface LibraryContextValue extends LibraryState {
  loaded: boolean;
  isFavorite: (spotifyUrl: string) => boolean;
  toggleFavorite: (track: RecommendedTrackOut) => void;
  addRecentTrack: (track: RecommendedTrackOut) => void;
  createPlaylist: (name: string, description?: string, tracks?: RecommendedTrackOut[]) => string;
  deletePlaylist: (id: string) => void;
  updatePlaylist: (id: string, changes: Partial<Pick<LocalPlaylist, 'name' | 'description' | 'coverUri'>>) => void;
  duplicatePlaylist: (id: string) => string | null;
  mergePlaylists: (targetId: string, sourceId: string) => void;
  reorderPlaylist: (id: string, tracks: RecommendedTrackOut[]) => void;
  addTrack: (playlistId: string, track: RecommendedTrackOut) => void;
  removeTrack: (playlistId: string, spotifyUrl: string) => void;
  organizePlaylist: (playlistId: string, strategy: PlaylistStrategy) => void;
  organizePlaylistFromPrompt: (playlistId: string, prompt: string) => string;
}

const EMPTY_STATE: LibraryState = { favorites: [], playlists: [], recentTracks: [] };
const LibraryContext = createContext<LibraryContextValue | null>(null);

function feature(track: RecommendedTrackOut, key: string, fallback = 0): number {
  return track.audio_features?.[key] ?? fallback;
}

function organize(tracks: RecommendedTrackOut[], strategy: PlaylistStrategy): RecommendedTrackOut[] {
  if (strategy === 'energy') {
    return [...tracks].sort((a, b) => feature(a, 'energy') - feature(b, 'energy'));
  }
  if (strategy === 'variety') {
    const remaining = [...tracks].sort((a, b) => feature(b, 'popularity') - feature(a, 'popularity'));
    const result: RecommendedTrackOut[] = [];
    while (remaining.length) {
      const lastArtist = result.at(-1)?.artist;
      const index = remaining.findIndex((track) => track.artist !== lastArtist);
      result.push(remaining.splice(index >= 0 ? index : 0, 1)[0]);
    }
    return result;
  }
  if (strategy === 'consistent' && tracks.length > 3) {
    const average = (key: string) => tracks.reduce((sum, track) => sum + feature(track, key), 0) / tracks.length;
    const center = { energy: average('energy'), valence: average('valence'), tempo: average('tempo') };
    const ranked = [...tracks].sort((a, b) => {
      const score = (track: RecommendedTrackOut) => Math.abs(feature(track, 'energy') - center.energy) + Math.abs(feature(track, 'valence') - center.valence) + Math.abs(feature(track, 'tempo') - center.tempo) / 100;
      return score(a) - score(b);
    });
    return organize(ranked.slice(0, Math.max(3, Math.ceil(tracks.length * 0.8))), 'smooth');
  }

  if (tracks.length < 3) return tracks;
  const remaining = [...tracks];
  const result = [remaining.shift()!];
  while (remaining.length) {
    const previous = result.at(-1)!;
    const score = (track: RecommendedTrackOut) => (
      Math.abs(feature(previous, 'tempo') - feature(track, 'tempo')) / 80
      + Math.abs(feature(previous, 'energy') - feature(track, 'energy'))
      + Math.abs(feature(previous, 'valence') - feature(track, 'valence'))
      + (feature(previous, 'key') === feature(track, 'key') ? 0 : 0.2)
    );
    let best = 0;
    for (let index = 1; index < remaining.length; index += 1) {
      if (score(remaining[index]) < score(remaining[best])) best = index;
    }
    result.push(remaining.splice(best, 1)[0]);
  }
  return result;
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LibraryState>(EMPTY_STATE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try { setState({ ...EMPTY_STATE, ...JSON.parse(raw) }); } catch { setState(EMPTY_STATE); }
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [loaded, state]);

  const toggleFavorite = useCallback((track: RecommendedTrackOut) => {
    setState((current) => ({
      ...current,
      favorites: current.favorites.some((item) => item.spotify_url === track.spotify_url)
        ? current.favorites.filter((item) => item.spotify_url !== track.spotify_url)
        : [track, ...current.favorites],
    }));
  }, []);

  const addRecentTrack = useCallback((track: RecommendedTrackOut) => {
    if (!track.spotify_url) return;
    setState((current) => ({ ...current, recentTracks: [track, ...current.recentTracks.filter((item) => item.spotify_url !== track.spotify_url)].slice(0, 20) }));
  }, []);

  const createPlaylist = useCallback((name: string, description = '', tracks: RecommendedTrackOut[] = []) => {
    const id = `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = Date.now();
    setState((current) => ({ ...current, playlists: [{ id, name, description, tracks, createdAt: now, updatedAt: now }, ...current.playlists] }));
    return id;
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    setState((current) => ({ ...current, playlists: current.playlists.filter((playlist) => playlist.id !== id) }));
  }, []);

  const updatePlaylist = useCallback((id: string, changes: Partial<Pick<LocalPlaylist, 'name' | 'description' | 'coverUri'>>) => {
    setState((current) => ({ ...current, playlists: current.playlists.map((playlist) => playlist.id === id ? { ...playlist, ...changes, updatedAt: Date.now() } : playlist) }));
  }, []);

  const duplicatePlaylist = useCallback((id: string) => {
    const source = state.playlists.find((playlist) => playlist.id === id);
    if (!source) return null;
    return createPlaylist(`${source.name} (cópia)`, source.description, source.tracks);
  }, [state.playlists, createPlaylist]);

  const mergePlaylists = useCallback((targetId: string, sourceId: string) => {
    setState((current) => {
      const source = current.playlists.find((playlist) => playlist.id === sourceId);
      if (!source) return current;
      return { ...current, playlists: current.playlists.map((playlist) => {
        if (playlist.id !== targetId) return playlist;
        const urls = new Set(playlist.tracks.map((track) => track.spotify_url));
        return { ...playlist, tracks: [...playlist.tracks, ...source.tracks.filter((track) => !urls.has(track.spotify_url))], updatedAt: Date.now() };
      }) };
    });
  }, []);

  const reorderPlaylist = useCallback((id: string, tracks: RecommendedTrackOut[]) => {
    setState((current) => ({ ...current, playlists: current.playlists.map((playlist) => playlist.id === id ? { ...playlist, tracks, updatedAt: Date.now() } : playlist) }));
  }, []);

  const addTrack = useCallback((playlistId: string, track: RecommendedTrackOut) => {
    setState((current) => ({ ...current, playlists: current.playlists.map((playlist) => playlist.id === playlistId && !playlist.tracks.some((item) => item.spotify_url === track.spotify_url) ? { ...playlist, tracks: [...playlist.tracks, track], updatedAt: Date.now() } : playlist) }));
  }, []);

  const removeTrack = useCallback((playlistId: string, spotifyUrl: string) => {
    setState((current) => ({ ...current, playlists: current.playlists.map((playlist) => playlist.id === playlistId ? { ...playlist, tracks: playlist.tracks.filter((track) => track.spotify_url !== spotifyUrl), updatedAt: Date.now() } : playlist) }));
  }, []);

  const organizePlaylist = useCallback((playlistId: string, strategy: PlaylistStrategy) => {
    setState((current) => ({ ...current, playlists: current.playlists.map((playlist) => playlist.id === playlistId ? { ...playlist, tracks: organize(playlist.tracks, strategy), updatedAt: Date.now() } : playlist) }));
  }, []);

  const organizePlaylistFromPrompt = useCallback((playlistId: string, prompt: string) => {
    const value = prompt.toLocaleLowerCase();
    const strategy: PlaylistStrategy = /(remov|diferente|consisten)/.test(value) ? 'consistent' : /(calm|animad|energia|cres)/.test(value) ? 'energy' : /(vari|altern|repet)/.test(value) ? 'variety' : 'smooth';
    organizePlaylist(playlistId, strategy);
    return strategy === 'consistent' ? 'Removi os maiores desvios e suavizei a sequência.' : strategy === 'energy' ? 'Ordenei a playlist como uma jornada crescente.' : strategy === 'variety' ? 'Distribuí os artistas para evitar repetições.' : 'Criei transições próximas em ritmo, energia e tonalidade.';
  }, [organizePlaylist]);

  const value = useMemo<LibraryContextValue>(() => ({
    ...state,
    loaded,
    isFavorite: (spotifyUrl) => state.favorites.some((track) => track.spotify_url === spotifyUrl),
    toggleFavorite,
    addRecentTrack,
    createPlaylist,
    deletePlaylist,
    updatePlaylist,
    duplicatePlaylist,
    mergePlaylists,
    reorderPlaylist,
    addTrack,
    removeTrack,
    organizePlaylist,
    organizePlaylistFromPrompt,
  }), [state, loaded, toggleFavorite, addRecentTrack, createPlaylist, deletePlaylist, updatePlaylist, duplicatePlaylist, mergePlaylists, reorderPlaylist, addTrack, removeTrack, organizePlaylist, organizePlaylistFromPrompt]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): LibraryContextValue {
  const value = useContext(LibraryContext);
  if (!value) throw new Error('useLibrary must be used inside LibraryProvider');
  return value;
}
