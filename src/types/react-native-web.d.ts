/**
 * Props that react-native-web understands but the React Native typings do not declare.
 * Only used on web; native ignores them.
 */
import 'react-native';

declare module 'react-native' {
  interface ViewProps {
    /**
     * @platform web
     * Writing direction of this subtree. React Native Web sets the DOM `dir` attribute and resolves
     * logical styles (`paddingStart`, `start`, `borderStartWidth`, …) of every descendant against it,
     * including content rendered through portals (modals).
     */
    dir?: 'ltr' | 'rtl' | 'auto';
  }
}
