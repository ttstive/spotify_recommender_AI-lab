import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowUp, Plus, Search, Settings, Square } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bubble, Chat, InputToolbar, Send, type IMessage } from '@kesha-antonov/react-native-chat';

import { ConnectionBanner } from '../src/components/ConnectionBanner';
import { AppHeader, BottomNav } from '../src/components/AppChrome';
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
      <AppHeader />
      <View style={[styles.header, { borderColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Pressable onPress={() => setIsModelPickerVisible(true)}>
            <Text style={[styles.modelLabel, { color: colors.text }]} numberOfLines={1}>
              {selectedModel ? selectedModel.modelID : 'Modelo padrao'}
            </Text>
          </Pressable>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={() => router.push('/browse')} hitSlop={8} style={styles.headerButton}>
            <Search color={colors.accent} size={20} />
          </Pressable>
          <Pressable onPress={handleNewChat} hitSlop={8} style={styles.headerButton}>
            <Plus color={colors.accent} size={22} />
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} hitSlop={8} style={styles.headerButton}>
            <Settings color={colors.accent} size={20} />
          </Pressable>
        </View>
      </View>

      <View style={styles.chatContainer}>
        <Chat<ChatMessage>
          messages={messages}
          isInverted={false}
          isScrollToBottomEnabled
          messagesContainerStyle={styles.messagesContainer}
          onSend={handleSend}
          user={CURRENT_USER}
          colorScheme="dark"
          darkTheme={{
            colors: {
              background: colors.background,
              incomingBubble: colors.surface,
              outgoingBubble: colors.accent,
              accent: colors.accent,
            },
          }}
          renderAvatar={() => null}
          renderDay={() => null}
          renderTime={() => null}
          isDayAnimationEnabled={false}
          renderBubble={(props) => (
            <Bubble
              {...props}
              wrapperStyle={{ left: styles.incomingBubble, right: styles.outgoingBubble }}
              containerStyle={{ left: styles.bubbleContainerLeft, right: styles.bubbleContainerRight }}
              renderMessageText={(textProps) => (
                <MessagePartsList message={textProps.currentMessage} position={textProps.position ?? 'left'} />
              )}
              renderTime={() => null}
            />
          )}
          renderInputToolbar={(props) => <InputToolbar {...props} containerStyle={styles.inputToolbar} />}
          textInputProps={{ placeholder: 'Descreva a vibe que voce procura...', placeholderTextColor: colors.textMuted, style: styles.composer }}
          isSendButtonAlwaysVisible
          renderFooter={() =>
            isGenerating ? (
              <View style={styles.typingRow}>
                <View style={styles.typingDot} />
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>Preparando sua resposta...</Text>
              </View>
            ) : null
          }
          renderChatFooter={() => (
            <>
              <ConnectionBanner state={connectionState} onRetry={refresh} />
              {error && (
                <View style={[styles.errorBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.errorText, { color: colors.text }]} numberOfLines={2}>
                    Nao foi possivel enviar agora.
                  </Text>
                  {canRetry && (
                    <Pressable onPress={retryLastMessage} hitSlop={8}>
                      <Text style={[styles.retryText, { color: colors.text }]}>Tentar novamente</Text>
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
                <Square color="#FFFFFF" fill="#FFFFFF" size={12} />
              </Pressable>
            ) : (
              <Send {...props} containerStyle={styles.sendButton}>
                <ArrowUp color="#003914" size={21} strokeWidth={3} />
              </Send>
            )
          }
          messageActions={(message: ChatMessage) => [
            { label: 'Copy', onPress: () => Clipboard.setStringAsync(flattenForCopy(message)) },
          ]}
          listProps={{ onRefresh: refresh, refreshing: false }}
        />
      </View>

      <BottomNav />

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
    backgroundColor: '#131313',
  },
  messagesContainer: {
    backgroundColor: '#131313',
  },
  incomingBubble: { maxWidth: '88%', padding: 16, borderRadius: 16, borderTopLeftRadius: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(33,33,33,0.92)' },
  outgoingBubble: { maxWidth: '88%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderTopRightRadius: 2, backgroundColor: '#53E076' },
  bubbleContainerLeft: { marginLeft: 12, marginBottom: 8 },
  bubbleContainerRight: { marginRight: 12, marginBottom: 8 },
  inputToolbar: { marginHorizontal: 12, marginBottom: 8, minHeight: 58, paddingHorizontal: 8, borderTopWidth: 0, borderWidth: 1, borderColor: 'rgba(83,224,118,0.24)', borderRadius: 30, backgroundColor: '#202522' },
  composer: { flex: 1, minHeight: 48, maxHeight: 96, color: '#E5E2E1', fontSize: 15, paddingHorizontal: 10, paddingTop: 13 },
  sendButton: { width: 42, height: 42, margin: 7, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#53E076' },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#53E076' },
  errorBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
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
