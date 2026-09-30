/**
 * Build configuration: the app talks to `EXPO_PUBLIC_API_BASE_URL` only; deployed builds must name
 * an https backend, development defaults to the local one; realtime is derived from it.
 */
import { DEVELOPMENT_API_BASE_URL, EnvConfigError, env, resolveEnv, toRealtimeUrl } from '../env';

describe('env', () => {
  it('defaults to development against the local backend', () => {
    expect(resolveEnv({})).toEqual({
      appEnv: 'development',
      apiBaseUrl: 'http://localhost:4000/v1',
      realtimeUrl: 'ws://localhost:4000/v1/realtime',
      easProjectId: null,
    });
    expect(DEVELOPMENT_API_BASE_URL).toBe('http://localhost:4000/v1');
    // Jest runs without EXPO_PUBLIC_* variables.
    expect(env.apiBaseUrl).toBe(DEVELOPMENT_API_BASE_URL);
  });

  it('accepts the Android emulator and LAN addresses in development', () => {
    expect(resolveEnv({ apiBaseUrl: 'http://10.0.2.2:4000/v1/' }).apiBaseUrl).toBe('http://10.0.2.2:4000/v1');
    expect(resolveEnv({ apiBaseUrl: ' http://192.168.1.20:4000/v1 ', easProjectId: ' 1234 ' })).toMatchObject({
      apiBaseUrl: 'http://192.168.1.20:4000/v1',
      realtimeUrl: 'ws://192.168.1.20:4000/v1/realtime',
      easProjectId: '1234',
    });
  });

  it('requires an explicit https backend for staging and production', () => {
    expect(resolveEnv({ appEnv: 'production', apiBaseUrl: 'https://api.example.com/v1' })).toMatchObject({
      appEnv: 'production',
      realtimeUrl: 'wss://api.example.com/v1/realtime',
    });
    expect(() => resolveEnv({ appEnv: 'staging' })).toThrow(EnvConfigError);
    expect(() => resolveEnv({ appEnv: 'production', apiBaseUrl: 'http://api.example.com/v1' })).toThrow(/https/);
    expect(() => resolveEnv({ appEnv: 'qa', apiBaseUrl: 'https://api.example.com/v1' })).toThrow(/EXPO_PUBLIC_APP_ENV/);
    expect(() => resolveEnv({ apiBaseUrl: 'localhost:4000' })).toThrow(/not an http\(s\) URL/);
  });

  it('derives the realtime URL from the API base URL', () => {
    expect(toRealtimeUrl('https://api.example.com/v1')).toBe('wss://api.example.com/v1/realtime');
    expect(toRealtimeUrl('http://localhost:4000/v1')).toBe('ws://localhost:4000/v1/realtime');
  });
});
