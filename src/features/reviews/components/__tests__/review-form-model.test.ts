import { hasHighlight, toggleHighlight } from '../review-form-model';

describe('review highlights', () => {
  it('appends a highlight as its own sentence', () => {
    expect(toggleHighlight('', 'Arrived on time', 800)).toBe('Arrived on time.');
    expect(toggleHighlight('Great job', 'Fair price', 800)).toBe('Great job. Fair price.');
    expect(toggleHighlight('Great job!  ', 'Fair price', 800)).toBe('Great job! Fair price.');
    expect(toggleHighlight('הגיע בזמן.', 'מחיר הוגן', 800)).toBe('הגיע בזמן. מחיר הוגן.');
  });

  it('removes a highlight that is already in the comment', () => {
    expect(toggleHighlight('Arrived on time. Fair price.', 'Arrived on time', 800)).toBe('Fair price.');
    expect(toggleHighlight('Arrived on time. Fair price.', 'Fair price', 800)).toBe('Arrived on time.');
    expect(toggleHighlight('Fair price', 'Fair price', 800)).toBe('');
  });

  it('keeps the comment unchanged when the highlight would not fit', () => {
    expect(toggleHighlight('x'.repeat(10), 'Fair price', 15)).toBe('x'.repeat(10));
  });

  it('detects highlights and ignores empty phrases', () => {
    expect(hasHighlight('Arrived on time. Fair price.', 'Fair price')).toBe(true);
    expect(hasHighlight('Arrived on time.', 'Fair price')).toBe(false);
    expect(hasHighlight('anything', '')).toBe(false);
    expect(toggleHighlight('Keep me', '', 800)).toBe('Keep me');
  });
});
