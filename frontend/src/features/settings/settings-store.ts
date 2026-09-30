/**
 * Device-level app preferences (not tied to an account), persisted with AsyncStorage:
 * `colorScheme` follows the system or forces light/dark.
 *
 * Language lives in i18n (`src/i18n`), account notification preferences on the server profile.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

const STORAGE_KEY = '@professionals/settings/v1';

const COLOR_SCHEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ColorSchemePreference = (typeof COLOR_SCHEME_PREFERENCES)[number];

interface AppSettings {
  colorScheme: ColorSchemePreference;
}

export const DEFAULT_SETTINGS: AppSettings = {
  colorScheme: 'system',
};

type Listener = (settings: AppSettings) => void;

let state: AppSettings = DEFAULT_SETTINGS;
let hydratePromise: Promise<AppSettings> | null = null;
const listeners = new Set<Listener>();

function isColorSchemePreference(value: unknown): value is ColorSchemePreference {
  return typeof value === 'string' && (COLOR_SCHEME_PREFERENCES as readonly string[]).includes(value);
}

/** Validates persisted JSON field by field, falling back to defaults (unknown fields are dropped). */
export function parseSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const candidate = raw as Partial<Record<keyof AppSettings, unknown>>;
  return {
    colorScheme: isColorSchemePreference(candidate.colorScheme) ? candidate.colorScheme : DEFAULT_SETTINGS.colorScheme,
  };
}

function setState(next: AppSettings): void {
  state = next;
  listeners.forEach((listener) => listener(state));
}

async function persist(settings: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Non critical: the preference applies for this session.
  }
}

export const settingsStore = {
  getState(): AppSettings {
    return state;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Loads persisted settings once per launch and applies them. */
  hydrate(): Promise<AppSettings> {
    hydratePromise ??= (async () => {
      let loaded = DEFAULT_SETTINGS;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        loaded = parseSettings(raw ? (JSON.parse(raw) as unknown) : null);
      } catch {
        // Corrupted or unavailable storage: keep defaults.
      }
      setState(loaded);
      return state;
    })();
    return hydratePromise;
  },

  update(patch: Partial<AppSettings>): Promise<void> {
    setState({ ...state, ...patch });
    return persist(state);
  },

  setColorScheme(colorScheme: ColorSchemePreference): Promise<void> {
    return settingsStore.update({ colorScheme });
  },
};

/** Current app settings; re-renders on change. */
export function useSettings(): AppSettings {
  return useSyncExternalStore(settingsStore.subscribe, settingsStore.getState, settingsStore.getState);
}
