import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { usePlaceSearch, useReverseGeocode } from '@/hooks/queries/use-geo';
import { locateDevice, openLocationSettings, type LocationFailureReason } from '@/services/location';
import { makeStyles, useTheme } from '@/theme';
import type { GeoCoordinates, PlaceSuggestion, ServiceLocation } from '@/types/domain';
import { regionForRadius, type MapRegion } from '@/utils/geo';

import { AppMap } from '../map/app-map';
import { AppText } from '../ui/app-text';
import { Button } from '../ui/button';
import { Field } from '../ui/field';
import { Icon } from '../ui/icon';
import { InlineAlert } from '../ui/inline-alert';
import { TextField } from '../ui/text-field';

export interface LocationPickerProps {
  value: ServiceLocation | null;
  onChange: (location: ServiceLocation) => void;
  /** Map viewport before anything is selected (e.g. the user's city). */
  initialRegion?: MapRegion;
  label?: string;
  required?: boolean;
  /** Already translated error for the whole location. */
  error?: string | null;
  /** Show the apartment/floor/entrance field (default `true`). */
  showDetailsField?: boolean;
  mapHeight?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SUGGESTIONS_BLUR_DELAY_MS = 200;

/** Zoom used when focusing a selected address (~ a few streets). */
const FOCUS_RADIUS_KM = 0.45;

const FAILURE_KEYS = {
  permission_denied: 'permissionDenied',
  permission_blocked: 'permissionBlocked',
  services_disabled: 'servicesDisabled',
  timeout: 'timeout',
  unavailable: 'unavailable',
} as const satisfies Record<LocationFailureReason, string>;

function toServiceLocation(coordinates: GeoCoordinates, place: Pick<PlaceSuggestion, 'addressLine' | 'city' | 'neighborhood'>, details: string | null): ServiceLocation {
  return {
    coordinates,
    addressLine: place.addressLine,
    city: place.city,
    neighborhood: place.neighborhood,
    details,
    isApproximate: false,
  };
}

/**
 * Service address picker: debounced address search, "use my current location" (permission is
 * requested only on press), a map with a tap-to-place / draggable pin that reverse-geocodes, and
 * editable address + apartment details.
 */
export function LocationPicker({
  value,
  onChange,
  initialRegion,
  label,
  required,
  error,
  showDetailsField = true,
  mapHeight = 220,
  style,
  testID,
}: LocationPickerProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['location', 'common']);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [focusRegion, setFocusRegion] = useState<MapRegion | undefined>(() =>
    value ? regionForRadius(value.coordinates, FOCUS_RADIUS_KM) : undefined,
  );
  const [pendingReverse, setPendingReverse] = useState<GeoCoordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<LocationFailureReason | null>(null);
  const [usedLastKnown, setUsedLastKnown] = useState(false);

  const places = usePlaceSearch(query);
  // Hide suggestions slightly after blur so a tap/click on a suggestion (which blurs the input
  // first on web) still lands.
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    [],
  );
  const reverse = useReverseGeocode(pendingReverse);

  // Apply each reverse-geocoding result once per pin move, keeping the latest user-entered details.
  const latestValue = useRef(value);
  const applied = useRef<{ request: GeoCoordinates; place: PlaceSuggestion } | null>(null);
  useEffect(() => {
    latestValue.current = value;
  });
  useEffect(() => {
    if (!pendingReverse || !reverse.data) return;
    if (applied.current?.request === pendingReverse && applied.current.place === reverse.data) return;
    applied.current = { request: pendingReverse, place: reverse.data };
    onChange(toServiceLocation(pendingReverse, reverse.data, latestValue.current?.details ?? null));
  }, [pendingReverse, reverse.data, onChange]);

  const movePin = (coordinates: GeoCoordinates) => {
    setPendingReverse(coordinates);
    onChange({
      coordinates,
      addressLine: value?.addressLine ?? '',
      city: value?.city ?? '',
      neighborhood: value?.neighborhood ?? null,
      details: value?.details ?? null,
      isApproximate: false,
    });
  };

  const selectPlace = (place: PlaceSuggestion) => {
    Keyboard.dismiss();
    setQuery('');
    setSearchFocused(false);
    setPendingReverse(null);
    setUsedLastKnown(false);
    setFocusRegion(regionForRadius(place.coordinates, FOCUS_RADIUS_KM));
    // Apartment / floor details belong to the previous address: keep them only when the same
    // address was picked again (moving the pin, by contrast, fine-tunes the same address).
    const sameAddress = value !== null && value.addressLine === place.addressLine && value.city === place.city;
    onChange(toServiceLocation(place.coordinates, place, sameAddress ? value.details : null));
  };

  const locateMe = async () => {
    Keyboard.dismiss();
    setLocating(true);
    setLocateError(null);
    const result = await locateDevice();
    setLocating(false);
    if (!result.ok) {
      setLocateError(result.reason);
      return;
    }
    setUsedLastKnown(result.source === 'last_known');
    setFocusRegion(regionForRadius(result.coordinates, FOCUS_RADIUS_KM));
    movePin(result.coordinates);
  };

  const updateField = (patch: Partial<Pick<ServiceLocation, 'addressLine' | 'city' | 'details'>>) => {
    if (value) onChange({ ...value, ...patch });
  };

  const showSuggestions = searchFocused && places.isSearchable;
  const suggestions = places.data ?? [];
  const resolving = pendingReverse !== null && reverse.isFetching;
  const failure = locateError ? FAILURE_KEYS[locateError] : null;

  return (
    <Field label={label ?? t('location:search.label')} required={required} error={error} style={style}>
      <View style={styles.container} testID={testID}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={t('location:search.placeholder')}
          accessibilityLabel={t('location:search.placeholder')}
          leftIcon="magnify"
          clearable
          autoCorrect={false}
          returnKeyType="search"
          onFocus={() => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
            setSearchFocused(true);
          }}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setSearchFocused(false), SUGGESTIONS_BLUR_DELAY_MS);
          }}
          testID="location-search"
        />

        {showSuggestions ? (
          <View style={styles.suggestions} accessibilityLabel={t('location:search.suggestions')}>
            {places.isError ? (
              <AppText variant="caption" color="danger" style={styles.suggestionMessage}>
                {t('location:errors.search')}
              </AppText>
            ) : suggestions.length === 0 && (places.isFetching || places.isDebouncing) ? (
              <View style={styles.searching}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <AppText variant="caption" color="muted">
                  {t('location:search.searching')}
                </AppText>
              </View>
            ) : suggestions.length === 0 ? (
              <AppText variant="caption" color="muted" style={styles.suggestionMessage}>
                {t('location:search.noResults')}
              </AppText>
            ) : (
              suggestions.map((place, index) => {
                const area = [place.neighborhood, place.city].filter(Boolean).join(', ');
                return (
                  <Pressable
                    key={place.id}
                    accessibilityRole="button"
                    accessibilityLabel={[place.addressLine, area].filter(Boolean).join(', ')}
                    onPress={() => selectPlace(place)}
                    style={({ pressed }) => [styles.suggestion, index > 0 ? styles.suggestionDivider : null, pressed ? styles.pressed : null]}
                  >
                    <Icon name="map-marker-outline" size={20} color="muted" />
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {place.addressLine || area}
                      </AppText>
                      {place.addressLine && area ? (
                        <AppText variant="caption" color="muted" numberOfLines={1}>
                          {area}
                        </AppText>
                      ) : null}
                    </View>
                    <Icon name="arrow-top-left" size={18} color="muted" flipInRTL />
                  </Pressable>
                );
              })
            )}
          </View>
        ) : null}

        <Button
          label={locating ? t('location:currentLocation.locating') : t('location:currentLocation.action')}
          leftIcon="crosshairs-gps"
          variant="secondary"
          size="sm"
          loading={locating}
          onPress={() => void locateMe()}
        />

        {failure ? (
          <InlineAlert
            tone="warning"
            icon="map-marker-off-outline"
            title={t(`location:errors.${failure}.title`)}
            message={t(`location:errors.${failure}.message`)}
            actionLabel={locateError === 'permission_blocked' || locateError === 'services_disabled' ? t('location:openSettings') : undefined}
            onAction={() => void openLocationSettings()}
            onDismiss={() => setLocateError(null)}
          />
        ) : null}

        <View style={[styles.mapWrapper, { height: mapHeight }]}>
          <AppMap
            style={styles.map}
            initialRegion={initialRegion}
            region={focusRegion}
            draggablePin={value ? { coordinate: value.coordinates, onChange: movePin } : undefined}
            onPress={movePin}
            showZoomControls
            accessibilityLabel={t('location:map.label')}
          />
        </View>
        <View style={styles.hint}>
          <Icon name="gesture-tap" size={16} color="muted" />
          <AppText variant="caption" color="muted" style={styles.flex}>
            {t('location:map.hint')}
          </AppText>
        </View>

        {usedLastKnown ? <InlineAlert tone="info" message={t('location:currentLocation.usedLastKnown')} onDismiss={() => setUsedLastKnown(false)} /> : null}

        {resolving ? (
          <View style={styles.searching} accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <AppText variant="caption" color="muted">
              {t('location:resolving')}
            </AppText>
          </View>
        ) : null}
        {pendingReverse && reverse.isError ? <InlineAlert tone="warning" message={t('location:errors.reverseGeocode')} /> : null}

        {value ? (
          <View style={styles.fields}>
            <TextField
              label={t('location:fields.addressLine')}
              required
              value={value.addressLine}
              onChangeText={(addressLine) => updateField({ addressLine })}
              placeholder={t('location:fields.addressLinePlaceholder')}
              autoComplete="street-address"
              textContentType="fullStreetAddress"
            />
            <TextField
              label={t('location:fields.city')}
              required
              value={value.city}
              onChangeText={(city) => updateField({ city })}
              placeholder={t('location:fields.cityPlaceholder')}
              textContentType="addressCity"
            />
            {showDetailsField ? (
              <TextField
                label={t('location:fields.details')}
                optional
                value={value.details ?? ''}
                onChangeText={(details) => updateField({ details: details.length > 0 ? details : null })}
                placeholder={t('location:fields.detailsPlaceholder')}
                helperText={t('location:fields.detailsHelper')}
                leftIcon="door"
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </Field>
  );
}

const useStyles = makeStyles((t) => ({
  container: {
    gap: t.spacing.md,
  },
  flex: {
    flex: 1,
  },
  suggestions: {
    borderRadius: t.radii.md,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
    overflow: 'hidden',
    ...t.shadows.md,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 56,
    paddingHorizontal: t.spacing.md + 2,
    paddingVertical: t.spacing.sm,
  },
  suggestionDivider: {
    borderTopWidth: 1,
    borderTopColor: t.colors.border,
  },
  suggestionMessage: {
    padding: t.spacing.lg,
  },
  searching: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    padding: t.spacing.xs,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  mapWrapper: {
    borderRadius: t.radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  map: {
    flex: 1,
    borderRadius: 0,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    marginTop: -t.spacing.xs,
  },
  fields: {
    gap: t.spacing.md,
    marginTop: t.spacing.xs,
  },
}));
