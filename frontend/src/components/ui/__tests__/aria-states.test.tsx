/**
 * Selected, checked, expanded, disabled and busy states are passed as `aria-*` props: React Native
 * maps them to its accessibility state (checked here), and react-native-web, which ignores
 * `accessibilityState`, writes them to the DOM (checked in the browser run), so web screen readers
 * announce them too.
 */
import { screen } from '@testing-library/react-native';

import { renderWithProviders as render } from '../../__test-utils__/render';

import { Button } from '../button';
import { Chip } from '../chip';
import { Icon } from '../icon';
import { SegmentedControl } from '../segmented-control';
import { SwitchRow } from '../switch-row';

describe('web-visible accessibility states', () => {
  it('marks the selected segment', async () => {
    await render(
      <SegmentedControl
        options={[
          { value: 'updates', label: 'Updates' },
          { value: 'messages', label: 'Messages' },
        ]}
        value="messages"
        onChange={() => undefined}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Messages', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Updates', selected: false })).toBeOnTheScreen();
  });

  it('marks a switch row as checked and a chip as selected', async () => {
    await render(
      <>
        <SwitchRow title="Email updates" value onValueChange={() => undefined} testID="switch" />
        <Chip label="Plumbing" selected onPress={() => undefined} testID="chip" />
      </>,
    );
    expect(screen.getByRole('switch', { name: 'Email updates', checked: true })).toBeOnTheScreen();
    expect(screen.getByTestId('chip')).toBeSelected();
  });

  it('marks a loading button as busy and disabled', async () => {
    await render(<Button label="Save" loading onPress={() => undefined} testID="save" />);
    expect(screen.getByTestId('save')).toBeBusy();
    expect(screen.getByTestId('save')).toBeDisabled();
  });

  it('hides decorative icons from screen readers, on the web too', async () => {
    await render(
      <>
        <Icon name="translate" testID="decorative" />
        <Icon name="star" accessibilityLabel="Rated" testID="labelled" />
      </>,
    );
    expect(screen.queryByTestId('decorative')).toBeNull();
    expect(screen.getByTestId('decorative', { includeHiddenElements: true }).props['aria-hidden']).toBe(true);
    expect(screen.getByRole('image', { name: 'Rated' })).toBeOnTheScreen();
  });
});
