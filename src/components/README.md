# Components

Shared, presentational building blocks. Everything is themed (`useTheme`/`makeStyles`), localized
(i18next), RTL-safe and accessible. Components never fetch domain data themselves, except the
category catalog (`useCategoryLookup`) and geocoding inside `LocationPicker`.

```ts
import { Button, Screen, useToast } from '@/components/ui';
import { CategoryPickerSheet } from '@/components/categories';
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
React Query and i18n:

```tsx
<AppThemeProvider scheme={scheme} isRTL={isRTL}>
  <DialogProvider>
    <ToastProvider>{children}</ToastProvider>
  </DialogProvider>
</AppThemeProvider>
```

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
  `secondary`, `ghost` (text) or `dangerGhost` (quiet destructive text).
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
| `Button` | `<Button label={t('common:actions.saveChanges')} onPress={save} loading={isPending} fullWidth />` variants `primary` (brand fill) · `secondary` (neutral fill) · `ghost` (brand text) · `dangerGhost` (red text) · `danger` (filled, destructive confirmations), sizes `sm` 36 · `md` 46 · `lg` 52 (default when `fullWidth`), optional `leftIcon` |
| `IconButton` | `<IconButton icon="plus" accessibilityLabel={t('…')} onPress={…} variant="surface" />` variants `plain` (default) · `surface` (soft fill) · `soft`/`filled` (tone) |
| `Card` | `<Card onPress={open} padding="lg" highlighted>{…}</Card>` – soft `surface` fill, no border or shadow (cards never float). Padding in `style` (e.g. `<Card padding="none" style={{ paddingHorizontal: 16 }}>`) always wins over the token |
| `Badge` | `<Badge label={t('common:verified')} tone="brand" size="sm" />` – small text-only pill on a soft tone background |
| `Chip` | `<Chip label="Urgent" selected={on} onPress={toggle} />` / `onRemove` adds a close button, `leading` a small glyph |
| `Avatar` | `<Avatar name={pro.displayName} uri={pro.avatarUrl} size="lg" verified />` |
| `Divider` | `<Divider inset={56} />` |
| `Screen` | `<Screen refreshing={isRefetching} onRefresh={refetch} footer={<Button … fullWidth />} edges={['top','bottom']}>…</Screen>` (`scroll={false}` for static layouts, `header` for fixed content) |
| `ScreenHeader` | `<ScreenHeader title={t('…')} actions={<IconButton icon="plus" … />} />` – large 28pt title and one optional trailing action |
| `SectionHeader` | `<SectionHeader title={t('…')} actionLabel={t('common:actions.seeAll')} onAction={…} />` – 17 semibold, no icon; the text action only when it does not duplicate a tab |
| `TextField` | `<TextField label={t('…')} required value={v} onChangeText={setV} error={err} helperText={…} maxLength={500} showCounter multiline leftIcon="magnify" clearable />` (`showCounter` appears only from 80% of `maxLength`) |
| `Field` | `<Field label={t('…')} error={err}>{customControl}</Field>` (label/helper/error layout) |
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
| `Sheet` | `<Sheet visible={open} onClose={close} title={t('…')} footer={<Button … />}>{…}</Sheet>` (`fullHeight` for searchable lists) |
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
| `LocationPicker` | `<LocationPicker value={location} onChange={setLocation} error={errorText} initialRegion={regionForRadius(center, 5)} />` |
| `AppMap` | `<AppMap style={{ height: 320 }} markers={[{ id, coordinate, tone: 'danger', icon, label, selected }]} circles={[{ center, radiusKm: 15 }]} onMarkerPress={select} />` (web: `showPreviewBadge={false}` while a card covers the bottom) |

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

Components that use the catalog need React Query; some use Reanimated or maps. In Jest:

```ts
import { renderWithProviders } from '@/components/__test-utils__/render';
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-maps', () => require('@/components/map/react-native-maps.mock')); // AppMap / LocationPicker
```
