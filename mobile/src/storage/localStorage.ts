import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ModelRef } from '../opencode/types';
import type { ChatMessage } from '../opencode/mapToChatMessage';

const KEYS = {
  sessionId: 'opencode_current_session_id',
  selectedModel: 'opencode_selected_model',
  cachedMessages: 'opencode_cached_messages',
} as const;

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

export async function getCachedMessages(): Promise<ChatMessage[]> {
  const raw = await AsyncStorage.getItem(KEYS.cachedMessages);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export async function setCachedMessages(messages: ChatMessage[]): Promise<void> {
  const trimmed = messages.slice(-MAX_CACHED_MESSAGES);
  await AsyncStorage.setItem(KEYS.cachedMessages, JSON.stringify(trimmed));
}

export async function clearCachedMessages(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.cachedMessages);
}
