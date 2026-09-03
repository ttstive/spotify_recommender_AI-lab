import { Image } from 'expo-image';
import { router } from 'expo-router';
import { MoreVertical } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getAlbumArt } from '../../api/albumArt';
import type { RecommendedTrackOut } from '../../api/types';
import { useColors } from '../../theme/colors';

const ART_SIZE = 56;

export function TrackListItem({ track }: { track: RecommendedTrackOut }) {
  const colors = useColors();
  const [artUrl, setArtUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAlbumArt(track.spotify_url).then((url) => {
      if (!cancelled) setArtUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [track.spotify_url]);

  return (
    <Pressable
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
      onPress={() => router.push({
        pathname: '/recommendation' as never,
        params: {
          name: track.name,
          artist: track.artist,
          url: track.spotify_url,
          art: artUrl ?? '',
          distance: String(track.distance),
          features: JSON.stringify(track.audio_features ?? {}),
        },
      })}
    >
      <View style={[styles.artWrapper, { backgroundColor: colors.surface }]}>
        {artUrl ? (
          <Image source={{ uri: artUrl }} style={styles.art} contentFit="cover" transition={150} />
        ) : (
          <Text style={[styles.artPlaceholder, { color: colors.textMuted }]}>♪</Text>
        )}
      </View>
      <View style={styles.textColumn}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {track.name}
        </Text>
        <Text style={[styles.artist, { color: colors.textMuted }]} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
      <MoreVertical color={colors.textMuted} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  artWrapper: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  art: {
    width: ART_SIZE,
    height: ART_SIZE,
  },
  artPlaceholder: {
    fontSize: 20,
  },
  textColumn: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
  },
  artist: {
    fontSize: 13,
  },
});
