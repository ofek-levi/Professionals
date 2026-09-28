import { act, fireEvent, screen } from '@testing-library/react-native';

import { emitMapMessage, getMapWebView, injectedMapMessages } from '@/components/__test-utils__/map-bridge';
import { webViewMock } from '@/components/__test-utils__/react-native-webview.mock';
import { renderWithProviders } from '@/components/__test-utils__/render';
import type { MapPageState } from '@/components/map/leaflet/map-protocol';
import { regionToBounds } from '@/components/map/leaflet/map-geometry';
import { initI18n } from '@/i18n';
import { createTheme } from '@/theme';
import type { CategoryId, ProfessionalRequestView, ServiceArea, UrgencyLevel } from '@/types/domain';
import { regionForRadius } from '@/utils/geo';

import { ExploreMapView } from '../explore-map-view';

const mockRequests: { current: ProfessionalRequestView[] } = { current: [] };

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/services/api', () => ({
  api: { catalog: { getProfessionalCategories: () => new Promise(() => undefined) } },
}));
jest.mock('@/hooks/queries/use-refetch-on-focus', () => ({ useRefetchOnFocus: () => undefined }));
jest.mock('@/hooks/queries/use-request-queries', () => ({
  useNearbyRequestsForMap: () => ({
    data: { items: mockRequests.current, totalCount: mockRequests.current.length },
    isPending: false,
    isFetching: false,
    isError: false,
    isPlaceholderData: false,
    refetch: () => Promise.resolve(),
  }),
}));

const SERVICE_AREA: ServiceArea = { center: { latitude: 32.08, longitude: 34.78 }, radiusKm: 10, label: 'Tel Aviv' };
const HOME = regionForRadius(SERVICE_AREA.center, SERVICE_AREA.radiusKm);

function request(id: string, categoryId: CategoryId, urgency: UrgencyLevel, latitude: number): ProfessionalRequestView {
  const at = '2026-09-27T10:00:00.000Z';
  return {
    id,
    customerId: 'customer-1',
    categoryId,
    description: `Request ${id}`,
    location: {
      coordinates: { latitude, longitude: 34.78 },
      addressLine: '',
      city: 'Tel Aviv-Yafo',
      neighborhood: null,
      details: null,
      isApproximate: true,
    },
    urgency,
    preferredSchedule: null,
    photos: [],
    notes: null,
    status: 'open',
    offerCount: 0,
    pendingOfferCount: 0,
    acceptedOfferId: null,
    jobId: null,
    publishedAt: at,
    cancelledAt: null,
    cancellationReason: null,
    cancellationComment: null,
    createdAt: at,
    updatedAt: at,
    distanceKm: 2.5,
    customer: { id: 'customer-1', displayName: 'Dana', avatarUrl: null, city: null, memberSince: at, completedJobsCount: 0 },
    myOffer: null,
    isMatch: true,
  };
}

const webView = () => getMapWebView();
const lastState = () => injectedMapMessages().filter((message) => message.type === 'state').pop()?.state as MapPageState;
const theme = createTheme('light', false);
const layout = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height } } });

async function renderMap(maxDistanceKm: number | null = null) {
  await renderWithProviders(
    <ExploreMapView
      serviceArea={SERVICE_AREA}
      params={{}}
      maxDistanceKm={maxDistanceKm}
      hasFilters={false}
      onAdjustFilters={jest.fn()}
      onClearFilters={jest.fn()}
    />,
  );
  await emitMapMessage(webView(), { type: 'ready' });
}

describe('ExploreMapView', () => {
  beforeAll(async () => {
    await initI18n('en');
  });

  beforeEach(() => {
    webViewMock.injectJavaScript.mockClear();
    mockRequests.current = [
      request('r1', 'plumbing', 'emergency', 32.07),
      // A category the server added after this app version shipped.
      request('r2', 'no-such-category' as CategoryId, 'normal', 32.09),
    ];
  });

  it('shows one marker per job (urgency color, category glyph) and the service-area circles', async () => {
    await renderMap(4);
    const { markers, circles } = lastState();
    const { tones } = theme.colors;
    expect(markers).toEqual([
      expect.objectContaining({ id: 'r1', color: tones.danger.solid, icon: 'pipe-wrench', label: 'Plumbing', selected: false }),
      // Unknown category: the generic briefcase glyph.
      expect.objectContaining({ id: 'r2', color: tones.info.solid, icon: 'briefcase-outline', selected: false }),
    ]);
    expect(circles.map((circle) => [circle.id, circle.radiusMeters])).toEqual([
      ['service-area', 10_000],
      ['max-distance', 4000],
    ]);
  });

  it('selects a marker, opens its preview and keeps the overlays clear; a map tap closes it', async () => {
    await renderMap();
    const { spacing } = theme;
    await act(async () => fireEvent(screen.getByText('2 jobs in your area'), 'layout', layout(36)));
    await act(async () => fireEvent(screen.getByTestId('explore-recenter'), 'layout', layout(48)));
    expect(lastState().insets).toEqual({ top: spacing.md + 36, bottom: spacing.lg + 48, left: 0, right: 0 });

    await emitMapMessage(webView(), { type: 'markerPress', id: 'r1' });
    expect(screen.getByTestId('explore-map-preview')).toBeOnTheScreen();
    expect(lastState().markers.map((marker) => marker.selected)).toEqual([true, false]);

    // The card's height joins the bottom inset: the attribution and the selected marker stay above it.
    await act(async () => fireEvent(screen.getByTestId('explore-map-preview'), 'layout', layout(140)));
    expect(lastState().insets.bottom).toBe(spacing.lg + 48 + spacing.md + 140);

    await emitMapMessage(webView(), { type: 'mapPress', coordinate: { latitude: 32.1, longitude: 34.8 } });
    expect(screen.queryByTestId('explore-map-preview')).toBeNull();
    expect(lastState().markers.every((marker) => !marker.selected)).toBe(true);
    expect(lastState().insets.bottom).toBe(spacing.lg + 48);
  });

  it('recenters after closing the preview, so the area is fitted without the card', async () => {
    await renderMap();
    await emitMapMessage(webView(), { type: 'markerPress', id: 'r2' });
    await act(async () => fireEvent(screen.getByTestId('explore-map-preview'), 'layout', layout(140)));
    webViewMock.injectJavaScript.mockClear();

    await act(async () => fireEvent.press(screen.getByTestId('explore-recenter')));
    const messages = injectedMapMessages();
    expect(messages.map((message) => message.type)).toEqual(['state', 'animateToRegion']);
    expect((messages[0].state as MapPageState).markers.every((marker) => !marker.selected)).toBe(true);
    expect(messages[1]).toMatchObject({ bounds: regionToBounds(HOME), durationMs: 350 });
  });

  it('updates markers in place when the jobs change, without moving the camera', async () => {
    await renderMap();
    webViewMock.injectJavaScript.mockClear();
    mockRequests.current = [mockRequests.current[0]];
    await screen.rerender(
      <ExploreMapView serviceArea={SERVICE_AREA} params={{ urgencies: ['emergency'] }} maxDistanceKm={null} hasFilters onAdjustFilters={jest.fn()} onClearFilters={jest.fn()} />,
    );
    const messages = injectedMapMessages();
    expect(messages.map((message) => message.type)).toEqual(['state']);
    expect((messages[0].state as MapPageState).markers.map((marker) => marker.id)).toEqual(['r1']);
  });
});
