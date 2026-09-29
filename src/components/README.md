# Components

Shared, presentational building blocks. Everything is themed (`useTheme`/`makeStyles`), localized
(i18next), RTL-safe and accessible. Components never fetch domain data themselves, except the
category catalog (`useCategoryLookup`) and geocoding inside `LocationPicker`.

```ts
import { Button, Screen, useToast } from '@/components/ui';
import { CategoryPicker, CategoryPickerSheet } from '@/components/categories';
import { RequestCard, UrgencyBadge } from '@/components/requests';
import { OfferStatusBadge } from '@/components/offers';
import { ReviewCard } from '@/components/professionals';
import { JobCard } from '@/components/jobs';
import { LocationPicker } from '@/components/location';
import { AppMap } from '@/components/map';
import { FormTextField } from '@/components/forms';
```

## Root setup (once, in the root layout)

`DialogProvider` and `ToastProvider` must be mounted inside `SafeAreaProvider`, the theme provider,
React Query and i18n, and inside `OverlayHostProvider`:

```tsx
<AppThemeProvider scheme={scheme} isRTL={isRTL}>
  <OverlayHostProvider>
    <DialogProvider>
      <ToastProvider>{children}</ToastProvider>
    </DialogProvider>
  </OverlayHostProvider>
</AppThemeProvider>
```

While a `Sheet` is open, the toasts and the confirm dialog render inside it (`overlay-host.tsx`): a
sheet is a native Modal, so a dialog hosted at the root could not be presented on iOS and a toast
would sit under the sheet's backdrop. Tapping a toast that has an action (a push banner) closes the
sheet first, so the screen it opens is not hidden behind the sheet.

## Design language

Calm and minimal (see the tokens in `src/theme/tokens.ts`):

- **Surfaces.** Screens sit on `background` (white / near-black). Content groups are `Card`s: a
  soft `surface` fill, radius 16, **no border, no shadow**. Hairline `Divider`s only inside lists.
  Only sheets, dialogs, toasts (`surfaceElevated` + shadow) and the tab bar float.
- **Hierarchy through type and space.** Tab screens start with a large 28pt `ScreenHeader` title;
  sections use `SectionHeader` (17 semibold, no icon) and are 28–32pt apart
  (`theme.layout.sectionGap`).
- **Icons only where they carry meaning**: tab bar, category icons, the chevron of navigable rows,
  key actions. `Badge`, `ListItem`, `SwitchRow`, `StatTile`, `FormSection` and `SectionHeader` are
  text-only.
- **One primary action per screen**: a full-width `Button` (52pt, radius 14 – full-width buttons
  default to `size="lg"`), usually in the sticky `Screen` `footer`. Everything else is
  `secondary`, `outline` (only for "Continue with Google"), `ghost` (text) or `dangerGhost` (quiet
  destructive text).
- **Show less.** Domain cards show 3–4 facts and clamp descriptions to one line. Small pills sit at
  the end of a card's meta line, never next to the title (titles keep the full width), and only
  when they say something (urgency pills for emergency/urgent only).
- **Contrast.** `textMuted` meets 4.5:1 on `background` and `surface`. Anything with `onPrimary`
  content (filled buttons, selected tiles/chips, count bubbles, own chat bubbles) sits on
  `primaryFill`, not `primary`: in dark mode `primary` is a lighter blue for text and icons,
  `primaryFill` the deeper blue behind white labels. Filled danger buttons use `tones.danger.solid`.

## `ui/` – design system

| Component | Example |
|---|---|
| `AppText` | `<AppText variant="heading" color="secondary" numberOfLines={2}>{t('…')}</AppText>` (colors: `default`, `secondary`, `muted`, `inverse`, `onPrimary`, `primary`, any status tone, or a theme color). User-written text: `<AppText userContent>{request.description}</AppText>` aligns it by its own language |
| `Icon` | `<Icon name="chevron-right" flipInRTL color="muted" size={20} />` (unknown names from data fall back safely) |
| `Button` | `<Button label={t('common:actions.saveChanges')} onPress={save} loading={isPending} fullWidth />` variants `primary` (brand fill) · `secondary` (neutral fill) · `outline` (neutral outline on the background – third-party sign-in such as "Continue with Google") · `ghost` (brand text) · `dangerGhost` (red text) · `danger` (filled, destructive confirmations), sizes `sm` 36 · `md` 46 · `lg` 52 (default when `fullWidth`), optional `leftIcon` |
| `IconButton` | `<IconButton icon="plus" accessibilityLabel={t('…')} onPress={…} variant="surface" />` variants `plain` (default) · `surface` (soft fill) · `soft`/`filled` (tone) |
| `Card` | `<Card onPress={open} padding="lg" highlighted>{…}</Card>` – soft `surface` fill, no border or shadow (cards never float). Padding in `style` (e.g. `<Card padding="none" style={{ paddingHorizontal: 16 }}>`) always wins over the token |
| `Badge` | `<Badge label={t('common:verified')} tone="brand" size="sm" />` – small text-only pill on a soft tone background |
| `Chip` | `<Chip label="Urgent" selected={on} onPress={toggle} />` / `onRemove` adds a close button, `leading` a small glyph |
| `Avatar` | `<Avatar name={pro.displayName} uri={pro.avatarUrl} size="lg" verified />` |
| `BrandMark` | `<BrandMark size={44} />` – the logo mark (vector, from `assets/brand/logo-mark.svg`) in the logo blue `colors.brandMark`; pass `color={theme.colors.onPrimary}` on brand-colored backgrounds. Decorative (hidden from screen readers) |
| `Divider` | `<Divider inset={56} />` |
| `Screen` | `<Screen refreshing={isRefetching} onRefresh={refetch} footer={<Button … fullWidth />} edges={['top','bottom']}>…</Screen>` (`scroll={false}` for static layouts, `header` for fixed content) |
| `ScreenHeader` | `<ScreenHeader title={t('…')} actions={<IconButton icon="plus" … />} />` – large 28pt title and one optional trailing action |
| `SectionHeader` | `<SectionHeader title={t('…')} actionLabel={t('common:actions.seeAll')} onAction={…} />` – 17 semibold, no icon; the text action only when it does not duplicate a tab |
| `TextField` | `<TextField label={t('…')} required value={v} onChangeText={setV} error={err} helperText={…} maxLength={500} showCounter multiline leftIcon="magnify" clearable />` (`showCounter` appears only from 80% of `maxLength`) |
| `Field` | `<Field label={t('…')} error={err}>{customControl}</Field>` (label/helper/error layout; `labelAccessory` puts e.g. a "Forgot password?" link on the label row, where errors appearing below can't move it – also on `TextField`; `errorPosition="top"` shows the error right under the label for tall controls such as a long list) |
| `SegmentedControl` | `<SegmentedControl options={[{ value: 'active', label: t('…') }, { value: 'past', label: t('…'), count: 2 }]} value={tab} onChange={setTab} />` – compact (34pt) switch for 2–4 views; `count` shows a small unread bubble |
| `SwitchRow` | `<SwitchRow title={t('…')} description={t('…')} value={on} onValueChange={setOn} />` (text-only) |
| `AppSwitch` | `<AppSwitch value={on} onValueChange={setOn} accessibilityLabel={t('…')} />` (the only switch: themed on every platform, mirrored in RTL on web; never use RN `Switch` directly) |
| `EmptyState` | `<EmptyState title={t('…')} description={t('…')} actionLabel={t('…')} onAction={…} compact />` – quiet: optional small muted `icon`, short title, one line, a secondary CTA |
| `ErrorState` | `<ErrorState error={query.error} onRetry={query.refetch} />` (maps `ApiError.code` → `errors:codes.<CODE>`) |
| `useErrorToast` | `const showError = useErrorToast(); showError(error)` or `showError(error, { title: t('…fixFields') })` – danger toast with the error's title and explanation (for mutation failures) |
| `useErrorText` | `const { title, description } = useErrorText()(error)` – localized texts of an error, for inline alerts (a toast takes `message`, not `description`: use `useErrorToast`) |
| `Skeleton` | `<Skeleton width="60%" height={14} />`, `<SkeletonCard lines={2} />` |
| `QueryState` | `<QueryState query={q} loading={<SkeletonCard />} empty={(d) => d.items.length === 0} emptyState={<EmptyState … />}>{(data) => …}</QueryState>` (a spinner when no `loading` is given) |
| `ListItem` | `<ListItem title={t('…')} trailing={t('common:languages.he')} onPress={…} />` – text row with a light chevron when navigable (`destructive` for sign-out, `checked` for single-select lists). Group rows in a `<Card padding="none" style={{ paddingHorizontal: 16 }}>` with `<Divider />`s |
| `StatTile` | `<StatTile label={t('…')} value={3} onPress={…} />` – minimal tile: label and a large value on a soft surface, with a chevron when tappable (tiles share a row equally; pass `style={{ minWidth }}` in wrapping grids) |
| `InlineAlert` | `<InlineAlert tone="warning" title={t('…')} message={t('…')} actionLabel={t('…')} onAction={…} onDismiss={…} />` |
| `Sheet` | `<Sheet visible={open} onClose={close} title={t('…')} footer={<Button … />}>{…}</Sheet>` (`fullHeight` for searchable lists). It rises above the keyboard and shrinks when needed. Start anything that presents its own screen (image picker, camera) from `onClosed`, once the sheet is gone: iOS can't present it over a sheet being dismissed |
| `useConfirm` | `const confirm = useConfirm(); if (await confirm({ title, message, confirmLabel, destructive: true })) …` (buttons stack vertically when a label is too long for half the dialog, so natural labels like "Confirm appointment" are fine) |
| `useToast` | `const toast = useToast(); toast.show({ title, message, tone: 'success', icon, onPress, durationMs, id })` (top banner; also used as the simulated push notification) |
| `RatingStars` | `<RatingStars value={4.5} />` (five stars) / `<RatingStars value={4.8} count={32} variant="compact" />` → ★ 4.8 (32) |
| `RatingInput` | `<RatingInput value={rating} onChange={setRating} />` |
| `PriceText` | `<PriceText amount={offer.price} currency={offer.currency} variant="title" />` |
| `useNow` | `const now = useNow(60_000)` (re-renders every minute – for relative times such as "5 minutes ago") |

## Domain components

| Component | Example |
|---|---|
| `CategoryIcon` | `<CategoryIcon categoryId="plumbing" size="sm" />` (soft square tinted per catalog group) |
| `CategoryName` | `<CategoryName categoryId={request.categoryId} variant="subheading" />` |
| `CategoryChip` | `<CategoryChip categoryId={id} selected onPress={…} onRemove={…} size="sm" />` |
| `CategoryGrid` | `<CategoryGrid onSelect={(id) => router.push(routes.newRequest({ categoryId: id }))} limit={7} onShowAll={openPicker} />` – the catalog's popular categories, four per row |
| `CategoryPickerSheet` | `<CategoryPickerSheet mode="single" visible={open} onClose={close} value={categoryId} onChange={setCategoryId} />` · `mode="multiple"` with `maxSelected` and a "Done (n)" footer – search on top, then plain rows (icon + name; a check or checkbox) in one soft group per catalog group |
| `CategoryPicker` | The same picker inline, for a screen whose job is choosing services (the professional sign-up step): `<CategoryPicker mode="multiple" value={ids} onChange={setIds} maxSelected={10} />` |
| `UrgencyBadge` | `<UrgencyBadge level={request.urgency} size="sm" />` (text pill) |
| `RequestCard` | Compact list card. `<RequestCard variant="customer" request={r} hasNewOffers={…} appointmentAt={job?.scheduledStartAt} onPress={…} />` → category icon + name, one-line description, one status line in its tone ("3 offers to review", "Waiting for offers", "Booked · Tue 10:00", "In progress", "Draft", "Completed", "Cancelled"; `statusLine={{ label, tone }}` overrides it). `<RequestCard variant="professional" request={r} onPress={…} />` → category + urgency pill, one-line description, "2.4 km · 5 minutes ago", an "Offered" pill once the pro sent an offer. `<RequestCardSkeleton />` |
| `getRequestStatusLine` | `getRequestStatusLine(request)` → `{ kind, tone, count }` – the customer card's status line (pure, `request-status-line.ts`) |
| `PhotoStrip` / `PhotoViewer` | `<PhotoStrip photos={request.photos} />` (opens a full-screen pager) |
| `PreferredScheduleText` | `<PreferredScheduleText schedule={request.preferredSchedule} />` → "Sun, Sep 27 · Morning (8:00–12:00)" (older requests that still carry a preferred date) |
| `OfferStatusBadge` | `<OfferStatusBadge status={offer.status} size="sm" />` |
| `ReviewCard` | `<ReviewCard review={review} showCategory />` – avatar, name, stars · date · category, comment clamped to 3 lines with "Show more". `hideAuthor` drops avatar and name (the viewer's own review, a job's review) |
| `RatingSummary` | `<RatingSummary breakdown={breakdown} />` |
| `JobCard` | `<JobCard job={job} viewerRole={user.role} onPress={…} />` – category + status pill, counterpart, date/time (`showPrice` appends the price) · `<JobCardSkeleton />` (a completed job shows its completion time) |
| `useJobWhen` | `const { completed, text } = useJobWhen(job)` – the appointment, or "Completed today at 19:28" once done |
| `LocationPicker` | `<LocationPicker value={location} onChange={setLocation} error={errorText} required initialRegion={regionForRadius(center, 5)} />` (until an address is chosen the error shows under the label, next to the search field) |
| `AppMap` | The app's only map – use it anywhere a map is needed (see below) |

### `AppMap` – the map, everywhere

`AppMap` (`@/components/map`) is **the** reusable map: Leaflet with free OpenStreetMap tiles, the
same component on iOS, Android (in a `react-native-webview` WebView) and the web (in a sandboxed
`<iframe srcdoc>`). No API key, works in Expo Go (a development build needs `react-native-webview`,
so rebuild one made before it was added). Markers, circles, the pin, colors (theme tones), labels,
RTL and Reduce Motion come from props and the theme; never draw map content yourself.

Markers with circles (the job explorer):

```tsx
<AppMap
  style={{ height: 320 }}
  region={regionForRadius(area.center, area.radiusKm)}
  markers={jobs.map((job) => ({
    id: job.id,
    coordinate: job.location.coordinates,
    tone: URGENCY_META[job.urgency].tone, // any StatusTone; default 'brand'
    icon: category?.icon, // a catalog category icon (or an extra from leaflet/marker-icons.ts)
    label: categoryName, // shown under the marker while selected
    selected: job.id === selectedId,
    accessibilityLabel: …,
  }))}
  circles={[{ id: 'area', center: area.center, radiusKm: area.radiusKm, tone: 'brand' }]}
  onMarkerPress={setSelectedId}
  onPress={() => setSelectedId(null)} // an empty spot (never fired for marker/pin taps)
/>
```

A draggable pin (the location picker):

```tsx
<AppMap
  ref={mapRef} // a picked address: mapRef.current?.animateToRegion(regionForRadius(place.coordinates, 0.45))
  initialRegion={startRegion} // the chosen address, else the user's city
  draggablePin={value ? { coordinate: value.coordinates, onChange: movePin } : undefined}
  onPress={movePin} // tap to place
  showZoomControls
/>
```

A static preview (a card or list row – no gestures, taps or zoom buttons; touches reach the
screen behind, screen readers get one image with `accessibilityLabel`):

```tsx
<AppMap interactive={false} style={{ height: 140 }} initialRegion={regionForRadius(point, 1)} markers={[{ id: 'job', coordinate: point }]} accessibilityLabel={address} />
```

Overlays on top of the map (floating chips, a preview card): pass their measured sizes as
`controlInsets` (`top` / `bottom` / `start` / `end`, points; `start`/`end` flip in RTL). The
attribution (always visible – the tile licence requires it) and the zoom buttons move clear of
them, camera fitting (`initialRegion`, `region`, `animateToRegion`) centers in the uncovered part,
and a newly selected marker is panned out from under them:

```tsx
const [cardHeight, setCardHeight] = useState(0);
<AppMap controlInsets={{ top: chipBottom, bottom: spacing.lg + cardHeight }} … />
<View style={styles.card} onLayout={(event) => setCardHeight(event.nativeEvent.layout.height)}>…</View>
```

Move the camera on demand – even back to the region it already has (a "recenter" button) – with the
ref API (animated, instant with Reduce Motion); `onRegionChange` reports where the camera settled:

```tsx
const mapRef = useRef<AppMapHandle>(null);
<AppMap ref={mapRef} region={home} onRegionChange={setVisibleRegion} … />
<IconButton icon="crosshairs-gps" onPress={() => mapRef.current?.animateToRegion(home)} … />
```

Notes:
- Until the page is ready a skeleton covers the map; if it can't start, a localized "The map
  couldn't load" with **Try again** replaces it. Without network the map still works over a plain
  grid (only the tiles are missing).
- Marker glyphs are baked SVG paths (the page can't load the icon font): every catalog category
  icon plus `MAP_EXTRA_ICONS`; other names show a neutral glyph. After adding one, run
  `npm run generate:map-assets`.
- An interactive map inside a `ScrollView` keeps its drags: Android through `nestedScrollEnabled`;
  on iOS the map holds the scroll lock of the enclosing `Screen` / `Sheet`. A custom `ScrollView`
  around a map provides the lock itself (`useScrollLockHost` in `ui/scroll-lock.tsx`). There the
  mouse wheel (web) scrolls the page instead of zooming the map; a map that is the whole screen
  (the explorer) zooms with it.
- Tiles: the native page loads them itself; on the web the host fetches them for the sandboxed
  frame (which has no origin to send as `Referer`), so a custom tile server must allow CORS.
  Tapping the attribution opens the licence page in the browser – the map page never navigates.
- Internals: `app-map.tsx` (props + theme → page state) → `leaflet/` (the page document, its
  script, the JSON bridge and the WebView/iframe hosts). See docs/ARCHITECTURE.md → Maps.

## `forms/`

| Component | Example |
|---|---|
| `FormTextField` | `<FormTextField control={control} name="description" label={t('…')} multiline maxLength={1000} showCounter />` (translates `validation:*` messages) |
| `FormSection` | `<FormSection title={t('…')} optional variant="plain">{fields}</FormSection>` (filled card by default, no icon) |
| `TimeSlotPicker` | `<TimeSlotPicker value={time} onChange={setTime} startTime="07:00" endTime="21:00" />` – 30-minute slots, four per row (weekly hours editor) |
| `PriceInput` | `<PriceInput value={price} onChange={setPrice} currency="ILS" label={t('…')} error={err} />` |
| `useTranslatedError` | `const tr = useTranslatedError(); tr('validation:request.descriptionTooShort')` |

## Hooks & utilities provided alongside

- `useAppLanguage()`, `useLocalizedText()`, `useCategory(id)`, `useCategoryName(id)`, `useFormatters()` — `src/i18n/hooks.ts`
- `useCategoryLookup()` — `src/hooks/queries/use-category-catalog.ts`
- `usePlaceSearch(query)`, `useReverseGeocode(coords)` — `src/hooks/queries/use-geo.ts`
- `formatCurrency`, `formatDistanceKm`, `formatDate`, `formatDateLabel`, `formatDateTime`, `formatTime`, `formatRelative` — `src/utils/format.ts` (bound to the active language by `useFormatters()`). Relative words are capitalized by default (`Tomorrow at 14:00`); inside a sentence pass `{ casing: 'inline' }` (`format.dateTime(date, { casing: 'inline' })` → "Starts tomorrow at 14:00", `format.relative(date, now, { casing: 'inline' })` → "Started just now").
- Bidi — `src/utils/bidi.ts`: `isolateText(name)` for person/business names and quoted user text interpolated into a sentence (Latin names inside Hebrew and vice versa), `alignForText(text, theme.isRTL)` → `<AppText align=…>` for user-written blocks in custom layouts (chat messages, review comments; plain paragraphs use `<AppText userContent>`), `getTextDirection(text)`.
- `locateDevice()`, `openLocationSettings()` — `src/services/location`

## Testing components

Components that use the catalog need React Query (`renderWithProviders` provides it, with the
theme and safe areas). Reanimated, worklets and the map's WebView are already mocked for every test
in `jest.setup.ts` – do not mock them again per file: the official Reanimated mock lacks
`useReducedMotion`, which the map, skeletons and animated components call, and `jest.setup.ts` adds
it.

```ts
import { renderWithProviders } from '@/components/__test-utils__/render';
```

`jest.setup.ts` replaces `react-native-webview` with a View that exposes the WebView's props
(`__test-utils__/react-native-webview.mock.tsx`). Play the page's side of the bridge with
`__test-utils__/map-bridge.ts`:

```ts
const webView = getMapWebView(); // the WebView inside an AppMap (hidden from screen readers until ready)
await emitMapMessage(webView, { type: 'ready' }); // the page loaded: state and camera are sent
await emitMapMessage(webView, { type: 'markerPress', id: 'r1' }); // or mapPress / pinDragEnd { coordinate }
const state = injectedMapMessages().filter((message) => message.type === 'state').pop()?.state; // markers, circles, pin, insets…
```
