import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useConnectionConfig } from '../storage/connectionConfig';
import { createRecommenderClient } from '../api/client';
import { useRecommenderConfig } from '../storage/recommenderConfig';
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
const DEFAULT_MODEL: ModelRef = { providerID: 'opencode', modelID: 'mimo-v2.5-free' };

type RecommendationIntent = { type: 'artist' | 'similar_artist' | 'song' | 'mood'; seed: string; size: number };

const MOOD_TERMS: Record<string, string> = {
  triste: 'sad', tristes: 'sad', melancolica: 'sad', melancolicas: 'sad',
  feliz: 'happy', felizes: 'happy', alegre: 'happy', alegres: 'happy',
  calma: 'calm', calmas: 'calm', calmo: 'calm', relaxante: 'calm',
  energetica: 'energetic', energeticas: 'energetic', animada: 'energetic', treino: 'energetic',
  romantica: 'romantic', romanticas: 'romantic', romance: 'romantic',
  raiva: 'angry', agressiva: 'angry', foco: 'focused', estudar: 'focused', concentrar: 'focused',
};

function recommendationIntent(text: string): RecommendationIntent | null {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!/(recomend|playlist|musica|faixa|parecid|ouvir)/.test(normalized)) return null;
  const requestedSize = Number(normalized.match(/\b(\d{1,2})\s+(?:musica|musicas|faixa|faixas)/)?.[1]);
  const size = Number.isFinite(requestedSize) && requestedSize > 0 ? Math.min(requestedSize, 20) : 10;

  for (const [term, mood] of Object.entries(MOOD_TERMS)) {
    if (new RegExp(`\\b${term}\\b`).test(normalized)) return { type: 'mood', seed: mood, size };
  }

  const explicitArtist = text.match(/(?:artista|cantor(?:a)?|banda)\s+([^?!,.]+)/i);
  if (explicitArtist?.[1]) {
    return { type: normalized.includes('parecid') ? 'similar_artist' : 'artist', seed: explicitArtist[1].trim(), size };
  }

  const byArtist = text.match(/(?:\bdo\b|\bda\b|\bde\b|\bby\b)\s+([^?!,.]+)/i);
  if (byArtist?.[1]) {
    return { type: normalized.includes('parecid') ? 'similar_artist' : 'artist', seed: byArtist[1].trim(), size };
  }

  const similarTo = text.match(/(?:parecid\w*\s+(?:com|a)|como)\s+([^?!,.]+)/i);
  if (similarTo?.[1]) return { type: 'song', seed: similarTo[1].trim(), size };
  return { type: 'mood', seed: 'happy', size };
}

function dedupeParts(parts: MessagePart[]): MessagePart[] {
  const seen = new Set<string>();
  return parts.filter((part) => {
    const content = part.type === 'text' || part.type === 'reasoning' ? part.text : '';
    const key = `${part.type}:${content || part.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function coalesceForDisplay(messages: ChatMessage[]): ChatMessage[] {
  const merged: ChatMessage[] = [];
  for (const message of messages) {
    const previous = merged[merged.length - 1];
    if (previous?.user._id === ASSISTANT_USER._id && message.user._id === ASSISTANT_USER._id) {
      merged[merged.length - 1] = { ...previous, parts: dedupeParts([...previous.parts, ...message.parts]) };
    } else {
      merged.push({ ...message, parts: dedupeParts(message.parts) });
    }
  }
  return merged;
}

function hasVisibleContent(message: ChatMessage): boolean {
  return message.parts.some((part) => {
    if (part.type === 'text') return Boolean(part.text.trim());
    return part.type === 'tool'
      && part.state.status === 'completed'
      && part.tool.endsWith('recommender_create_playlist')
      && Boolean(part.state.output);
  });
}

function messagesForDisplay(messages: ChatMessage[]): ChatMessage[] {
  const ordered = [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const coalesced = coalesceForDisplay(ordered);
  return coalesced.filter((message, index) => (
    hasVisibleContent(message)
    || (index === coalesced.length - 1 && message.user._id === ASSISTANT_USER._id && isGeneratingMessage(message))
  ));
}

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
  const { config: recommenderConfig } = useRecommenderConfig();

  const client = useMemo(() => (config ? createOpenCodeClient(config) : null), [config]);
  const recommender = useMemo(
    () => (recommenderConfig ? createRecommenderClient(recommenderConfig) : null),
    [recommenderConfig],
  );

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFailedText, setLastFailedText] = useState<string | null>(null);
  const [selectedModel, setSelectedModelState] = useState<ModelRef>(DEFAULT_MODEL);

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
          next[pendingIndex] = { ...next[pendingIndex], _id: info.id, parts: [] };
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
      return [...prev, shell];
    });
  }, []);

  const handleEvent = useCallback(
    (event: SSEEvent) => {
      if (event.type === 'message.updated') {
        const info = event.properties?.info;
        if (info && info.sessionID === sessionId) ensureMessageShell(info);
        return;
      }

      if (event.type === 'message.part.delta') {
        const sessionID = event.properties?.sessionID;
        const messageID = event.properties?.messageID;
        const partID = event.properties?.partID;
        const field = event.properties?.field;
        const delta = event.properties?.delta;

        if (!sessionID || !messageID || !partID || !field || !delta || sessionID !== sessionId) return;

        setMessages((prev) => {
          const index = prev.findIndex((m) => m._id === messageID);
          if (index === -1) {
            const pendingIndex = prev.findIndex((m) => m._id === pendingOptimisticIdRef.current);
            if (pendingIndex !== -1 && pendingOptimisticIdRef.current !== messageID) {
              const next = prev.slice();
              next[pendingIndex] = {
                ...next[pendingIndex],
                _id: messageID,
                parts: [
                  field === 'text'
                    ? { id: partID, sessionID, messageID, type: 'text', text: delta }
                    : field === 'reasoning'
                      ? { id: partID, sessionID, messageID, type: 'reasoning', text: delta }
                      : { id: partID, sessionID, messageID, type: 'text', text: delta },
                ],
              };
              pendingOptimisticIdRef.current = null;
              return next;
            }
            return prev;
          }

          const next = prev.slice();
          const current = next[index];
          const existing = current.parts.find((part) => part.id === partID);

          if (!existing) {
            const synthetic: MessagePart =
              field === 'text'
                ? { id: partID, sessionID, messageID, type: 'text', text: delta }
                : field === 'reasoning'
                  ? { id: partID, sessionID, messageID, type: 'reasoning', text: delta }
                  : { id: partID, sessionID, messageID, type: 'text', text: delta };
            next[index] = { ...current, parts: [...current.parts, synthetic] };
            return next;
          }

          next[index] = {
            ...current,
            parts: current.parts.map((part) => {
              if (part.id !== partID || (part.type !== 'text' && part.type !== 'reasoning')) return part;
              return { ...part, text: `${part.text ?? ''}${delta}` };
            }),
          };
          return next;
        });
        return;
      }

      if (event.type === 'message.part.updated') {
        const part = event.properties?.part;
        if (!part || part.sessionID !== sessionId) return;

        setMessages((prev) => {
          const existingIndex = prev.findIndex((m) => m._id === part.messageID);
          if (existingIndex !== -1) {
            const next = prev.slice();
            next[existingIndex] = { ...next[existingIndex], parts: upsertPart(next[existingIndex].parts, part) };
            return next;
          }

          // Ignore direct part updates before the message metadata arrives. This
          // avoids creating a second user shell when the optimistic bubble already
          // exists and the server is still publishing the confirmed message id.
          if (pendingOptimisticIdRef.current && part.messageID !== pendingOptimisticIdRef.current) {
            return prev;
          }

          const shell: ChatMessage = {
            _id: part.messageID,
            text: RENDER_SENTINEL,
            createdAt: new Date(),
            user: part.messageID === pendingOptimisticIdRef.current ? CURRENT_USER : ASSISTANT_USER,
            parts: [part],
          };
          return [...prev, shell];
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
      if (!cancelled && storedModel?.modelID === DEFAULT_MODEL.modelID) setSelectedModelState(storedModel);
      else setStoredModel(DEFAULT_MODEL);

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
          const serverMessages = raw.map(mapToChatMessage);
          const localMessages = base.filter((message) => String(message._id).startsWith('local-'));
          return [...serverMessages, ...localMessages];
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
      setMessages((prev) => [...prev, optimistic]);

      const intent = recommendationIntent(text);
      if (intent && recommender) {
        pendingOptimisticIdRef.current = null;
        const assistantId = `local-recommendation-${Date.now()}`;
        const startPart: MessagePart = { id: `${assistantId}-start`, sessionID: sessionId, messageID: assistantId, type: 'step-start' };
        setMessages((prev) => [...prev, {
          _id: assistantId,
          text: RENDER_SENTINEL,
          createdAt: new Date(),
          user: ASSISTANT_USER,
          parts: [startPart],
        }]);
        try {
          const tracks = intent.type === 'artist'
            ? await recommender.getTracksByArtist(intent.seed, intent.size)
            : intent.type === 'similar_artist'
              ? await recommender.getRecommendationsByArtist(intent.seed, intent.size)
            : intent.type === 'mood'
              ? await recommender.getRecommendationsByMood(intent.seed, intent.size)
              : await recommender.getRecommendationsBySong(intent.seed, intent.size);
          const output = JSON.stringify({
            title: intent.type === 'mood' ? 'Uma selecao para o seu momento' : `Inspirada em ${intent.seed}`,
            seed_type: intent.type,
            seed: intent.seed,
            tracks,
          });
          setMessages((prev) => prev.map((message) => message._id === assistantId ? {
            ...message,
            parts: [
              { id: `${assistantId}-tool`, sessionID: sessionId, messageID: assistantId, type: 'tool', callID: assistantId, tool: 'recommender_create_playlist', state: { status: 'completed', output } },
              { id: `${assistantId}-finish`, sessionID: sessionId, messageID: assistantId, type: 'step-finish', reason: 'stop' },
            ],
          } : message));
        } catch {
          setMessages((prev) => prev.map((message) => message._id === assistantId ? {
            ...message,
            parts: [
              { id: `${assistantId}-error`, sessionID: sessionId, messageID: assistantId, type: 'text', text: 'Nao encontrei essa selecao. Tente informar outro artista, musica ou clima.' },
              { id: `${assistantId}-finish`, sessionID: sessionId, messageID: assistantId, type: 'step-finish', reason: 'stop' },
            ],
          } : message));
        } finally {
          setIsSending(false);
        }
        return;
      }

      try {
        await client.sendPrompt(sessionId, text, selectedModel ?? undefined);
      } catch (err) {
        setLastFailedText(text);
        setError(err instanceof OpenCodeError ? err.message : 'Failed to send message.');
      } finally {
        setIsSending(false);
      }
    },
    [client, recommender, sessionId, selectedModel],
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
      setMessages((prev) => [
        ...raw.map(mapToChatMessage),
        ...prev.filter((message) => String(message._id).startsWith('local-')),
      ]);
    } catch {
      // reconnect() above already retries the live channel; nothing more to do here
    }
  }, [client, sessionId, reconnect]);

  return {
    client,
    isReady,
    messages: messagesForDisplay(messages),
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
