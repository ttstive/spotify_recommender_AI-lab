import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { OpenCodeClient } from '../opencode/client';
import type { ModelRef, Provider } from '../opencode/types';
import { useColors } from '../theme/colors';

export function ModelPicker({
  visible,
  onClose,
  client,
  selected,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  client: OpenCodeClient | null;
  selected: ModelRef | null;
  onSelect: (model: ModelRef) => void;
}) {
  const colors = useColors();
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !client) return;
    let cancelled = false;
    setError(null);
    client
      .listModels()
      .then((res) => {
        if (!cancelled) setProviders(res.providers);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load models from the server.');
      });
    return () => {
      cancelled = true;
    };
  }, [visible, client]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Choose a model</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Text style={[styles.close, { color: colors.accent }]}>Done</Text>
          </Pressable>
        </View>

        {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
        {!providers && !error && <ActivityIndicator style={styles.loading} color={colors.accent} />}

        <ScrollView>
          {providers?.map((provider) => (
            <View key={provider.id}>
              <Text style={[styles.providerLabel, { color: colors.textMuted }]}>
                {provider.name ?? provider.id}
              </Text>
              {provider.models.map((model) => {
                const isSelected = selected?.providerID === provider.id && selected?.modelID === model.id;
                return (
                  <Pressable
                    key={model.id}
                    style={[styles.row, { borderColor: colors.border }]}
                    onPress={() => {
                      onSelect({ providerID: provider.id, modelID: model.id });
                      onClose();
                    }}
                  >
                    <Text style={[styles.rowText, { color: colors.text }]}>{model.name ?? model.id}</Text>
                    {isSelected && <Text style={{ color: colors.accent }}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '70%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  close: {
    fontSize: 14,
    fontWeight: '600',
  },
  loading: {
    paddingVertical: 24,
  },
  error: {
    fontSize: 13,
    paddingVertical: 12,
  },
  providerLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    fontSize: 15,
  },
});
