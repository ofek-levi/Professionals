/* eslint-disable @typescript-eslint/no-require-imports */
import { fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { i18n, initI18n } from '@/i18n';
import type { CategoryId } from '@/types/domain';

import { renderWithProviders } from '../../__test-utils__/render';
import { CategoryPicker } from '../category-picker';

jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@/services/api', () => ({
  api: { catalog: { getProfessionalCategories: () => new Promise(() => undefined) } },
}));

function MultiHarness({ onChange, maxSelected }: { onChange: (ids: CategoryId[]) => void; maxSelected?: number }) {
  const [value, setValue] = useState<CategoryId[]>([]);
  return (
    <CategoryPicker
      mode="multiple"
      value={value}
      maxSelected={maxSelected}
      onChange={(ids) => {
        setValue(ids);
        onChange(ids);
      }}
    />
  );
}

describe('CategoryPicker', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  // Reset before each test (nothing is mounted yet, so no act() warnings).
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('lists categories grouped by catalog group', async () => {
    await renderWithProviders(<CategoryPicker mode="single" value={null} onChange={jest.fn()} />);
    expect(screen.getByRole('header', { name: 'Home Repairs & Maintenance' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Moving & Transportation' })).toBeOnTheScreen();
    expect(screen.getByText('Plumbing')).toBeOnTheScreen();
    expect(screen.getByText('Vehicle Towing')).toBeOnTheScreen();
  });

  it('searches names and keywords and selects a single category', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<CategoryPicker mode="single" value={null} onChange={onChange} />);

    await fireEvent.changeText(screen.getByTestId('category-search'), 'leak');
    expect(screen.getByText('Plumbing')).toBeOnTheScreen();
    expect(screen.queryByText('Vehicle Towing')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('category-option-plumbing'));
    expect(onChange).toHaveBeenCalledWith('plumbing');
  });

  it('finds categories by Hebrew keywords in the Hebrew UI', async () => {
    await i18n.changeLanguage('he');
    await renderWithProviders(<CategoryPicker mode="single" value="hvac" onChange={jest.fn()} />);

    await fireEvent.changeText(screen.getByTestId('category-search'), 'מזגן');
    expect(screen.getByText('מיזוג אוויר')).toBeOnTheScreen();
    expect(screen.getByTestId('category-option-hvac')).toBeChecked();
  });

  it('shows an empty state when nothing matches', async () => {
    await renderWithProviders(<CategoryPicker mode="single" value={null} onChange={jest.fn()} />);
    await fireEvent.changeText(screen.getByTestId('category-search'), 'qwertyzz');
    expect(screen.getByText('No matching services')).toBeOnTheScreen();
  });

  it('toggles multiple categories and enforces the maximum', async () => {
    const onChange = jest.fn();
    await renderWithProviders(<MultiHarness onChange={onChange} maxSelected={2} />);

    await fireEvent.press(screen.getByTestId('category-option-plumbing'));
    await fireEvent.press(screen.getByTestId('category-option-electrical'));
    expect(onChange).toHaveBeenLastCalledWith(['plumbing', 'electrical']);
    expect(screen.getByText('2 selected')).toBeOnTheScreen();
    expect(screen.getByText('You can choose up to 2 services.')).toBeOnTheScreen();
    expect(screen.getByTestId('category-option-hvac')).toBeDisabled();

    await fireEvent.press(screen.getByTestId('category-option-plumbing'));
    expect(onChange).toHaveBeenLastCalledWith(['electrical']);
  });
});
