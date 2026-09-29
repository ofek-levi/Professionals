import { fireEvent, screen } from '@testing-library/react-native';
import { StatusBar } from 'react-native';

import { initI18n } from '@/i18n';

import { renderWithProviders } from '../../__test-utils__/render';
import { PhotoStrip } from '../photo-strip';

const PHOTOS = [
  { id: 'p1', url: 'file:///photo-1.jpg', width: 800, height: 600 },
  { id: 'p2', url: 'file:///photo-2.jpg', width: 800, height: 600 },
];

describe('PhotoStrip', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('switches to light status bar icons before the black viewer opens, and back when it closes', async () => {
    const push = jest.spyOn(StatusBar, 'pushStackEntry');
    const pop = jest.spyOn(StatusBar, 'popStackEntry');
    await renderWithProviders(<PhotoStrip photos={PHOTOS} />);

    await fireEvent.press(screen.getByRole('imagebutton', { name: 'Open photo 2 of 2' }));
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ barStyle: 'light-content' }));
    expect(screen.getByRole('button', { name: 'Close' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(pop).toHaveBeenCalledWith(push.mock.results[0]?.value);
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });
});
