import { Clock3, MessageSquareText, Plus, Trash2, X } from 'lucide-react-native';
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ChatHistoryItem } from '../../storage/localStorage';

const GREEN = '#53E076';

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function ChatHistoryModal({
  visible,
  items,
  currentId,
  onClose,
  onSelect,
  onNew,
  onDelete,
}: {
  visible: boolean;
  items: ChatHistoryItem[];
  currentId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  function confirmDelete(item: ChatHistoryItem) {
    Alert.alert('Excluir conversa?', `"${item.title}" será removida do histórico.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => onDelete(item.id) },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SUAS CONVERSAS</Text>
            <Text style={styles.title}>Histórico</Text>
          </View>
          <Pressable onPress={onClose} style={styles.iconButton} accessibilityLabel="Fechar histórico">
            <X color="#E5E2E1" size={23} />
          </Pressable>
        </View>

        <Pressable
          style={styles.newButton}
          onPress={() => { onNew(); onClose(); }}
        >
          <Plus color="#07150B" size={20} strokeWidth={3} />
          <Text style={styles.newButtonText}>Nova conversa</Text>
        </Pressable>

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={items.length ? styles.list : styles.emptyList}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MessageSquareText color="#59615A" size={34} />
              <Text style={styles.emptyTitle}>Nenhuma conversa salva</Text>
              <Text style={styles.emptyText}>Seus pedidos e recomendações aparecerão aqui.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const active = item.id === currentId;
            return (
              <Pressable
                style={[styles.item, active && styles.itemActive]}
                onPress={() => { onSelect(item.id); onClose(); }}
              >
                <View style={styles.itemContent}>
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                    {active ? <Text style={styles.activeLabel}>ABERTA</Text> : null}
                  </View>
                  <Text style={styles.preview} numberOfLines={1}>{item.preview}</Text>
                  <View style={styles.dateRow}>
                    <Clock3 color="#7F8980" size={12} />
                    <Text style={styles.date}>{formatDate(item.updatedAt)}</Text>
                  </View>
                </View>
                <Pressable onPress={() => confirmDelete(item)} style={styles.deleteButton} accessibilityLabel={`Excluir ${item.title}`}>
                  <Trash2 color="#9AA39B" size={18} />
                </Pressable>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#131313' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 18, borderBottomWidth: 1, borderBottomColor: '#2B2D2B' },
  eyebrow: { color: GREEN, fontSize: 10, fontWeight: '800', letterSpacing: 0 },
  title: { color: '#F1F2F1', fontSize: 28, fontWeight: '800', marginTop: 2 },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  newButton: { height: 48, margin: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 24, backgroundColor: GREEN },
  newButtonText: { color: '#07150B', fontSize: 15, fontWeight: '800' },
  list: { paddingHorizontal: 20, paddingBottom: 28 },
  emptyList: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32 },
  separator: { height: 1, backgroundColor: '#292B29' },
  item: { minHeight: 92, flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12 },
  itemActive: { borderLeftWidth: 3, borderLeftColor: GREEN, backgroundColor: '#1C201D' },
  itemContent: { flex: 1, minWidth: 0 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { flexShrink: 1, color: '#EBECEB', fontSize: 15, fontWeight: '700' },
  activeLabel: { color: GREEN, fontSize: 9, fontWeight: '800' },
  preview: { color: '#9AA39B', fontSize: 13, marginTop: 5 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7 },
  date: { color: '#7F8980', fontSize: 11 },
  deleteButton: { width: 44, height: 44, marginLeft: 8, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center' },
  emptyTitle: { color: '#E5E2E1', fontSize: 17, fontWeight: '700', marginTop: 14 },
  emptyText: { color: '#8F9890', fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 5 },
});
