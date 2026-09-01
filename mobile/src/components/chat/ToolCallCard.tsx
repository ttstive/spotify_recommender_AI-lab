import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useColors } from '../../theme/colors';
import type { ToolPart } from '../../opencode/types';

export function ToolCallCard({ part }: { part: ToolPart }) {
  const colors = useColors();
  const status = part.state.status;
  const isActive = status === 'pending' || status === 'running';
  const isError = status === 'error';

  const borderColor = isError ? colors.danger : isActive ? colors.accent : colors.border;

  return (
    <View style={[styles.container, { borderColor, backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        {isActive ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Text style={[styles.icon, { color: isError ? colors.danger : colors.success }]}>
            {isError ? '⚠︎' : '✓'}
          </Text>
        )}
        <Text style={[styles.tool, { color: colors.text }]} numberOfLines={1}>
          {part.tool}
        </Text>
      </View>

      {(isActive || isError || part.state.output) && (
        <Text
          style={[styles.body, { color: isError ? colors.danger : colors.textMuted }]}
          numberOfLines={isActive ? undefined : 6}
        >
          {isError ? part.state.error ?? 'Tool call failed.' : part.state.output ?? 'Running…'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: 12,
    padding: 10,
    marginVertical: 4,
    gap: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 14,
    width: 16,
    textAlign: 'center',
  },
  tool: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
  },
  body: {
    fontSize: 12,
    lineHeight: 17,
  },
});
