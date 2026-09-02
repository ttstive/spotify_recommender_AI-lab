import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chat, Send, type IMessage } from '@kesha-antonov/react-native-chat';

import { ConnectionBanner } from '../src/components/ConnectionBanner';
import { MessagePartsList } from '../src/components/chat/MessagePartsList';
import { ModelPicker } from '../src/components/ModelPicker';
import { CURRENT_USER, type ChatMessage } from '../src/opencode/mapToChatMessage';
import type { MessagePart, ReasoningPart, TextPart } from '../src/opencode/types';
import { useChatSession } from '../src/opencode/useChatSession';
import { useConnectionConfig } from '../src/storage/connectionConfig';
import { useColors } from '../src/theme/colors';

function isTextLike(part: MessagePart): part is TextPart | ReasoningPart {
  return part.type === 'text' || part.type === 'reasoning';
}

function flattenForCopy(message: ChatMessage): string {
  return message.parts.filter(isTextLike).map((p) => p.text).join('\n\n');
}

export default function ChatScreen() {
  const colors = useColors();
  const { config, isLoaded } = useConnectionConfig();
  const {
    client,
    messages,
    connectionState,
    isGenerating,
    error,
    canRetry,
    retryLastMessage,
    sendMessage,
    interrupt,
    startNewChat,
    selectedModel,
    setSelectedModel,
    refresh,
  } = useChatSession();

  const [isModelPickerVisible, setIsModelPickerVisible] = useState(false);

  function handleSend(newMessages: IMessage[] = []) {
    const text = newMessages[0]?.text?.trim();
    if (text) sendMessage(text);
  }

  function handleNewChat() {
    Alert.alert(
      'Start a new chat?',
      'This clears the current conversation from view. The old one stays on the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'New Chat',
          style: 'destructive',
          onPress: () => {
            Haptics.selectionAsync();
            startNewChat();
          },
        },
      ],
    );
  }

  const dotColor =
    connectionState === 'live' ? colors.success : connectionState === 'reconnecting' ? colors.warning : colors.textMuted;

  if (isLoaded && !config) {
    return (
      <SafeAreaView style={[styles.container, styles.emptyState, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Connect to your OpenCode server</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          Point this app at a running opencode serve to start chatting.
        </Text>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: colors.accent }]}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.primaryButtonText}>Open Settings</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Pressable onPress={() => setIsModelPickerVisible(true)}>
            <Text style={[styles.modelLabel, { color: colors.text }]} numberOfLines={1}>
              {selectedModel ? selectedModel.modelID : 'Default model'} ▾
            </Text>
          </Pressable>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={() => router.push('/browse')} hitSlop={8} style={styles.headerButton}>
            <Text style={[styles.headerIcon, { color: colors.accent }]}>🔍</Text>
          </Pressable>
          <Pressable onPress={handleNewChat} hitSlop={8} style={styles.headerButton}>
            <Text style={[styles.headerIcon, { color: colors.accent }]}>＋</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} hitSlop={8} style={styles.headerButton}>
            <Text style={[styles.headerIcon, { color: colors.accent }]}>⚙︎</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.chatContainer}>
        <Chat<ChatMessage>
          messages={messages}
          onSend={handleSend}
          user={CURRENT_USER}
          colorScheme="dark"
          theme={{
            colors: {
              background: colors.background,
              incomingBubble: colors.surface,
              outgoingBubble: colors.accent,
              accent: colors.accent,
            },
          }}
          renderAvatar={() => null}
          renderMessageText={(props) => (
            <MessagePartsList message={props.currentMessage} position={props.position ?? 'left'} />
          )}
          renderFooter={() =>
            isGenerating ? (
              <View style={styles.typingRow}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>OpenCode is working…</Text>
              </View>
            ) : null
          }
          renderChatFooter={() => (
            <>
              <ConnectionBanner state={connectionState} onRetry={refresh} />
              {error && (
                <View style={[styles.errorBar, { backgroundColor: colors.warningBackground }]}>
                  <Text style={[styles.errorText, { color: colors.danger }]} numberOfLines={2}>
                    {error}
                  </Text>
                  {canRetry && (
                    <Pressable onPress={retryLastMessage} hitSlop={8}>
                      <Text style={[styles.retryText, { color: colors.danger }]}>Retry</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </>
          )}
          renderSend={(props) =>
            isGenerating ? (
              <Pressable
                style={[styles.stopButton, { backgroundColor: colors.danger }]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  interrupt();
                }}
              >
                <Text style={styles.stopIcon}>■</Text>
              </Pressable>
            ) : (
              <Send {...props} />
            )
          }
          messageActions={(message: ChatMessage) => [
            { label: 'Copy', onPress: () => Clipboard.setStringAsync(flattenForCopy(message)) },
          ]}
          listProps={{ onRefresh: refresh, refreshing: false }}
        />
      </View>

      <ModelPicker
        visible={isModelPickerVisible}
        onClose={() => setIsModelPickerVisible(false)}
        client={client}
        selected={selectedModel}
        onSelect={setSelectedModel}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
  },
  headerButton: {
    padding: 2,
  },
  headerIcon: {
    fontSize: 18,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modelLabel: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  typingRow: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  errorBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  errorText: {
    fontSize: 12,
    flexShrink: 1,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  stopButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  stopIcon: {
    color: '#FFFFFF',
    fontSize: 12,
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
  primaryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
