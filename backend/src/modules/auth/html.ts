/** Helpers shared by the auth emails and the server-rendered link pages. */
import type { AppLanguage } from '../../shared/domain.js';

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapes text for HTML content and attribute values. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

export function directionOf(language: AppLanguage): 'rtl' | 'ltr' {
  return language === 'he' ? 'rtl' : 'ltr';
}

/** `start` alignment for clients without logical CSS properties (email clients). */
export function startSideOf(language: AppLanguage): 'right' | 'left' {
  return language === 'he' ? 'right' : 'left';
}

export const BRAND = {
  name: 'Professionals',
  color: '#1f6feb',
  text: '#1c2430',
  muted: '#5b6675',
  background: '#f4f6f9',
  font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, 'Noto Sans Hebrew', sans-serif",
} as const;
