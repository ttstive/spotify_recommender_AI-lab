import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createRecommenderClient, RecommenderError } from '../src/api/client';
import type { RecommendedTrackOut, SongSearchResult } from '../src/api/types';
import { TrackList } from '../src/components/catalog/TrackList';
import { useRecommenderConfig } from '../src/storage/recommenderConfig';
import { useColors } from '../src/theme/colors';

type Mode = 'song' | 'artist' | 'mood';
const MODES: { key: Mode; label: string }[] = [
  { key: 'song', label: 'Song' },
  { key: 'artist', label: 'Artist' },
  { key: 'mood', label: 'Mood' },
];

const RESULTS_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

export default function BrowseScreen() {
  const colors = useColors();
  const { config } = useRecommenderConfig();
  const client = useMemo(() => (config ? createRecommenderClient(config) : null), [config]);

  const [mode, setMode] = useState<Mode>('song');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SongSearchResult[]>([]);
  const [moods, setMoods] = useState<string[]>([]);
  const [tracks, setTracks] = useState<RecommendedTrackOut[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heading, setHeading] = useState<string | null>(null);

  function resetResults() {
    setTracks([]);
    setError(null);
    setHeading(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setQuery('');
    setSuggestions([]);
    resetResults();
  }

  // Typeahead for Song/Artist modes.
  useEffect(() => {
    if (!client || mode === 'mood' || !query.trim()) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const results = await client.searchSongs(query.trim(), mode);
        if (cancelled) return;
        if (mode === 'artist') {
          const seen = new Set<string>();
          const deduped: SongSearchResult[] = [];
          for (const r of results) {
            if (seen.has(r.artist)) continue;
            seen.add(r.artist);
            deduped.push(r);
          }
          setSuggestions(deduped);
        } else {
          setSuggestions(results);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [client, mode, query]);

  // Mood list, fetched once per client.
  useEffect(() => {
    if (!client || mode !== 'mood' || moods.length > 0) return;
    client.listMoods().then(
      (res) => setMoods(res.moods),
      () => setMoods([]),
    );
  }, [client, mode, moods.length]);

  async function runSearch(fn: () => Promise<RecommendedTrackOut[]>, label: string) {
    setIsLoading(true);
    setError(null);
    setHeading(label);
    try {
      setTracks(await fn());
    } catch (err) {
      setTracks([]);
      if (err instanceof RecommenderError) {
        setError(
          err.kind === 'network'
            ? 'Could not reach the recommender server. Check Settings.'
            : err.kind === 'not-found'
              ? err.message
              : 'Something went wrong fetching recommendations.',
        );
      } else {
        setError('Something went wrong fetching recommendations.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  function pickSongSuggestion(suggestion: SongSearchResult) {
    if (!client) return;
    setQuery(suggestion.song);
    setSuggestions([]);
    runSearch(() => client.getRecommendationsBySong(suggestion.song, RESULTS_LIMIT), `Because you like "${suggestion.song}"`);
  }

  function pickArtistSuggestion(suggestion: SongSearchResult) {
    if (!client) return;
    setQuery(suggestion.artist);
    setSuggestions([]);
    runSearch(
      () => client.getRecommendationsByArtist(suggestion.artist, RESULTS_LIMIT),
      `Fans of ${suggestion.artist} also like`,
    );
  }

  function pickMood(mood: string) {
    if (!client) return;
    runSearch(() => client.getRecommendationsByMood(mood, RESULTS_LIMIT), `Feeling ${mood}`);
  }

  if (!config) {
    return (
      <SafeAreaView style={[styles.container, styles.emptyState, { backgroundColor: colors.background }]} edges={['bottom']}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Recommender server not configured</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          Set the Recommender API URL in Settings to browse the catalog directly.
        </Text>
      </SafeAreaView>
    );
  }

  const header = (
    <View style={styles.header}>
      <View style={[styles.tabs, { borderColor: colors.border }]}>
        {MODES.map(({ key, label }) => {
          const active = key === mode;
          return (
            <Pressable
              key={key}
              style={[styles.tab, active && { backgroundColor: colors.accent }]}
              onPress={() => switchMode(key)}
            >
              <Text style={[styles.tabLabel, { color: active ? '#FFFFFF' : colors.textMuted }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'mood' ? (
        <View style={styles.chipRow}>
          {moods.map((mood) => (
            <Pressable
              key={mood}
              style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => pickMood(mood)}
            >
              <Text style={{ color: colors.text }}>{mood}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.text }]}
            placeholder={mode === 'song' ? 'Type a song name…' : 'Type an artist name…'}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={query}
            onChangeText={setQuery}
          />
          {suggestions.length > 0 && (
            <View style={[styles.suggestions, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              {suggestions.map((s, i) => (
                <Pressable
                  key={`${s.song}-${s.artist}-${i}`}
                  style={styles.suggestionRow}
                  onPress={() => (mode === 'song' ? pickSongSuggestion(s) : pickArtistSuggestion(s))}
                >
                  <Text style={{ color: colors.text }} numberOfLines={1}>
                    {mode === 'song' ? `${s.song} · ${s.artist}` : s.artist}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      )}

      {isLoading && <ActivityIndicator color={colors.accent} style={styles.spinner} />}
      {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
      {heading && !error && tracks.length > 0 && (
        <Text style={[styles.resultsHeading, { color: colors.textMuted }]}>{heading}</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <TrackList
        tracks={tracks}
        emptyMessage={heading ? 'No matches — try another search.' : 'Search for a song, artist, or mood to get started.'}
        ListHeaderComponent={header}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    gap: 12,
  },
  tabs: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  suggestions: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  spinner: {
    marginTop: 4,
  },
  error: {
    fontSize: 13,
  },
  resultsHeading: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
