/**
 * Fire-and-forget haptic feedback. No-ops on web and never throws (haptics are a nicety).
 *
 * Android uses the system haptic constants (`performAndroidHapticsAsync`): they are subtle and
 * follow the "touch feedback" setting, while the iOS-style calls are emulated there with the
 * vibration motor. Constants the device's Android version lacks are skipped silently.
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function run(effect: () => Promise<void>): void {
  if (!enabled) return;
  effect().catch(() => undefined);
}

function feedback(ios: () => Promise<void>, android: Haptics.AndroidHaptics): () => void {
  return () => run(Platform.OS === 'android' ? () => Haptics.performAndroidHapticsAsync(android) : ios);
}

export const haptics = {
  /** Button presses. */
  light: feedback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), Haptics.AndroidHaptics.Virtual_Key),
  /** Toggling a selection (chips, stars, segmented controls). */
  selection: feedback(() => Haptics.selectionAsync(), Haptics.AndroidHaptics.Clock_Tick),
  success: feedback(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), Haptics.AndroidHaptics.Confirm),
  warning: feedback(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning), Haptics.AndroidHaptics.Reject),
  error: feedback(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), Haptics.AndroidHaptics.Reject),
};
