import { screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { renderWithProviders } from '../../__test-utils__/render';
import { AppText } from '../app-text';

const textAlignOf = (text: string) => StyleSheet.flatten(screen.getByText(text).props.style).textAlign;

describe('AppText userContent', () => {
  it('aligns user-written text by its own language in an RTL layout', async () => {
    await renderWithProviders(
      <>
        <AppText userContent>Leaking pipe behind the sink</AppText>
        <AppText userContent>נזילה מאחורי הכיור</AppText>
        <AppText>Interface label</AppText>
        <AppText userContent align="center">
          Centered anyway
        </AppText>
      </>,
      { isRTL: true },
    );
    // Native mirrors left/right in RTL: `right` is the end edge, `left` the start edge.
    expect(textAlignOf('Leaking pipe behind the sink')).toBe('right');
    expect(textAlignOf('נזילה מאחורי הכיור')).toBe('left');
    expect(textAlignOf('Interface label')).toBe('left');
    expect(textAlignOf('Centered anyway')).toBe('center');
  });

  it('puts Hebrew user text on the right in an LTR layout', async () => {
    await renderWithProviders(<AppText userContent>נזילה מאחורי הכיור</AppText>, { isRTL: false });
    expect(textAlignOf('נזילה מאחורי הכיור')).toBe('right');
  });
});
