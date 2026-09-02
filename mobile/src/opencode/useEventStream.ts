import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import EventSource from 'react-native-sse';

import type { OpenCodeClientConfig } from './client';
import type { SSEEvent } from './types';

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';

/**
 * Subscribes to OpenCode's global `/event` SSE stream. Reconnection is
 * handled by react-native-sse itself (`pollingInterval`); this hook also
 * exposes a manual `reconnect` for a "retry now" affordance and re-opens the
 * stream when the app returns to the foreground, since a backgrounded socket
 * can go stale for longer than the library's own retry window expects.
 */
export function useEventStream(config: OpenCodeClientConfig | null, onEvent: (event: SSEEvent) => void) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const openRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!config) {
      setConnectionState('offline');
      return;
    }

    let closed = false;
    let es: EventSource | null = null;

    const headers: Record<string, string> = {};
    if (config.password) {
      headers.Authorization = `Basic ${btoa(`${config.username || 'opencode'}:${config.password}`)}`;
    }

    function open() {
      es?.close();
      setConnectionState((prev) => (prev === 'live' ? prev : 'connecting'));
      es = new EventSource(`${config!.baseUrl.replace(/\/$/, '')}/event`, {
        headers,
        pollingInterval: 4000,
      });

      es.addEventListener('open', () => {
        if (!closed) setConnectionState('live');
      });

      es.addEventListener('message', (event) => {
        if (closed || !event.data) return;
        try {
          onEventRef.current(JSON.parse(event.data) as SSEEvent);
        } catch {
          // ignore malformed frames
        }
      });

      es.addEventListener('error', () => {
        if (!closed) setConnectionState('reconnecting');
      });
    }

    openRef.current = open;
    open();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !closed) open();
    });

    return () => {
      closed = true;
      es?.close();
      subscription.remove();
    };
  }, [config]);

  const reconnect = useCallback(() => openRef.current(), []);

  return { connectionState, reconnect };
}
