/**
 * Jest stand-in for `react-native-maps` (its native module does not exist in Jest).
 *
 * Usage in a test that renders `AppMap` / `LocationPicker` on the native preset:
 *   jest.mock('react-native-maps', () => require('@/components/map/react-native-maps.mock'));
 */
import { Component, type ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

interface MockProps extends ViewProps {
  children?: ReactNode;
  /** Map/marker callbacks are forwarded so tests can `fireEvent(…, 'press' | 'dragEnd', …)`. */
  [callback: `on${string}`]: unknown;
}

export default class MapView extends Component<MockProps> {
  animateToRegion(): void {}
  fitToCoordinates(): void {}
  override render() {
    const { children, ...rest } = this.props;
    return (
      <View testID="mock-map-view" {...(rest as ViewProps)}>
        {children}
      </View>
    );
  }
}

function MockChild({ children, ...rest }: MockProps) {
  return <View {...(rest as ViewProps)}>{children}</View>;
}

export const Marker = MockChild;
export const Circle = MockChild;
export const Polyline = MockChild;
export const Polygon = MockChild;
export const Callout = MockChild;
export const PROVIDER_DEFAULT = undefined;
export const PROVIDER_GOOGLE = 'google';
