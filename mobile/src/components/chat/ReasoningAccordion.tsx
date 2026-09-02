import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BasicMarkdown } from '@kesha-antonov/react-native-chat';

import { useColors } from '../../theme/colors';

export function ReasoningAccordion({ text }: { text: string }) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  if (!text.trim()) return null;

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <Pressable onPress={() => setExpanded((v) => !v)} style={styles.header}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {expanded ? '▾' : '▸'} Thinking
        </Text>
      </Pressable>
      {expanded && (
        <View style={styles.body}>
          <BasicMarkdown text={text} textStyle={{ color: colors.textMuted, fontSize: 12 }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderLeftWidth: 2,
    paddingLeft: 8,
    marginVertical: 4,
  },
  header: {
    paddingVertical: 2,
  },
  label: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  body: {
    paddingTop: 2,
    paddingBottom: 4,
  },
});
