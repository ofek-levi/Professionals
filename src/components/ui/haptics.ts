/**
 * Fire-and-forget haptic feedback. No-ops on web and never throws (haptics are a nicety).
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

function run(effect: () => Promise<void>): void {
  if (!enabled) return;
  effect().catch(() => undefined);
}

export const haptics = {
  /** Button presses. */
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Toggling a selection (chips, stars, segmented controls). */
  selection: () => run(() => Haptics.selectionAsync()),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
