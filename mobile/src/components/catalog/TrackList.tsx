import type { ComponentProps } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import type { RecommendedTrackOut } from '../../api/types';
import { useColors } from '../../theme/colors';
import { TrackListItem } from './TrackListItem';

export function TrackList({
  tracks,
  emptyMessage = 'No results yet.',
  scrollEnabled = true,
  ListHeaderComponent,
}: {
  tracks: RecommendedTrackOut[];
  emptyMessage?: string;
  scrollEnabled?: boolean;
  ListHeaderComponent?: ComponentProps<typeof FlatList>['ListHeaderComponent'];
}) {
  const colors = useColors();

  return (
    <FlatList
      data={tracks}
      keyExtractor={(track, index) => `${track.spotify_url}-${index}`}
      renderItem={({ item }) => <TrackListItem track={item} />}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={{ color: colors.textMuted }}>{emptyMessage}</Text>
        </View>
      }
      scrollEnabled={scrollEnabled}
      contentContainerStyle={tracks.length === 0 ? styles.emptyContainer : undefined}
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyContainer: {
    flexGrow: 1,
  },
});
