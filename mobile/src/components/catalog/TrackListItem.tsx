import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

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
    <Pressable style={styles.row} onPress={() => Linking.openURL(track.spotify_url)}>
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
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
    fontSize: 15,
    fontWeight: '600',
  },
  artist: {
    fontSize: 13,
  },
});
