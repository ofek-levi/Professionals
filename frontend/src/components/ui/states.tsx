import type { ReactNode } from 'react';
import { ActivityIndicator, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import type { StatusTone } from '@/constants/tones';
import { toApiError } from '@/services/api/errors';
import type { ApiErrorCode } from '@/types/api';
import { makeStyles, useTheme } from '@/theme';

import { AppText } from './app-text';
import { Button } from './button';
import { Icon, type IconName, type IconSource } from './icon';
import { useToast } from './toast-provider';

// ─────────────────────────────── EmptyState ───────────────────────────────

interface EmptyStateProps {
  /** Small muted glyph above the title (optional – a one-line empty state needs none). */
  icon?: IconSource;
  title: string;
  description?: string;
  /** Tint of the glyph (defaults to muted text). */
  tone?: StatusTone;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: IconSource;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /** Tighter spacing for use inside cards/sections. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Quiet empty/zero state: an optional muted glyph, a short title, one line of help and a CTA. */
export function EmptyState({
  icon,
  title,
  description,
  tone,
  actionLabel,
  onAction,
  actionIcon,
  secondaryActionLabel,
  onSecondaryAction,
  compact = false,
  style,
  testID,
}: EmptyStateProps) {
  const theme = useTheme();
  const styles = useStyles();
  const glyphColor = tone ? theme.colors.tones[tone].fg : theme.colors.textMuted;

  return (
    <View style={[styles.state, compact ? styles.stateCompact : null, style]} testID={testID}>
      {icon ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon name={icon} size={compact ? 28 : 36} color={glyphColor} />
        </View>
      ) : null}
      <View style={styles.texts}>
        <AppText variant={compact ? 'bodyStrong' : 'subheading'} align="center" accessibilityRole="header">
          {title}
        </AppText>
        {description ? (
          <AppText variant={compact ? 'caption' : 'body'} color="secondary" align="center">
            {description}
          </AppText>
        ) : null}
      </View>
      {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (
        <View style={styles.actions}>
          {actionLabel && onAction ? (
            <Button label={actionLabel} onPress={onAction} leftIcon={actionIcon} variant="secondary" size="sm" />
          ) : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <Button label={secondaryActionLabel} onPress={onSecondaryAction} variant="ghost" size="sm" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ─────────────────────────────── ErrorState ───────────────────────────────

const ERROR_ICONS: Partial<Record<ApiErrorCode, IconName>> = {
  NETWORK_ERROR: 'wifi-off',
  TIMEOUT: 'timer-sand-complete',
  UNAUTHORIZED: 'account-lock-outline',
  FORBIDDEN: 'lock-alert-outline',
  NOT_FOUND: 'file-search-outline',
  RATE_LIMITED: 'speedometer-slow',
  SERVER_ERROR: 'server-network-off',
  OFFER_EXPIRED: 'clock-alert-outline',
  OUTSIDE_SERVICE_AREA: 'map-marker-off-outline',
};

/** Codes where retrying the same request cannot help. */
const NON_RETRYABLE: ReadonlySet<ApiErrorCode> = new Set(['NOT_FOUND', 'FORBIDDEN', 'UNAUTHORIZED']);

interface ErrorStateProps {
  /** Anything thrown (normalized with `toApiError`). */
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  /** Override the mapped description. */
  description?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Maps `ApiError.code` → `errors:codes.<CODE>` copy and a matching illustration. */
export function ErrorState({ error, onRetry, retrying = false, description, compact = false, style, testID }: ErrorStateProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['errors', 'common']);
  const errorText = useErrorText();
  const { code, title, description: mappedDescription } = errorText(error);
  const tone = theme.colors.tones[code === 'NETWORK_ERROR' || code === 'TIMEOUT' ? 'warning' : 'danger'];
  const canRetry = Boolean(onRetry) && !NON_RETRYABLE.has(code);

  return (
    <View style={[styles.state, compact ? styles.stateCompact : null, style]} testID={testID} accessibilityRole="alert">
      <Icon name={ERROR_ICONS[code] ?? 'alert-circle-outline'} size={compact ? 28 : 36} color={tone.fg} />
      <View style={styles.texts}>
        <AppText variant={compact ? 'bodyStrong' : 'subheading'} align="center" accessibilityRole="header">
          {title}
        </AppText>
        <AppText variant={compact ? 'caption' : 'body'} color="secondary" align="center">
          {description ?? mappedDescription}
        </AppText>
      </View>
      {canRetry ? (
        <Button
          label={t('common:actions.tryAgain')}
          variant="secondary"
          size="sm"
          loading={retrying}
          onPress={onRetry}
          style={styles.retry}
        />
      ) : null}
    </View>
  );
}

/** Up to this many seconds `Retry-After` is said in seconds, beyond in minutes. */
const RETRY_AFTER_SECONDS_LIMIT = 90;

/**
 * Localized `{ title, description }` for any thrown error – e.g. for inline error messages. A 429
 * with `Retry-After` says when to try again.
 */
export function useErrorText(): (error: unknown) => { code: ApiErrorCode; title: string; description: string } {
  const { t } = useTranslation('errors');
  return (error) => {
    const { code, retryAfterSeconds } = toApiError(error);
    const description =
      code === 'RATE_LIMITED' && retryAfterSeconds !== null
        ? retryAfterSeconds <= RETRY_AFTER_SECONDS_LIMIT
          ? t('retryAfter.seconds', { count: Math.max(1, retryAfterSeconds) })
          : t('retryAfter.minutes', { count: Math.ceil(retryAfterSeconds / 60) })
        : t(`codes.${code}.description`);
    return { code, title: t(`codes.${code}.title`), description };
  };
}

/**
 * Shows a danger toast for a failed action: the error's localized title plus its explanation
 * (what happened, what to do next). `title` replaces the heading, e.g. "Fix the highlighted fields"
 * when server field errors were mapped onto the form.
 */
export function useErrorToast(): (error: unknown, options?: { title?: string }) => string {
  const toast = useToast();
  const errorText = useErrorText();
  return (error, options = {}) => {
    const { title, description } = errorText(error);
    return toast.show({ title: options.title ?? title, message: description, tone: 'danger' });
  };
}

// ─────────────────────────────── LoadingState ───────────────────────────────

/** Default loading placeholder of `QueryState` (screens pass a skeleton instead). */
function LoadingState() {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  return (
    <View style={[styles.loading, styles.fill]} accessible accessibilityRole="progressbar" accessibilityLabel={t('states.loading')}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <AppText variant="caption" color="muted" align="center">
        {t('states.loading')}
      </AppText>
    </View>
  );
}

// ─────────────────────────────── QueryState ───────────────────────────────

/** The subset of a React Query result that `QueryState` needs (works with infinite queries too). */
interface QueryLike<TData> {
  data: TData | undefined;
  error: unknown;
  isPending: boolean;
  isError: boolean;
  isRefetching?: boolean;
  refetch: () => unknown;
}

interface QueryStateProps<TData> {
  query: QueryLike<TData>;
  /** Rendered with the loaded data. */
  children: (data: TData) => ReactNode;
  /** Loading placeholder, ideally a skeleton. Defaults to `<LoadingState />`. */
  loading?: ReactNode;
  /** `true` or a predicate marking the loaded data as empty. */
  empty?: boolean | ((data: TData) => boolean);
  /** Rendered instead of `children` when `empty` matches. */
  emptyState?: ReactNode;
  /** Custom error renderer. Defaults to `<ErrorState error onRetry={refetch} />`. */
  renderError?: (error: unknown, retry: () => void) => ReactNode;
  compactError?: boolean;
}

/**
 * Renders loading → error (with retry) → empty → success consistently for any query.
 * Data that is already loaded stays visible when a background refetch fails.
 *
 * Note: a disabled query (`skipToken`/`enabled: false`) stays pending; don't render it here.
 */
export function QueryState<TData>({ query, children, loading, empty, emptyState, renderError, compactError }: QueryStateProps<TData>) {
  if (query.data === undefined) {
    if (query.isError) {
      const retry = () => {
        void query.refetch();
      };
      return renderError ? (
        <>{renderError(query.error, retry)}</>
      ) : (
        <ErrorState error={query.error} onRetry={retry} retrying={query.isRefetching} compact={compactError} />
      );
    }
    return <>{loading ?? <LoadingState />}</>;
  }
  const isEmpty = typeof empty === 'function' ? empty(query.data) : Boolean(empty);
  if (isEmpty && emptyState) return <>{emptyState}</>;
  return <>{children(query.data)}</>;
}

const useStyles = makeStyles((t) => ({
  state: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.huge,
    paddingHorizontal: t.spacing.xxl,
  },
  stateCompact: {
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xxl,
    paddingHorizontal: t.spacing.lg,
  },
  texts: {
    gap: t.spacing.xs,
    maxWidth: 340,
    alignItems: 'center',
  },
  // Buttons align to the start by default; the retry button sits under the centered message.
  retry: {
    alignSelf: 'center',
    marginTop: t.spacing.xs,
  },
  actions: {
    alignItems: 'center',
    gap: t.spacing.xs,
    marginTop: t.spacing.xs,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.huge,
  },
  fill: {
    flex: 1,
  },
}));
