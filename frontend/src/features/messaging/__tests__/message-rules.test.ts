import { canSendMessage, getMessagePreview, isSendableMessageText, normalizeMessageText } from '../message-rules';

describe('message rules', () => {
  it('normalizes whitespace', () => {
    expect(normalizeMessageText('  Hello \r\nthere   \n\n\n\nBye  ')).toBe('Hello\nthere\n\nBye');
  });

  it('checks sendability', () => {
    expect(canSendMessage({ isOpen: true })).toBe(true);
    expect(canSendMessage({ isOpen: false })).toBe(false);
    expect(isSendableMessageText('   ')).toBe(false);
    expect(isSendableMessageText('Hi')).toBe(true);
    expect(isSendableMessageText('x'.repeat(2001))).toBe(false);
  });

  it('builds single-line previews', () => {
    expect(getMessagePreview('Line one\nline two')).toBe('Line one line two');
    const preview = getMessagePreview('a'.repeat(200), 20);
    expect(preview).toHaveLength(20);
    expect(preview.endsWith('…')).toBe(true);
  });
});
