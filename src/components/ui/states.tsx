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

export interface EmptyStateProps {
  icon: IconSource;
  title: string;
  description?: string;
  tone?: StatusTone;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: IconSource;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /** Smaller illustration and spacing for use inside cards/sections. */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Friendly empty/zero state: illustration icon in soft rings, title, description and a CTA. */
export function EmptyState({
  icon,
  title,
  description,
  tone = 'brand',
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
  const colors = theme.colors.tones[tone];
  const inner = compact ? 56 : 76;
  const outer = compact ? 80 : 112;

  return (
    <View style={[styles.state, compact ? styles.stateCompact : null, style]} testID={testID}>
      <View
        style={[styles.ring, { width: outer, height: outer, borderRadius: outer / 2, borderColor: colors.bg }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={[styles.circle, { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: colors.bg }]}>
          <Icon name={icon} size={compact ? 26 : 34} color={colors.fg} />
        </View>
      </View>
      <View style={styles.texts}>
        <AppText variant={compact ? 'subheading' : 'heading'} align="center" accessibilityRole="header">
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
            <Button label={actionLabel} onPress={onAction} leftIcon={actionIcon} size={compact ? 'sm' : 'md'} />
          ) : null}
          {secondaryActionLabel && onSecondaryAction ? (
            <Button label={secondaryActionLabel} onPress={onSecondaryAction} variant="ghost" size={compact ? 'sm' : 'md'} />
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

export interface ErrorStateProps {
  /** Anything thrown (normalized with `toApiError`). */
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  /** Override the mapped title/description. */
  title?: string;
  description?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Maps `ApiError.code` → `errors:codes.<CODE>` copy and a matching illustration. */
export function ErrorState({ error, onRetry, retrying = false, title, description, compact = false, style, testID }: ErrorStateProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['errors', 'common']);
  const code = toApiError(error).code;
  const tone = theme.colors.tones[code === 'NETWORK_ERROR' || code === 'TIMEOUT' ? 'warning' : 'danger'];
  const size = compact ? 56 : 76;
  const canRetry = Boolean(onRetry) && !NON_RETRYABLE.has(code);

  return (
    <View style={[styles.state, compact ? styles.stateCompact : null, style]} testID={testID} accessibilityRole="alert">
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone.bg }]}>
        <Icon name={ERROR_ICONS[code] ?? 'alert-circle-outline'} size={compact ? 26 : 34} color={tone.fg} />
      </View>
      <View style={styles.texts}>
        <AppText variant={compact ? 'subheading' : 'heading'} align="center" accessibilityRole="header">
          {title ?? t(`errors:codes.${code}.title`)}
        </AppText>
        <AppText variant={compact ? 'caption' : 'body'} color="secondary" align="center">
          {description ?? t(`errors:codes.${code}.description`)}
        </AppText>
      </View>
      {canRetry ? (
        <Button
          label={t('common:actions.tryAgain')}
          leftIcon="refresh"
          variant="secondary"
          size={compact ? 'sm' : 'md'}
          loading={retrying}
          onPress={onRetry}
          style={styles.retry}
        />
      ) : null}
    </View>
  );
}

/** Localized `{ title, description }` for any thrown error – e.g. for inline error messages. */
export function useErrorText(): (error: unknown) => { code: ApiErrorCode; title: string; description: string } {
  const { t } = useTranslation('errors');
  return (error) => {
    const code = toApiError(error).code;
    return { code, title: t(`codes.${code}.title`), description: t(`codes.${code}.description`) };
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

export interface LoadingStateProps {
  label?: string;
  /** Centers in the available space (default) – set `false` for inline use. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function LoadingState({ label, fill = true, style }: LoadingStateProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  return (
    <View
      style={[styles.loading, fill ? styles.fill : null, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? t('states.loading')}
    >
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <AppText variant="caption" color="muted" align="center">
        {label ?? t('states.loading')}
      </AppText>
    </View>
  );
}

// ─────────────────────────────── QueryState ───────────────────────────────

/** The subset of a React Query result that `QueryState` needs (works with infinite queries too). */
export interface QueryLike<TData> {
  data: TData | undefined;
  error: unknown;
  isPending: boolean;
  isError: boolean;
  isRefetching?: boolean;
  refetch: () => unknown;
}

export interface QueryStateProps<TData> {
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
    gap: t.spacing.lg,
    paddingVertical: t.spacing.huge,
    paddingHorizontal: t.spacing.xxl,
  },
  stateCompact: {
    gap: t.spacing.md,
    paddingVertical: t.spacing.xxl,
    paddingHorizontal: t.spacing.lg,
  },
  ring: {
    borderWidth: 12,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 1,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    gap: t.spacing.xs + 2,
    maxWidth: 360,
    alignItems: 'center',
  },
  // Buttons align to the start by default; the retry button sits under the centered message.
  retry: {
    alignSelf: 'center',
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
