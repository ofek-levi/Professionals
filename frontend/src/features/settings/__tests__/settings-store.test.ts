import { DEFAULT_SETTINGS, parseSettings } from '../settings-store';

describe('parseSettings', () => {
  it('returns defaults for missing or invalid data', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('dark')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ colorScheme: 'purple', simulationEnabled: 'yes' })).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid fields', () => {
    expect(parseSettings({ colorScheme: 'dark', simulationEnabled: false })).toEqual({
      colorScheme: 'dark',
      simulationEnabled: false,
    });
    expect(parseSettings({ colorScheme: 'light' })).toEqual({ ...DEFAULT_SETTINGS, colorScheme: 'light' });
  });
});
