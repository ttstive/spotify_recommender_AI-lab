import { Chat } from '@kesha-antonov/react-native-chat';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useConnectionConfig } from '../storage/connectionConfig';
import {
  clearCachedMessages,
  getCachedMessages,
  getStoredModel,
  getStoredSessionId,
  setCachedMessages,
  setStoredModel,
  setStoredSessionId,
} from '../storage/localStorage';
import { createOpenCodeClient, OpenCodeError } from './client';
import {
  ASSISTANT_USER,
  CURRENT_USER,
  mapToChatMessage,
  RENDER_SENTINEL,
  type ChatMessage,
} from './mapToChatMessage';
import type { ModelRef, MessagePart, SSEEvent } from './types';
import { useEventStream } from './useEventStream';

const POLL_INTERVAL_MS = 5000;

function isGeneratingMessage(message: ChatMessage): boolean {
  const starts = message.parts.filter((p) => p.type === 'step-start').length;
  const finishes = message.parts.filter((p) => p.type === 'step-finish').length;
  return starts > finishes;
}

function upsertPart(parts: MessagePart[], incoming: MessagePart): MessagePart[] {
  const index = parts.findIndex((p) => p.id === incoming.id);
  if (index === -1) return [...parts, incoming];
  const next = parts.slice();
  next[index] = incoming;
  return next;
}

export function useChatSession() {
  const { config } = useConnectionConfig();

  const client = useMemo(() => (config ? createOpenCodeClient(config) : null), [config]);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const [selectedModel, setSelectedModelState] = useState<ModelRef | null>(null);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Sending is fire-and-forget (see client.sendPrompt), so the user's own
  // message comes back to us only via SSE/polling. This tracks the local
  // optimistic bubble so the first real `user` message we see afterwards
  // replaces it instead of appearing as a duplicate.
  const pendingOptimisticIdRef = useRef<string | null>(null);

  // `message.updated` carries metadata only (id/sessionID/role) -- the
  // server keeps message content and parts as separate resources, so a
  // message's text/tool-call content only ever arrives via
  // `message.part.updated` (handled below) or a `getMessages` fetch. This
  // handler's job is just to make sure a shell exists for a brand-new
  // message id, reconciling it with our optimistic bubble when it's the
  // user's own message coming back.
  const ensureMessageShell = useCallback((info: { id: string; sessionID: string; role: 'user' | 'assistant' }) => {
    setMessages((prev) => {
      if (prev.some((m) => m._id === info.id)) return prev;
      if (info.role === 'user' && pendingOptimisticIdRef.current) {
        const pendingIndex = prev.findIndex((m) => m._id === pendingOptimisticIdRef.current);
        if (pendingIndex !== -1) {
          pendingOptimisticIdRef.current = null;
          const next = prev.slice();
          next[pendingIndex] = { ...next[pendingIndex], _id: info.id };
          return next;
        }
      }
      const shell: ChatMessage = {
        _id: info.id,
        text: RENDER_SENTINEL,
        createdAt: new Date(),
        user: info.role === 'user' ? CURRENT_USER : ASSISTANT_USER,
        parts: [],
      };
      return Chat.append(prev, [shell]);
    });
  }, []);

  const handleEvent = useCallback(
    (event: SSEEvent) => {
      if (event.type === 'message.updated') {
        const info = event.properties?.info;
        if (info && info.sessionID === sessionId) ensureMessageShell(info);
        return;
      }
      if (event.type === 'message.part.updated') {
        const part = event.properties?.part;
        if (!part || part.sessionID !== sessionId) return;
        setMessages((prev) => {
          const index = prev.findIndex((m) => m._id === part.messageID);
          if (index === -1) {
            const shell: ChatMessage = {
              _id: part.messageID,
              text: RENDER_SENTINEL,
              createdAt: new Date(),
              user: ASSISTANT_USER,
              parts: [part],
            };
            return Chat.append(prev, [shell]);
          }
          const next = prev.slice();
          next[index] = { ...next[index], parts: upsertPart(next[index].parts, part) };
          return next;
        });
      }
    },
    [sessionId],
  );

  const eventStreamConfig = useMemo(
    () => (config ? { baseUrl: config.baseUrl, username: config.username, password: config.password } : null),
    [config?.baseUrl, config?.username, config?.password],
  );
  const { connectionState, reconnect } = useEventStream(eventStreamConfig, handleEvent);

  // Resolve (or create) the persisted session once a client is available.
  useEffect(() => {
    if (!client) {
      setIsReady(false);
      return;
    }
    let cancelled = false;

    (async () => {
      const [cached, storedModel] = await Promise.all([getCachedMessages(), getStoredModel()]);
      if (!cancelled && cached.length) setMessages(cached);
      if (!cancelled && storedModel) setSelectedModelState(storedModel);

      let id = await getStoredSessionId();
      if (id) {
        try {
          await client.getSession(id);
        } catch (err) {
          id = null;
        }
      }
      if (!id) {
        const created = await client.createSession();
        id = created.id;
        await setStoredSessionId(id);
      }
      if (cancelled) return;
      setSessionId(id);

      try {
        const raw = await client.getMessages(id);
        if (!cancelled) setMessages(raw.map(mapToChatMessage));
      } catch {
        // keep whatever cached/local messages we have; SSE/poll will catch up
      }
      if (!cancelled) setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [client]);

  // Debounced cache write.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setCachedMessages(messagesRef.current);
    }, 800);
    return () => clearTimeout(timeout);
  }, [messages]);

  // Polling fallback alongside SSE.
  useEffect(() => {
    if (!client || !sessionId) return;
    const interval = setInterval(async () => {
      try {
        const raw = await client.getMessages(sessionId);
        setMessages((prev) => {
          let base = prev;
          // If the poll beat the `message.updated` SSE event to confirming
          // our own optimistic send, drop the local placeholder here too --
          // otherwise it and the now-arrived real message both stay in the
          // list, keyed under two different ids, and render as a duplicate.
          if (pendingOptimisticIdRef.current) {
            const stillPending = base.some((m) => m._id === pendingOptimisticIdRef.current);
            const confirmed = raw.find((r) => r.role === 'user' && !base.some((m) => m._id === r.id));
            if (stillPending && confirmed) {
              base = base.filter((m) => m._id !== pendingOptimisticIdRef.current);
              pendingOptimisticIdRef.current = null;
            }
          }
          const byId = new Map(base.map((m) => [m._id, m]));
          for (const r of raw) {
            const existing = byId.get(r.id);
            if (!existing || r.parts.length >= existing.parts.length) {
              byId.set(r.id, mapToChatMessage(r));
            }
          }
          return Array.from(byId.values());
        });
      } catch {
        // transient; next tick or SSE will catch up
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [client, sessionId]);

  const isGenerating = useMemo(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.user._id === ASSISTANT_USER._id);
    return lastAssistant ? isGeneratingMessage(lastAssistant) : false;
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!client || !sessionId || !text.trim()) return;
      setError(null);
      setLastFailedText(null);
      setIsSending(true);

      const optimisticId = `local-${Date.now()}`;
      const optimistic: ChatMessage = {
        _id: optimisticId,
        text: RENDER_SENTINEL,
        createdAt: new Date(),
        user: CURRENT_USER,
        parts: [{ id: optimisticId, sessionID: sessionId, messageID: optimisticId, type: 'text', text }],
      };
      pendingOptimisticIdRef.current = optimisticId;
      setMessages((prev) => Chat.append(prev, [optimistic]));

      try {
        await client.sendPrompt(sessionId, text, selectedModel ?? undefined);
      } catch (err) {
        setLastFailedText(text);
        setError(err instanceof OpenCodeError ? err.message : 'Failed to send message.');
      } finally {
        setIsSending(false);
      }
    },
    [client, sessionId, selectedModel],
  );

  const retryLastMessage = useCallback(() => {
    if (lastFailedText) sendMessage(lastFailedText);
  }, [lastFailedText, sendMessage]);

  const interrupt = useCallback(async () => {
    if (!client || !sessionId) return;
    try {
      await client.interrupt(sessionId);
    } catch {
      // best-effort; fall through to the local UI patch below regardless
    }
    setMessages((prev) => {
      const index = [...prev].reverse().findIndex((m) => m.user._id === ASSISTANT_USER._id);
      if (index === -1) return prev;
      const realIndex = prev.length - 1 - index;
      const target = prev[realIndex];
      if (!isGeneratingMessage(target)) return prev;
      const next = prev.slice();
      const localId = `local-interrupt-${Date.now()}`;
      next[realIndex] = {
        ...target,
        parts: [
          ...target.parts,
          { id: localId, sessionID: sessionId, messageID: String(target._id), type: 'step-finish', reason: 'stop' },
        ],
      };
      return next;
    });
  }, [client, sessionId]);

  const startNewChat = useCallback(async () => {
    if (!client) return;
    const created = await client.createSession();
    await setStoredSessionId(created.id);
    await clearCachedMessages();
    pendingOptimisticIdRef.current = null;
    setSessionId(created.id);
    setMessages([]);
    setError(null);
    setLastFailedText(null);
  }, [client]);

  const setSelectedModel = useCallback((model: ModelRef) => {
    setSelectedModelState(model);
    setStoredModel(model);
  }, []);

  const refresh = useCallback(async () => {
    reconnect();
    if (!client || !sessionId) return;
    try {
      const raw = await client.getMessages(sessionId);
      setMessages(raw.map(mapToChatMessage));
    } catch {
      // reconnect() above already retries the live channel; nothing more to do here
    }
  }, [client, sessionId, reconnect]);

  return {
    client,
    isReady,
    messages,
    connectionState,
    isSending,
    isGenerating,
    error,
    canRetry: Boolean(lastFailedText),
    retryLastMessage,
    sendMessage,
    interrupt,
    startNewChat,
    selectedModel,
    setSelectedModel,
    refresh,
  };
}
