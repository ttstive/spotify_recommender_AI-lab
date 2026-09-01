import { StyleSheet, Text, View } from 'react-native';

import { useColors } from '../../theme/colors';
import type { FilePart } from '../../opencode/types';

export function FileChip({ part }: { part: FilePart }) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.text, { color: colors.text }]} numberOfLines={1}>
        📎 {part.filename ?? 'file'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginVertical: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
  },
});
