import { createSimulatedPushProvider } from '../simulated-push-provider';
import type { PushMessage } from '../types';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

const message: PushMessage = {
  id: 'ntf_1',
  title: 'New offer',
  body: 'Yossi sent an offer',
  target: { kind: 'offer', offerId: 'off_1', requestId: 'req_1' },
  notificationId: 'ntf_1',
  notificationType: 'offer_received',
};

describe('simulated push provider', () => {
  it('grants permission and keeps a stable device token per install', async () => {
    const storage = memoryStorage();
    let counter = 0;
    const generateToken = () => `token-${++counter}`;
    const provider = createSimulatedPushProvider({ storage, generateToken });

    expect(await provider.requestPermission()).toBe('granted');
    expect(await provider.getDeviceToken()).toBe('token-1');
    expect(await provider.getDeviceToken()).toBe('token-1');

    // A new app launch (new provider instance) reads the persisted token.
    const relaunched = createSimulatedPushProvider({ storage, generateToken });
    expect(await relaunched.getDeviceToken()).toBe('token-1');
    expect(counter).toBe(1);
  });

  it('delivers to listeners and presents a banner whose tap emits a response', () => {
    const provider = createSimulatedPushProvider({ storage: memoryStorage() });
    const received = jest.fn();
    const responded = jest.fn();
    const presenter = jest.fn();
    provider.onNotification(received);
    provider.onNotificationResponse(responded);
    const detach = provider.setBannerPresenter(presenter);

    provider.deliver(message);
    expect(received).toHaveBeenCalledWith(message);
    expect(presenter).toHaveBeenCalledTimes(1);
    expect(responded).not.toHaveBeenCalled();

    const [, onPress] = presenter.mock.calls[0] as [PushMessage, () => void];
    onPress();
    expect(responded).toHaveBeenCalledWith(message);

    detach();
    provider.deliver(message);
    expect(presenter).toHaveBeenCalledTimes(1);
    expect(received).toHaveBeenCalledTimes(2);
  });

  it('can deliver silently and unsubscribe listeners', () => {
    const provider = createSimulatedPushProvider({ storage: memoryStorage() });
    const presenter = jest.fn();
    const received = jest.fn();
    provider.setBannerPresenter(presenter);
    const unsubscribe = provider.onNotification(received);

    provider.deliver(message, { showBanner: false });
    expect(presenter).not.toHaveBeenCalled();
    expect(received).toHaveBeenCalledTimes(1);

    unsubscribe();
    provider.deliver(message);
    expect(received).toHaveBeenCalledTimes(1);
  });
});
