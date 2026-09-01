import type {
  ModelRef,
  OpenCodeMessage,
  OpenCodeSession,
  Provider,
  RawMessageEnvelope,
  RawProvider,
} from './types';

export type OpenCodeErrorKind = 'network' | 'unauthorized' | 'not-found' | 'server' | 'unknown';

export class OpenCodeError extends Error {
  kind: OpenCodeErrorKind;
  status?: number;

  constructor(message: string, kind: OpenCodeErrorKind, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

export interface OpenCodeClientConfig {
  baseUrl: string;
  username?: string;
  password?: string;
}

function buildHeaders(config: OpenCodeClientConfig, extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...extra };
  if (config.password) {
    headers.Authorization = `Basic ${btoa(`${config.username || 'opencode'}:${config.password}`)}`;
  }
  return headers;
}

async function request<T>(config: OpenCodeClientConfig, path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: buildHeaders(config, init?.headers as Record<string, string> | undefined),
    });
  } catch {
    throw new OpenCodeError('Could not reach the OpenCode server', 'network');
  }

  if (response.status === 401) throw new OpenCodeError('Invalid credentials', 'unauthorized', 401);
  if (response.status === 404) throw new OpenCodeError('Not found', 'not-found', 404);
  if (!response.ok) throw new OpenCodeError(`Server error (${response.status})`, 'server', response.status);
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function flattenMessage(raw: RawMessageEnvelope): OpenCodeMessage {
  return {
    id: raw.info.id,
    sessionID: raw.info.sessionID,
    role: raw.info.role,
    parts: raw.parts,
  };
}

// Temporary restriction while wiring things up -- both OpenCode's own "Zen"
// models and OpenRouter's free tier consistently mark themselves with a
// "free" id/name suffix, so this is enough to hide paid models for now.
// Remove this filter once ready to support paid models too.
const isFreeModel = (m: { id: string; name?: string }) => /free/i.test(m.id) || /free/i.test(m.name ?? '');

function flattenProviders(raw: RawProvider[]): Provider[] {
  return raw
    .map((p) => ({
      id: p.id,
      name: p.name,
      models: Object.values(p.models ?? {})
        .map((m) => ({ id: m.id, name: m.name }))
        .filter(isFreeModel),
    }))
    .filter((p) => p.models.length > 0);
}

// The server has a documented race condition on concurrent session deletes,
// so every mutating session call is chained through this single queue.
let mutationQueue: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = mutationQueue.then(fn, fn);
  mutationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function createOpenCodeClient(config: OpenCodeClientConfig) {
  return {
    config,

    checkHealth: () => request<{ healthy?: boolean; version?: string }>(config, '/global/health'),

    listModels: async () => {
      const res = await request<{ providers: RawProvider[] }>(config, '/config/providers');
      return { providers: flattenProviders(res.providers) };
    },

    createSession: () =>
      serialized(() =>
        request<OpenCodeSession>(config, '/session', { method: 'POST', body: JSON.stringify({}) }),
      ),

    getSession: (sessionId: string) => request<OpenCodeSession>(config, `/session/${sessionId}`),

    deleteSession: (sessionId: string) =>
      serialized(() => request<void>(config, `/session/${sessionId}`, { method: 'DELETE' })),

    getMessages: async (sessionId: string) => {
      const raw = await request<RawMessageEnvelope[]>(config, `/session/${sessionId}/message`);
      return raw.map(flattenMessage);
    },

    // Fire-and-forget: the server admits the prompt and returns immediately
    // (204), then runs the agent loop in the background. All actual content
    // (including the user message itself being persisted) arrives via
    // `/event` plus the polling fallback -- this call is never held open for
    // the duration of a generation, which matters on a flaky phone network.
    sendPrompt: (sessionId: string, text: string, model?: ModelRef) =>
      request<void>(config, `/session/${sessionId}/prompt_async`, {
        method: 'POST',
        body: JSON.stringify({
          parts: [{ type: 'text', text }],
          ...(model ? { model } : {}),
        }),
      }),

    interrupt: (sessionId: string) =>
      request<boolean>(config, `/session/${sessionId}/abort`, { method: 'POST' }),
  };
}

export type OpenCodeClient = ReturnType<typeof createOpenCodeClient>;
