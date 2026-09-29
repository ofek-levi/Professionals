import { alignForText, alignForTextDirection, getTextDirection, isolateLtr, isolateText } from '../bidi';

describe('getTextDirection', () => {
  it('detects the direction from the first strong character', () => {
    expect(getTextDirection('שלום, מה נשמע?')).toBe('rtl');
    expect(getTextDirection('  123 Hello')).toBe('ltr');
    expect(getTextDirection('10:00 👍 בסדר')).toBe('rtl');
    expect(getTextDirection('12345 !!')).toBeNull();
    expect(getTextDirection('')).toBeNull();
  });

  it('skips isolated text and honours directional marks (Unicode rules P2/P3)', () => {
    expect(getTextDirection(`${isolateText('Noa L.')} אישרה את ההצעה`)).toBe('rtl');
    expect(getTextDirection(`${isolateText('נועה')} accepted your offer`)).toBe('ltr');
    expect(getTextDirection(isolateText('Noa'))).toBeNull();
    expect(getTextDirection(`${String.fromCharCode(0x200f)}1,250 ₪`)).toBe('rtl');
  });
});

describe('alignment', () => {
  it('aligns text to its natural side in either layout', () => {
    expect(alignForTextDirection('ltr', false)).toBe('start');
    expect(alignForTextDirection('ltr', true)).toBe('end');
    expect(alignForTextDirection('rtl', true)).toBe('start');
    expect(alignForTextDirection('rtl', false)).toBe('end');
    expect(alignForTextDirection(null, true)).toBe('start');
  });

  it('derives the alignment from the text itself', () => {
    expect(alignForText('Great job, very professional.', true)).toBe('end');
    expect(alignForText('עבודה מצוינת', true)).toBe('start');
    expect(alignForText('עבודה מצוינת', false)).toBe('end');
    expect(alignForText('👍👍', true)).toBe('start');
  });
});

describe('isolateText', () => {
  it('wraps text in first-strong isolates and leaves empty text alone', () => {
    expect(isolateText('Hi')).toBe('\u2068Hi\u2069');
    expect(isolateText('')).toBe('');
  });
});

describe('isolateLtr', () => {
  it('wraps a range in a left-to-right isolate that direction detection skips', () => {
    const range = isolateLtr('08:00–17:00');
    expect(range).toBe('\u206608:00–17:00\u2069');
    expect(getTextDirection(`זמינים היום · ${range}`)).toBe('rtl');
    expect(isolateLtr('')).toBe('');
  });
});
