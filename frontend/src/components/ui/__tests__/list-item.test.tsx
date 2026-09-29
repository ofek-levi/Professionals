import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '../../__test-utils__/render';
import { ListItem } from '../list-item';

describe('ListItem', () => {
  it('announces single-select rows as radio buttons with their checked state', async () => {
    await renderWithProviders(
      <>
        <ListItem title="English" checked onPress={jest.fn()} />
        <ListItem title="עברית" checked={false} onPress={jest.fn()} />
        <ListItem title="Edit profile" onPress={jest.fn()} />
      </>,
    );
    expect(screen.getByRole('radio', { name: 'English', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'עברית', checked: false })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Edit profile' })).toBeOnTheScreen();
  });
});
