import { directionMark } from '../components/legal-text';
import { legalDocumentOfUrl, parseLegalText, withLegalPageLanguage } from '../legal-markup';

describe('parseLegalText', () => {
  it('splits plain text, bold runs and links in reading order', () => {
    expect(parseLegalText('**You must be 18 or older.** Write to [us](mailto:legal@example.com) or see [the map](https://osm.org).')).toEqual([
      { kind: 'text', text: 'You must be 18 or older.', bold: true },
      { kind: 'text', text: ' Write to ', bold: false },
      { kind: 'link', text: 'us', url: 'mailto:legal@example.com', bold: false },
      { kind: 'text', text: ' or see ', bold: false },
      { kind: 'link', text: 'the map', url: 'https://osm.org', bold: false },
      { kind: 'text', text: '.', bold: false },
    ]);
  });

  it('keeps text without markup as one run', () => {
    expect(parseLegalText('Plain text, with * a star and [brackets].')).toEqual([
      { kind: 'text', text: 'Plain text, with * a star and [brackets].', bold: false },
    ]);
    expect(parseLegalText('')).toEqual([]);
  });

  it('finds links inside bold text and bold link labels', () => {
    expect(parseLegalText('**See [the policy](https://example.com/p)**')).toEqual([
      { kind: 'text', text: 'See ', bold: true },
      { kind: 'link', text: 'the policy', url: 'https://example.com/p', bold: true },
    ]);
    expect(parseLegalText('[**Terms**](https://example.com/t)')).toEqual([{ kind: 'link', text: 'Terms', url: 'https://example.com/t', bold: true }]);
  });

  it('opens only web pages and email addresses (other links keep their label as text)', () => {
    expect(parseLegalText('[run](javascript:alert(1))')).toEqual([{ kind: 'text', text: '[run](javascript:alert(1))', bold: false }]);
    expect(parseLegalText('[call](tel:+972501234567)')).toEqual([{ kind: 'text', text: 'call', bold: false }]);
    // `http:` in development only (a local server).
    expect(parseLegalText('[dev](http://localhost:4000/legal/terms)')).toEqual([
      { kind: 'link', text: 'dev', url: 'http://localhost:4000/legal/terms', bold: false },
    ]);
  });

  it('keeps an http: link as text in a production build', () => {
    const runtime = globalThis as unknown as { __DEV__: boolean };
    const dev = runtime.__DEV__;
    runtime.__DEV__ = false;
    try {
      jest.isolateModules(() => {
        const production = jest.requireActual<typeof import('../legal-markup')>('../legal-markup');
        expect(production.parseLegalText('[page](http://example.com/legal/terms)')).toEqual([{ kind: 'text', text: 'page', bold: false }]);
        expect(production.parseLegalText('[page](https://example.com/legal/terms)')).toEqual([
          { kind: 'link', text: 'page', url: 'https://example.com/legal/terms', bold: false },
        ]);
      });
    } finally {
      runtime.__DEV__ = dev;
    }
  });
});

describe('legalDocumentOfUrl', () => {
  const base = 'https://api.example.com/v1';

  it('recognizes the public pages of the app documents on the API origin', () => {
    expect(legalDocumentOfUrl('https://api.example.com/legal/terms', base)).toBe('terms');
    expect(legalDocumentOfUrl('https://api.example.com/legal/privacy?lang=he', base)).toBe('privacy');
    expect(legalDocumentOfUrl('https://API.example.com/legal/privacy/', base)).toBe('privacy');
  });

  it('leaves every other link to the browser', () => {
    // A web page only (Google Play's deletion page), another site, another path.
    expect(legalDocumentOfUrl('https://api.example.com/legal/account-deletion', base)).toBeNull();
    expect(legalDocumentOfUrl('https://other.example.com/legal/terms', base)).toBeNull();
    expect(legalDocumentOfUrl('https://api.example.com/v1/legal/terms', base)).toBeNull();
    expect(legalDocumentOfUrl('mailto:legal@example.com', base)).toBeNull();
  });
});

describe('withLegalPageLanguage', () => {
  const base = 'https://api.example.com/v1';

  it('opens the public pages in the app’s language', () => {
    expect(withLegalPageLanguage('https://api.example.com/legal/account-deletion', base, 'he')).toBe(
      'https://api.example.com/legal/account-deletion?lang=he',
    );
    expect(withLegalPageLanguage('https://api.example.com/legal/terms?x=1#changes', base, 'en')).toBe(
      'https://api.example.com/legal/terms?x=1&lang=en#changes',
    );
  });

  it('leaves a language the link names, and every other link, as it is', () => {
    expect(withLegalPageLanguage('https://api.example.com/legal/privacy?lang=en', base, 'he')).toBe('https://api.example.com/legal/privacy?lang=en');
    expect(withLegalPageLanguage('https://other.example.com/legal/terms', base, 'he')).toBe('https://other.example.com/legal/terms');
    expect(withLegalPageLanguage('mailto:legal@example.com', base, 'he')).toBe('mailto:legal@example.com');
  });
});

describe('directionMark', () => {
  it('sets the direction of a paragraph that starts in the other script', () => {
    expect(directionMark('Professionals מופעלת על ידי:', 'rtl')).toBe('‏');
    expect(directionMark('תנאי השימוש של Professionals', 'rtl')).toBe('');
    expect(directionMark('Professionals is operated by:', 'ltr')).toBe('');
    expect(directionMark('050-1234567', 'rtl')).toBe('‏');
    expect(directionMark('', 'rtl')).toBe('');
  });
});
