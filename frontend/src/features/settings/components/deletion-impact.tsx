/**
 * What deleting the account changes (`GET /me/deletion-impact`): the requests, offers and jobs it
 * cancels, with the first few of each, and what stays afterwards (shown as "Deleted user").
 */
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, Card, Icon, type IconName } from '@/components/ui';
import { useCategoryName, useFormatters } from '@/i18n/hooks';
import { routes } from '@/lib/routes';
import { makeStyles } from '@/theme';
import type { AccountDeletionImpact, DeletionImpactItem, DeletionImpactList } from '@/types/api';

interface ImpactGroup {
  /** Also the text: `settings:deleteAccount.<key>` with the count. */
  key: 'requests' | 'offersDeclined' | 'customerJobs' | 'drafts' | 'offersWithdrawn' | 'professionalJobs';
  icon: IconName;
  count: number;
  /** The first items (`count` may be larger). */
  list?: DeletionImpactList<string>;
}

/** The kinds of change that apply, in reading order. */
function impactGroups(impact: AccountDeletionImpact): ImpactGroup[] {
  const groups: ImpactGroup[] =
    impact.role === 'customer'
      ? [
          { key: 'requests', icon: 'cancel', count: impact.requestsToCancel.count, list: impact.requestsToCancel },
          { key: 'offersDeclined', icon: 'close-circle-outline', count: impact.offersToDecline },
          { key: 'customerJobs', icon: 'calendar-remove', count: impact.jobsToCancel.count, list: impact.jobsToCancel },
          { key: 'drafts', icon: 'file-remove-outline', count: impact.draftsToDelete },
        ]
      : [
          { key: 'offersWithdrawn', icon: 'undo-variant', count: impact.offersToWithdraw.count, list: impact.offersToWithdraw },
          { key: 'professionalJobs', icon: 'calendar-remove', count: impact.jobsToCancel.count, list: impact.jobsToCancel },
        ];
  return groups.filter((group) => group.count > 0);
}

/** "What happens now": one card per kind of change; "nothing in progress" when there is none. */
export function DeletionChanges({ impact }: { impact: AccountDeletionImpact }) {
  const styles = useStyles();
  const { t } = useTranslation('settings');
  const groups = impactGroups(impact);

  return (
    <View style={styles.section} testID="deletion-changes">
      <AppText variant="heading" accessibilityRole="header">
        {t('deleteAccount.changesTitle')}
      </AppText>
      {groups.length === 0 ? (
        <AppText variant="body" color="secondary" testID="deletion-nothing">
          {t('deleteAccount.nothingInProgress')}
        </AppText>
      ) : (
        <Card padding="none" style={styles.card}>
          {groups.map((group, index) => (
            <View key={group.key} style={[styles.group, index > 0 ? styles.divider : null]} testID={`deletion-${group.key}`}>
              <View style={styles.groupHeader}>
                <Icon name={group.icon} size={20} color="danger" />
                <AppText variant="bodyStrong" style={styles.flex}>
                  {t(`deleteAccount.${group.key}`, { count: group.count })}
                </AppText>
              </View>
              {group.list ? <ImpactItems list={group.list} /> : null}
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function ImpactItems({ list }: { list: DeletionImpactList<string> }) {
  const styles = useStyles();
  const { t } = useTranslation('settings');
  const more = list.count - list.items.length;
  return (
    <View style={styles.items}>
      {list.items.map((item) => (
        <ImpactItemRow key={item.id} item={item} />
      ))}
      {more > 0 ? (
        <AppText variant="caption" color="muted">
          {t('deleteAccount.more', { count: more })}
        </AppText>
      ) : null}
    </View>
  );
}

/** "Plumbing" · "Wed, 1 Oct · Avi Fix". */
function ImpactItemRow({ item }: { item: DeletionImpactItem<string> }) {
  const styles = useStyles();
  const { t } = useTranslation('common');
  const format = useFormatters();
  const categoryName = useCategoryName(item.categoryId) || t('category.unknown');
  const details = [format.date(item.date, 'short'), item.counterpartName].filter(Boolean).join(' · ');
  return (
    <View style={styles.item}>
      <AppText variant="body" numberOfLines={1}>
        {categoryName}
      </AppText>
      <AppText variant="caption" color="secondary" numberOfLines={1}>
        {details}
      </AppText>
    </View>
  );
}

/** "What stays" and the Privacy Policy that says it in full. */
export function DeletionKeeps({ role }: { role: AccountDeletionImpact['role'] }) {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useTranslation(['settings', 'legal']);
  const rows: { key: string; icon: IconName; text: string }[] = [
    {
      key: 'jobs',
      icon: 'history',
      text: role === 'customer' ? t('settings:deleteAccount.keepsJobsCustomer') : t('settings:deleteAccount.keepsJobsProfessional'),
    },
    ...(role === 'customer' ? [{ key: 'ratings', icon: 'star-outline' as const, text: t('settings:deleteAccount.keepsRatings') }] : []),
    { key: 'messages', icon: 'message-text-outline', text: t('settings:deleteAccount.keepsMessages') },
  ];

  return (
    <View style={styles.section} testID="deletion-keeps">
      <AppText variant="heading" accessibilityRole="header">
        {t('settings:deleteAccount.keepsTitle')}
      </AppText>
      <View style={styles.keeps}>
        {rows.map((row) => (
          <View key={row.key} style={styles.groupHeader}>
            <Icon name={row.icon} size={20} color="muted" />
            <AppText variant="body" color="secondary" style={styles.flex}>
              {row.text}
            </AppText>
          </View>
        ))}
      </View>
      <View style={styles.privacy}>
        <AppText variant="caption" color="muted">
          {t('settings:deleteAccount.privacyHint')}
        </AppText>
        <Pressable
          accessibilityRole="link"
          accessibilityHint={t('legal:openHint')}
          onPress={() => router.push(routes.legal('privacy'))}
          hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
          style={({ pressed }) => (pressed ? styles.pressed : null)}
          testID="delete-account-privacy"
        >
          <AppText variant="captionStrong" color="primary">
            {t('legal:documents.privacy')}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) => ({
  section: {
    gap: t.spacing.md,
  },
  card: {
    paddingHorizontal: t.spacing.lg,
  },
  group: {
    gap: t.spacing.sm,
    paddingVertical: t.spacing.md + 2,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.border,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.md,
  },
  flex: {
    flex: 1,
  },
  items: {
    gap: t.spacing.sm,
    // Under the text, past the icon.
    paddingStart: 20 + t.spacing.md,
  },
  item: {
    gap: t.spacing.xxs,
  },
  keeps: {
    gap: t.spacing.md,
  },
  privacy: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: t.spacing.xs,
  },
  pressed: {
    opacity: 0.7,
  },
}));
