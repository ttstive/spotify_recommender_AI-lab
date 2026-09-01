import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ConnectionState } from '../opencode/useEventStream';
import { useColors } from '../theme/colors';

const COPY: Record<Exclude<ConnectionState, 'live'>, string> = {
  connecting: 'Connecting to OpenCode…',
  reconnecting: 'Reconnected lost — retrying…',
  offline: 'No server configured.',
};

export function ConnectionBanner({ state, onRetry }: { state: ConnectionState; onRetry: () => void }) {
  const colors = useColors();
  if (state === 'live') return null;

  return (
    <View style={[styles.container, { backgroundColor: colors.warningBackground, borderColor: colors.warning }]}>
      <Text style={[styles.text, { color: colors.warning }]}>{COPY[state]}</Text>
      <Pressable onPress={onRetry} hitSlop={8}>
        <Text style={[styles.retry, { color: colors.warning }]}>Retry now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 12,
    flexShrink: 1,
  },
  retry: {
    fontSize: 12,
    fontWeight: '600',
  },
});
