import { DEFAULT_SETTINGS, parseSettings } from '../settings-store';

describe('parseSettings', () => {
  it('returns defaults for missing or invalid data', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('dark')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings({ colorScheme: 'purple' })).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid fields', () => {
    expect(parseSettings({ colorScheme: 'dark' })).toEqual({ colorScheme: 'dark' });
    expect(parseSettings({ colorScheme: 'light' })).toEqual({ ...DEFAULT_SETTINGS, colorScheme: 'light' });
  });

  it('drops fields of older app versions', () => {
    // Settings saved while the app still had its in-app demo backend.
    expect(parseSettings({ colorScheme: 'dark', simulationEnabled: false })).toEqual({ colorScheme: 'dark' });
  });
});
