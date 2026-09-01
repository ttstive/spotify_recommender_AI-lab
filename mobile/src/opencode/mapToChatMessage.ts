import type { IMessage } from '@kesha-antonov/react-native-chat';

import type { MessagePart, OpenCodeMessage } from './types';

export const CURRENT_USER = { _id: 'me' };
export const ASSISTANT_USER = { _id: 'assistant', name: 'OpenCode' };

/**
 * The chat library's Bubble only invokes `renderMessageText` (and therefore
 * our MessagePartsList) when `currentMessage.text` is a non-empty string --
 * an empty string makes it render nothing at all. Every ChatMessage we
 * construct uses this as `.text` so that check always passes; the actual
 * content still comes entirely from `.parts`, this value is never shown.
 */
export const RENDER_SENTINEL = ' ';

export interface ChatMessage extends IMessage {
  parts: MessagePart[];
}

/**
 * Maps one OpenCode message to one chat bubble. Rendering happens from the
 * ordered `parts` array (see MessagePartsList) so text, reasoning, tool
 * calls, and files can be displayed distinctly instead of being flattened
 * into one string.
 */
export function mapToChatMessage(message: OpenCodeMessage): ChatMessage {
  return {
    _id: message.id,
    text: RENDER_SENTINEL,
    createdAt: new Date(),
    user: message.role === 'user' ? CURRENT_USER : ASSISTANT_USER,
    parts: message.parts,
  };
}
