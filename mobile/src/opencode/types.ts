// Types for OpenCode's v1 server API, checked against the live `/doc` OpenAPI
// spec (opencode 1.18.25). Fields we don't actually consume are left out or
// marked optional even where the server marks them required, to keep this
// file honest about what the app depends on.

export type ToolStatus = 'pending' | 'running' | 'completed' | 'error';

export interface ToolState {
  status: ToolStatus;
  input?: unknown;
  title?: string;
  /** present when status is 'completed' */
  output?: string;
  /** present when status is 'error' */
  error?: string;
}

interface BasePart {
  /** Stable id (`prt_...`), used to patch the right part on `message.part.updated`. */
  id: string;
  sessionID: string;
  messageID: string;
}

export interface TextPart extends BasePart {
  type: 'text';
  text: string;
}

export interface ReasoningPart extends BasePart {
  type: 'reasoning';
  text: string;
}

export interface FilePart extends BasePart {
  type: 'file';
  filename?: string;
  mime?: string;
  url?: string;
}

export interface ToolPart extends BasePart {
  type: 'tool';
  callID: string;
  tool: string;
  state: ToolState;
}

export interface StepStartPart extends BasePart {
  type: 'step-start';
}

export interface StepFinishPart extends BasePart {
  type: 'step-finish';
  reason?: string;
}

/** The server has a few more part types (subtask, snapshot, patch, agent,
 * retry, compaction) that we deliberately don't render -- MessagePartsList
 * treats any part whose `type` isn't one of these as inert and skips it. */
export type MessagePart = TextPart | ReasoningPart | FilePart | ToolPart | StepStartPart | StepFinishPart;

/** Flattened client-side shape: the wire format splits `info` (Message) and
 * `parts` (Part[]) into separate values; the client layer merges them back
 * into this shape so the rest of the app only deals with one object. */
export interface OpenCodeMessage {
  id: string;
  sessionID: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  createdAt?: number;
}

/** Raw wire format for one message, as returned by the message endpoints. */
export interface RawMessageEnvelope {
  info: { id: string; sessionID: string; role: 'user' | 'assistant'; time?: { created?: number } };
  parts: MessagePart[];
}

export interface OpenCodeSession {
  id: string;
  title?: string;
}

export interface ModelRef {
  providerID: string;
  modelID: string;
}

export interface ModelInfo {
  id: string;
  name?: string;
}

export interface Provider {
  id: string;
  name?: string;
  models: ModelInfo[];
}

/** Raw wire format: `models` is a map keyed by model id, not an array. */
export interface RawProvider {
  id: string;
  name?: string;
  models: Record<string, { id: string; name?: string }>;
}

export interface SSEEvent {
  type: string;
  properties?: {
    sessionID?: string;
    info?: RawMessageEnvelope['info'];
    part?: MessagePart;
    messageID?: string;
    partID?: string;
    field?: string;
    delta?: string;
    [key: string]: unknown;
  };
}
