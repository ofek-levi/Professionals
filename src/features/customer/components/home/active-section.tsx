import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon } from '@/components/categories';
import { AppText, Card, Divider, Icon, SectionHeader, Skeleton } from '@/components/ui';
import type { StatusTone } from '@/constants/tones';
import { useCategoryName } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { CategoryId } from '@/types/domain';
import { isolateText } from '@/utils/bidi';

import type { HomeActiveRow } from '../../customer-home-model';
import { useRequestStatusText } from '../use-request-status-text';

/** Dividers start under the texts (icon 36 + gap 12). */
const ROW_DIVIDER_INSET = 48;

interface ActiveSectionProps {
  /** `undefined` while loading. */
  rows: HomeActiveRow[] | undefined;
  onOpenRow: (row: HomeActiveRow) => void;
}

/** The Home tab's one "Active" section: up to three compact rows of what needs the customer. */
export function ActiveSection({ rows, onOpenRow }: ActiveSectionProps) {
  const styles = useStyles();
  const { t } = useTranslation('customer');

  return (
    <View testID="home-active">
      <SectionHeader title={t('home.active.title')} />
      {rows === undefined ? (
        <Card padding="none" style={styles.group}>
          <RowSkeleton />
          <Divider inset={ROW_DIVIDER_INSET} />
          <RowSkeleton />
        </Card>
      ) : rows.length === 0 ? (
        <AppText variant="body" color="muted" testID="home-active-empty">
          {t('home.active.empty')}
        </AppText>
      ) : (
        <Card padding="none" style={styles.group}>
          {rows.map((row, index) => (
            <View key={row.kind === 'request' ? row.request.id : `review-${row.job.id}`}>
              {index > 0 ? <Divider inset={ROW_DIVIDER_INSET} /> : null}
              <ActiveRowItem row={row} onPress={() => onOpenRow(row)} />
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function ActiveRowItem({ row, onPress }: { row: HomeActiveRow; onPress: () => void }) {
  const { t } = useTranslation('customer');
  const statusText = useRequestStatusText();
  if (row.kind === 'review') {
    return (
      <RowView
        categoryId={row.job.categoryId}
        status={t('home.active.rate', { name: isolateText(row.job.professional.displayName) })}
        tone="warning"
        onPress={onPress}
        testID={`home-rate-${row.job.id}`}
      />
    );
  }
  const status = statusText(row.request, row.appointmentAt);
  return (
    <RowView
      categoryId={row.request.categoryId}
      status={status.label}
      tone={status.tone}
      onPress={onPress}
      testID={`home-request-${row.request.id}`}
    />
  );
}

interface RowViewProps {
  categoryId: CategoryId;
  status: string;
  tone: StatusTone;
  onPress: () => void;
  testID: string;
}

function RowView({ categoryId, status, tone, onPress, testID }: RowViewProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation('common');
  const name = useCategoryName(categoryId) || t('category.unknown');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${status}`}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
    >
      <CategoryIcon categoryId={categoryId} size="sm" />
      <View style={styles.texts}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="captionStrong" color={theme.colors.tones[tone].fg} numberOfLines={1}>
          {status}
        </AppText>
      </View>
      <Icon name="chevron-right" size={20} color="muted" flipInRTL />
    </Pressable>
  );
}

function RowSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Skeleton width={36} height={36} radius={11} />
      <View style={[styles.texts, styles.skeletonTexts]}>
        <Skeleton width="40%" height={14} />
        <Skeleton width="55%" height={11} />
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  group: {
    paddingHorizontal: t.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    minHeight: 68,
    paddingVertical: t.spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  texts: {
    flex: 1,
    gap: t.spacing.xxs,
  },
  skeletonTexts: {
    gap: t.spacing.sm,
  },
}));
