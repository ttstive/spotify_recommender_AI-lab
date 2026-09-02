import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { OpenCodeClientConfig } from '../opencode/client';

const KEYS = {
  serverUrl: 'opencode_server_url',
  username: 'opencode_username',
  password: 'opencode_password',
} as const;

export interface ConnectionConfig {
  serverUrl: string;
  username?: string;
  password?: string;
}

interface ConnectionConfigContextValue {
  config: OpenCodeClientConfig | null;
  isLoaded: boolean;
  save: (next: ConnectionConfig) => Promise<void>;
  clear: () => Promise<void>;
}

const ConnectionConfigContext = createContext<ConnectionConfigContextValue | null>(null);

export function useConnectionConfigState(): ConnectionConfigContextValue {
  const [config, setConfig] = useState<OpenCodeClientConfig | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [serverUrl, username, password] = await Promise.all([
        SecureStore.getItemAsync(KEYS.serverUrl),
        SecureStore.getItemAsync(KEYS.username),
        SecureStore.getItemAsync(KEYS.password),
      ]);
      if (serverUrl) {
        setConfig({ baseUrl: serverUrl, username: username ?? undefined, password: password ?? undefined });
      }
      setIsLoaded(true);
    })();
  }, []);

  const save = useCallback(async (next: ConnectionConfig) => {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.serverUrl, next.serverUrl),
      next.username
        ? SecureStore.setItemAsync(KEYS.username, next.username)
        : SecureStore.deleteItemAsync(KEYS.username),
      next.password
        ? SecureStore.setItemAsync(KEYS.password, next.password)
        : SecureStore.deleteItemAsync(KEYS.password),
    ]);
    setConfig({ baseUrl: next.serverUrl, username: next.username, password: next.password });
  }, []);

  const clear = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.serverUrl),
      SecureStore.deleteItemAsync(KEYS.username),
      SecureStore.deleteItemAsync(KEYS.password),
    ]);
    setConfig(null);
  }, []);

  return useMemo(() => ({ config, isLoaded, save, clear }), [config, isLoaded, save, clear]);
}

export { ConnectionConfigContext };

export function useConnectionConfig(): ConnectionConfigContextValue {
  const ctx = useContext(ConnectionConfigContext);
  if (!ctx) throw new Error('useConnectionConfig must be used within ConnectionConfigContext.Provider');
  return ctx;
}
