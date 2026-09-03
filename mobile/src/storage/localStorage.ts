import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ChatMessage } from '../opencode/mapToChatMessage';
import type { ModelRef } from '../opencode/types';

const KEYS = {
  sessionId: 'opencode_current_session_id',
  selectedModel: 'opencode_selected_model',
  legacyCachedMessages: 'opencode_cached_messages',
  chatHistory: 'opencode_chat_history',
  sessionMessages: 'opencode_session_messages:',
} as const;

export interface ChatHistoryItem {
  id: string;
  title: string;
  preview: string;
  updatedAt: number;
}

export async function getStoredSessionId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.sessionId);
}

export async function setStoredSessionId(sessionId: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.sessionId, sessionId);
}

export async function clearStoredSessionId(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.sessionId);
}

export async function getStoredModel(): Promise<ModelRef | null> {
  const raw = await AsyncStorage.getItem(KEYS.selectedModel);
  return raw ? (JSON.parse(raw) as ModelRef) : null;
}

export async function setStoredModel(model: ModelRef): Promise<void> {
  await AsyncStorage.setItem(KEYS.selectedModel, JSON.stringify(model));
}

const MAX_CACHED_MESSAGES = 50;
const MAX_HISTORY_ITEMS = 30;

function textFromMessage(message: ChatMessage): string {
  const text = message.parts.find((part) => part.type === 'text' && part.text.trim());
  if (text?.type === 'text') return text.text.trim();
  const playlist = message.parts.find((part) => part.type === 'tool' && part.state.status === 'completed');
  if (playlist?.type === 'tool' && playlist.state.output) {
    try {
      const parsed = JSON.parse(playlist.state.output);
      return parsed.title || 'Selecao de musicas';
    } catch {
      return 'Selecao de musicas';
    }
  }
  return '';
}

function summarize(sessionId: string, messages: ChatMessage[]): ChatHistoryItem {
  const texts = messages.map(textFromMessage).filter(Boolean);
  const firstUser = messages.find((message) => message.user._id === 'me' && textFromMessage(message));
  const title = firstUser ? textFromMessage(firstUser) : texts[0] || 'Nova conversa';
  return {
    id: sessionId,
    title: title.length > 48 ? `${title.slice(0, 47)}...` : title,
    preview: texts.at(-1)?.slice(0, 72) || 'Conversa sem mensagens',
    updatedAt: Date.now(),
  };
}

export async function getChatHistory(): Promise<ChatHistoryItem[]> {
  const raw = await AsyncStorage.getItem(KEYS.chatHistory);
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as ChatHistoryItem[]).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

async function writeHistory(items: ChatHistoryItem[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.chatHistory, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
}

export async function getCachedMessages(sessionId?: string | null): Promise<ChatMessage[]> {
  const raw = sessionId
    ? await AsyncStorage.getItem(`${KEYS.sessionMessages}${sessionId}`)
    : await AsyncStorage.getItem(KEYS.legacyCachedMessages);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export async function setCachedMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
  const trimmed = messages.slice(-MAX_CACHED_MESSAGES);
  await AsyncStorage.setItem(`${KEYS.sessionMessages}${sessionId}`, JSON.stringify(trimmed));
  if (trimmed.length === 0) return;
  const current = await getChatHistory();
  const next = [summarize(sessionId, trimmed), ...current.filter((item) => item.id !== sessionId)];
  await writeHistory(next);
}

export async function deleteCachedChat(sessionId: string): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(`${KEYS.sessionMessages}${sessionId}`),
    getChatHistory().then((items) => writeHistory(items.filter((item) => item.id !== sessionId))),
  ]);
}

export async function clearCachedMessages(sessionId?: string): Promise<void> {
  if (sessionId) await deleteCachedChat(sessionId);
  else await AsyncStorage.removeItem(KEYS.legacyCachedMessages);
}
