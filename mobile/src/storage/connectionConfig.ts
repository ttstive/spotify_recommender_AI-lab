import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
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

const isNativePlatform = Platform.OS === 'ios' || Platform.OS === 'android';

async function readStoredValue(key: string): Promise<string | null> {
  if (isNativePlatform && typeof (SecureStore as any)?.getItemAsync === 'function') {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      // ignore and fall back to AsyncStorage below
    }
  }

  return AsyncStorage.getItem(key);
}

async function writeStoredValue(key: string, value: string): Promise<void> {
  if (isNativePlatform && typeof (SecureStore as any)?.setItemAsync === 'function') {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch {
      // fall through to AsyncStorage
    }
  }

  await AsyncStorage.setItem(key, value);
}

async function removeStoredValue(key: string): Promise<void> {
  if (isNativePlatform && typeof (SecureStore as any)?.deleteItemAsync === 'function') {
    try {
      await SecureStore.deleteItemAsync(key);
      return;
    } catch {
      // fall through to AsyncStorage
    }
  }

  await AsyncStorage.removeItem(key);
}

export function useConnectionConfigState(): ConnectionConfigContextValue {
  const [config, setConfig] = useState<OpenCodeClientConfig | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const [serverUrl, username, password] = await Promise.all([
        readStoredValue(KEYS.serverUrl),
        readStoredValue(KEYS.username),
        readStoredValue(KEYS.password),
      ]);
      if (serverUrl) {
        setConfig({ baseUrl: serverUrl, username: username ?? undefined, password: password ?? undefined });
      }
      setIsLoaded(true);
    })();
  }, []);

  const save = useCallback(async (next: ConnectionConfig) => {
    await Promise.all([
      writeStoredValue(KEYS.serverUrl, next.serverUrl),
      next.username ? writeStoredValue(KEYS.username, next.username) : removeStoredValue(KEYS.username),
      next.password ? writeStoredValue(KEYS.password, next.password) : removeStoredValue(KEYS.password),
    ]);
    setConfig({ baseUrl: next.serverUrl, username: next.username, password: next.password });
  }, []);

  const clear = useCallback(async () => {
    await Promise.all([
      removeStoredValue(KEYS.serverUrl),
      removeStoredValue(KEYS.username),
      removeStoredValue(KEYS.password),
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
