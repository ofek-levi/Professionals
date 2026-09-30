/** Chat rules of the composer UI (the backend applies the same limits). */
import { APP_CONFIG } from '@/constants/app-config';
import type { Conversation } from '@/types/domain';

/** Messaging is closed once the job was cancelled (`conversation.isOpen === false`). */
export function canSendMessage(conversation: Pick<Conversation, 'isOpen'>): boolean {
  return conversation.isOpen;
}

/**
 * Normalizes user input before sending: unifies line endings, trims trailing whitespace on each
 * line, collapses 3+ consecutive blank lines and trims the whole text.
 */
export function normalizeMessageText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** A message can be sent when its normalized text is non-empty and within the length limit. */
export function isSendableMessageText(text: string): boolean {
  const normalized = normalizeMessageText(text);
  return normalized.length > 0 && normalized.length <= APP_CONFIG.messageMaxLength;
}

/** Single-line preview (notifications, conversation list), truncated with an ellipsis. */
export function getMessagePreview(text: string, maxLength = 90): string {
  const singleLine = normalizeMessageText(text).replace(/\s+/g, ' ');
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}
