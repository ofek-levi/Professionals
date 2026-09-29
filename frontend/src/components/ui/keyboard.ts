/** Software keyboard helpers shared by `Screen`, `Sheet` and custom scroll views. */
import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * `keyboardDismissMode` for scroll views: dragging the content dismisses the keyboard on native
 * (`interactive` is iOS-only; Android treats it as `none`). react-native-web treats *every* scroll
 * event as a drag, including the browser scrolling a just-focused field into view, so 'on-drag'
 * would blur the field while the user types; the web keyboard is dismissed by the browser itself.
 */
export const KEYBOARD_DISMISS_MODE = Platform.select({ ios: 'interactive', android: 'on-drag', default: 'none' } as const);

/**
 * `true` while the software keyboard is shown (always `false` on the web). Keyboard-avoiding
 * footers use it to drop their bottom safe-area padding: the keyboard already covers that area.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(() => Platform.OS !== 'web' && Keyboard.isVisible());

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    // iOS announces the keyboard before it animates in; Android only once it is shown.
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subscriptions = [
      Keyboard.addListener(show, () => setVisible(true)),
      Keyboard.addListener(hide, () => setVisible(false)),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  return visible;
}
