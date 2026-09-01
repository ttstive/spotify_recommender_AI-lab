import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { RecommenderClientConfig } from '../api/client';

const STORAGE_KEY = 'recommender_base_url';

/** Both servers usually run on the same machine, so default to the OpenCode
 * host with the FastAPI app's port (8000) instead of asking the user to type
 * a second LAN address from scratch. Settings can still override this. */
export function deriveDefaultRecommenderUrl(openCodeBaseUrl?: string): string | null {
  if (!openCodeBaseUrl) return null;
  try {
    const url = new URL(openCodeBaseUrl);
    return `${url.protocol}//${url.hostname}:8000`;
  } catch {
    return null;
  }
}

interface RecommenderConfigContextValue {
  config: RecommenderClientConfig | null;
  isLoaded: boolean;
  save: (baseUrl: string) => Promise<void>;
  clear: () => Promise<void>;
}

const RecommenderConfigContext = createContext<RecommenderConfigContextValue | null>(null);

export function useRecommenderConfigState(openCodeBaseUrl?: string): RecommenderConfigContextValue {
  const [override, setOverride] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      setOverride(await AsyncStorage.getItem(STORAGE_KEY));
      setIsLoaded(true);
    })();
  }, []);

  const save = useCallback(async (baseUrl: string) => {
    await AsyncStorage.setItem(STORAGE_KEY, baseUrl);
    setOverride(baseUrl);
  }, []);

  const clear = useCallback(async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    setOverride(null);
  }, []);

  const baseUrl = override ?? deriveDefaultRecommenderUrl(openCodeBaseUrl);
  const config = useMemo<RecommenderClientConfig | null>(() => (baseUrl ? { baseUrl } : null), [baseUrl]);

  return useMemo(() => ({ config, isLoaded, save, clear }), [config, isLoaded, save, clear]);
}

export { RecommenderConfigContext };

export function useRecommenderConfig(): RecommenderConfigContextValue {
  const ctx = useContext(RecommenderConfigContext);
  if (!ctx) throw new Error('useRecommenderConfig must be used within RecommenderConfigContext.Provider');
  return ctx;
}
