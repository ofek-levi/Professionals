# Components

Shared, presentational building blocks. Everything is themed (`useTheme`/`makeStyles`), localized
(i18next), RTL-safe and accessible. Components never fetch domain data themselves, except the
category catalog (`useCategoryCatalog`) and geocoding inside `LocationPicker`.

```ts
import { Button, Screen, useToast } from '@/components/ui';
import { CategoryPicker } from '@/components/categories';
import { RequestCard, UrgencyBadge } from '@/components/requests';
import { OfferStatusBadge } from '@/components/offers';
import { ProfessionalSummaryCard } from '@/components/professionals';
import { JobCard } from '@/components/jobs';
import { LocationPicker } from '@/components/location';
import { AppMap } from '@/components/map';
import { FormTextField } from '@/components/forms';
```

## Root setup (once, in the root layout)

`DialogProvider` and `ToastProvider` must be mounted inside `SafeAreaProvider`, the theme provider,
React Query and i18n:

```tsx
<AppThemeProvider scheme={scheme} isRTL={isRTL}>
  <DialogProvider>
    <ToastProvider>{children}</ToastProvider>
  </DialogProvider>
</AppThemeProvider>
```

## `ui/` – design system

| Component | Example |
|---|---|
| `AppText` | `<AppText variant="heading" color="secondary" numberOfLines={2}>{t('…')}</AppText>` (colors: `default`, `secondary`, `muted`, `inverse`, `onPrimary`, `primary`, any status tone, or a theme color). User-written text: `<AppText userContent>{request.description}</AppText>` aligns it by its own language |
| `Icon` | `<Icon name="chevron-right" flipInRTL color="muted" size={20} />` (unknown names from data fall back safely) |
| `Button` | `<Button label={t('common:actions.save')} onPress={save} loading={isPending} fullWidth />` variants `primary · secondary · outline · ghost · danger · success`, sizes `sm · md · lg`, `leftIcon`, `rightIcon`, `shape="pill"` |
| `IconButton` | `<IconButton icon="bell-outline" accessibilityLabel={t('…')} badgeCount={unread} onPress={…} variant="surface" />` |
| `Card` | `<Card onPress={open} variant="elevated" padding="lg" highlighted>{…}</Card>` (padding in `style`, e.g. `<Card padding="none" style={{ paddingHorizontal: 16 }}>`, always wins over the token) |
| `Badge` | `<Badge label={t('common:verified')} tone="brand" icon="check-decagram" size="sm" />` |
| `Chip` | `<Chip label="Urgent" selected={on} onPress={toggle} count={12} />` / `onRemove` adds a close button |
| `Avatar` | `<Avatar name={pro.displayName} uri={pro.avatarUrl} size="lg" verified />` |
| `Divider`, `Spacer` | `<Divider inset={56} />`, `<Spacer size="xl" />` |
| `Screen` | `<Screen refreshing={isRefetching} onRefresh={refetch} footer={<Button … fullWidth />} edges={['top','bottom']}>…</Screen>` (`scroll={false}` for static layouts, `header` for fixed content) |
| `ScreenHeader` | `<ScreenHeader eyebrow={greeting} title={t('…')} subtitle={…} actions={<IconButton … />} />` |
| `SectionHeader` | `<SectionHeader title={t('…')} actionLabel={t('common:actions.seeAll')} onAction={…} />` |
| `TextField` | `<TextField label={t('…')} required value={v} onChangeText={setV} error={err} helperText={…} maxLength={500} showCounter multiline leftIcon="magnify" clearable />` |
| `Field` | `<Field label={t('…')} error={err}>{customControl}</Field>` (label/helper/error layout) |
| `SegmentedControl` | `<SegmentedControl options={[{ value: 'list', label: t('…'), icon: 'view-list' }, …]} value={mode} onChange={setMode} />` |
| `Stepper` | `<Stepper steps={[t('…'), t('…'), t('…')]} current={step} />` |
| `SwitchRow` | `<SwitchRow icon="bell-outline" title={t('…')} description={t('…')} value={on} onValueChange={setOn} />` |
| `AppSwitch` | `<AppSwitch value={on} onValueChange={setOn} accessibilityLabel={t('…')} />` (the only switch: themed on every platform, mirrored in RTL on web; never use RN `Switch` directly) |
| `EmptyState` | `<EmptyState icon="clipboard-text-outline" title={t('…')} description={t('…')} actionLabel={t('…')} onAction={…} />` |
| `ErrorState` | `<ErrorState error={query.error} onRetry={query.refetch} />` (maps `ApiError.code` → `errors:codes.<CODE>`) |
| `useErrorToast` | `const showError = useErrorToast(); showError(error)` or `showError(error, { title: t('…fixFields') })` – danger toast with the error's title and explanation (for mutation failures) |
| `useErrorText` | `const { title, description } = useErrorText()(error)` – localized texts of an error, for inline alerts (a toast takes `message`, not `description`: use `useErrorToast`) |
| `LoadingState` | `<LoadingState />` |
| `Skeleton` | `<Skeleton width="60%" height={14} />`, `<SkeletonCard />`, `<SkeletonList count={4} variant="row" />` |
| `QueryState` | `<QueryState query={q} loading={<SkeletonList />} empty={(d) => d.items.length === 0} emptyState={<EmptyState … />}>{(data) => …}</QueryState>` |
| `ListItem` / `MenuRow` | `<MenuRow icon="translate" iconTone="brand" title={t('…')} trailing={t('common:languages.he')} onPress={…} />` (`destructive` for sign-out) |
| `KeyValueRow` | `<KeyValueRow icon="cash" label={t('…')} value={<PriceText amount={450} currency="ILS" />} />` |
| `StatTile` | `<StatTile icon="tag-outline" tone="brand" value={3} label={t('…')} onPress={…} />` (tiles share a row equally, three fit a phone; pass `style={{ minWidth }}` in wrapping grids) |
| `InlineAlert` / `Banner` | `<InlineAlert tone="warning" title={t('…')} message={t('…')} actionLabel={t('…')} onAction={…} onDismiss={…} />` |
| `Sheet` | `<Sheet visible={open} onClose={close} title={t('…')} footer={<Button … />}>{…}</Sheet>` (`fullHeight` for searchable lists) |
| `useConfirm` | `const confirm = useConfirm(); if (await confirm({ title, message, confirmLabel, destructive: true })) …` (buttons stack vertically when a label is too long for half the dialog, so natural labels like "Confirm appointment" are fine) |
| `useToast` | `const toast = useToast(); toast.show({ title, message, tone: 'success', icon, onPress, durationMs, id })` (top banner; also used as the simulated push notification) |
| `RatingStars` | `<RatingStars value={4.5} count={32} showValue />` / `variant="compact"` → ★ 4.8 (32) |
| `RatingInput` | `<RatingInput value={rating} onChange={setRating} />` |
| `PriceText` | `<PriceText amount={offer.price} currency={offer.currency} variant="title" />` |
| `TimeAgo` | `<TimeAgo date={request.createdAt} />` (refreshes itself) |
| `DistanceText` | `<DistanceText km={request.distanceKm} away />` |
| `useNow` | `const now = useNow(60_000)` (re-renders every minute – for countdowns) |
| `usePanGesture` | Responder-based drag helper returning View props (works on web without a gesture root) |

## Domain components

| Component | Example |
|---|---|
| `CategoryIcon` | `<CategoryIcon categoryId="plumbing" size="md" />` (tinted per catalog group) |
| `CategoryName` | `<CategoryName categoryId={request.categoryId} variant="subheading" />` |
| `CategoryChip` | `<CategoryChip categoryId={id} selected onPress={…} onRemove={…} size="sm" />` |
| `CategoryGrid` | `<CategoryGrid onSelect={(id) => router.push(routes.newRequest({ categoryId: id }))} limit={7} onShowAll={openPicker} />` |
| `CategoryPicker` | `<CategoryPicker mode="single" value={categoryId} onChange={setCategoryId} />` · `<CategoryPicker mode="multiple" value={ids} onChange={setIds} maxSelected={10} />` |
| `CategoryPickerSheet` | `<CategoryPickerSheet mode="multiple" visible={open} onClose={close} value={ids} onChange={setIds} />` |
| `UrgencyBadge` | `<UrgencyBadge level={request.urgency} size="sm" />` |
| `UrgencyPicker` | `<UrgencyPicker value={urgency} onChange={setUrgency} />` |
| `RequestStatusBadge` | `<RequestStatusBadge status={request.status} />` |
| `RequestCard` | `<RequestCard variant="customer" request={r} hasNewOffers={seen < r.latestOfferAt} onPress={…} />` · `<RequestCard variant="professional" request={r} onPress={…} />` · `<RequestCardSkeleton />` |
| `PhotoStrip` / `PhotoViewer` | `<PhotoStrip photos={request.photos} maxVisible={4} />` (opens a full-screen pager) |
| `PreferredScheduleText` | `<PreferredScheduleText schedule={request.preferredSchedule} format="full" />` |
| `OfferStatusBadge` | `<OfferStatusBadge status={offer.status} size="sm" />` |
| `ProfessionalSummaryCard` | `<ProfessionalSummaryCard professional={offer.professional} highlightCategoryIds={[request.categoryId]} distanceKm={offer.distanceKm} footer={…} onPress={…} />` |
| `ReviewCard` | `<ReviewCard review={review} showCategory />` |
| `RatingSummary` | `<RatingSummary breakdown={breakdown} />` |
| `JobStatusBadge` | `<JobStatusBadge status={job.status} />` |
| `JobCard` | `<JobCard job={job} viewerRole={user.role} onPress={…} />` · `<JobCardSkeleton />` |
| `LocationPicker` | `<LocationPicker value={location} onChange={setLocation} error={errorText} initialRegion={regionForRadius(center, 5)} />` |
| `LocationSummary` | `<LocationSummary location={request.location} />` (shows the approximate indicator automatically) |
| `AppMap` | `<AppMap style={{ height: 320 }} markers={[{ id, coordinate, tone: 'danger', icon, label, selected }]} circles={[{ center, radiusKm: 15 }]} onMarkerPress={select} fitToMarkers />` |

`AppMap` uses `react-native-maps` on iOS/Android (`app-map.tsx`) and an interactive canvas on the web
(`app-map.web.tsx`: pan, zoom buttons, tap-to-place, draggable pin). Pass `region` to move the map
programmatically (it animates whenever the value changes). To move the camera on demand, even back
to the region it already has (a "recenter" button), use the ref API:

```tsx
const mapRef = useRef<AppMapHandle>(null);
<AppMap ref={mapRef} region={home} … />
<IconButton icon="crosshairs-gps" onPress={() => mapRef.current?.animateToRegion(home)} … />
```

## `forms/`

| Component | Example |
|---|---|
| `FormTextField` | `<FormTextField control={control} name="description" label={t('…')} multiline maxLength={1000} showCounter />` (translates `validation:*` messages) |
| `FormSection` | `<FormSection title={t('…')} description={t('…')} icon="calendar">{fields}</FormSection>` |
| `DateSlotPicker` | `<DateSlotPicker value={date} onChange={setDate} days={14} label={t('…')} />` |
| `TimeSlotPicker` | `<TimeSlotPicker value={time} onChange={setTime} date={date} startTime="07:00" endTime="21:00" />` |
| `DurationPicker` | `<DurationPicker value={minutes} onChange={setMinutes} optional label={t('…')} />` |
| `PriceInput` | `<PriceInput value={price} onChange={setPrice} currency="ILS" label={t('…')} error={err} />` |
| `PhotoPicker` | `<PhotoPicker value={photos} onChange={setPhotos} max={6} label={t('…')} />` (value: `PickedPhoto[]` = `UploadImagePayload[]`) |
| `useTranslatedError` | `const tr = useTranslatedError(); tr('validation:request.descriptionTooShort')` |

## Hooks & utilities provided alongside

- `useAppLanguage()`, `useLocalizedText()`, `useCategory(id)`, `useCategoryName(id)`, `useFormatters()` — `src/i18n/hooks.ts`
- `useCategoryCatalog()`, `useCategoryLookup()` — `src/hooks/queries/use-category-catalog.ts`
- `usePlaceSearch(query)`, `useReverseGeocode(coords)` — `src/hooks/queries/use-geo.ts`
- `formatCurrency`, `formatDistanceKm`, `formatDate`, `formatDateLabel`, `formatDateTime`, `formatTime`, `formatRelative`, `formatDuration`, `formatDayLabel` — `src/utils/format.ts`. Relative words are capitalized by default (`Tomorrow at 14:00`); inside a sentence pass `{ casing: 'inline' }` (`format.dateTime(date, { casing: 'inline' })` → "Starts tomorrow at 14:00", `format.relative(date, now, { casing: 'inline' })` → "Started just now").
- Bidi — `src/utils/bidi.ts`: `isolateText(name)` for person/business names and quoted user text interpolated into a sentence (Latin names inside Hebrew and vice versa; also re-exported from `utils/format`), `alignForText(text, theme.isRTL)` → `<AppText align=…>` for user-written blocks in custom layouts (chat messages, review comments; plain paragraphs use `<AppText userContent>`), `getTextDirection(text)`.
- `locateDevice()`, `getCurrentCoordinates()`, `requestLocationPermission()` — `src/services/location`

## Testing components

Components that use the catalog need React Query; some use Reanimated or maps. In Jest:

```ts
import { renderWithProviders } from '@/components/__test-utils__/render';
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-maps', () => require('@/components/map/react-native-maps.mock')); // AppMap / LocationPicker
```
