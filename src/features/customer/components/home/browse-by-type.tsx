import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { CategoryIcon, categoryGroupTone } from '@/components/categories';
import { AppText, Divider, Icon, ListItem, Sheet } from '@/components/ui';
import { useCategoryLookup } from '@/hooks';
import { useLocalizedText } from '@/i18n/hooks';
import { makeStyles, useTheme } from '@/theme';
import type { CategoryGroupId, CategoryId } from '@/types/domain';

export interface BrowseByTypeProps {
  onSelectCategory: (id: CategoryId) => void;
}

/** Horizontal category-group cards; each opens a sheet with that group's services. */
export function BrowseByType({ onSelectCategory }: BrowseByTypeProps) {
  const theme = useTheme();
  const styles = useStyles();
  const { t } = useTranslation(['customer', 'common']);
  const localize = useLocalizedText();
  const lookup = useCategoryLookup();
  const [openGroupId, setOpenGroupId] = useState<CategoryGroupId | null>(null);
  const openGroup = openGroupId ? lookup.getGroup(openGroupId) : undefined;
  const groupCategories = openGroupId ? lookup.getCategoriesByGroup(openGroupId) : [];

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={styles.scroller}
      >
        {lookup.groups.map((group) => {
          const tone = theme.colors.tones[categoryGroupTone(group.id)];
          const name = localize(group.name);
          const count = lookup.getCategoriesByGroup(group.id).length;
          return (
            <Pressable
              key={group.id}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${t('common:categoryPicker.servicesCount', { count })}`}
              onPress={() => setOpenGroupId(group.id)}
              testID={`home-group-${group.id}`}
              style={({ pressed }) => [styles.groupCard, pressed ? styles.pressed : null]}
            >
              <View style={[styles.groupIcon, { backgroundColor: tone.bg }]}>
                <Icon name={group.icon} size={24} color={tone.fg} />
              </View>
              <AppText variant="captionStrong" numberOfLines={2} style={styles.groupName}>
                {name}
              </AppText>
              <View style={styles.groupFooter}>
                <AppText variant="label" color="muted">
                  {t('common:categoryPicker.servicesCount', { count })}
                </AppText>
                <Icon name="chevron-right" size={16} color="muted" flipInRTL />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Sheet
        visible={openGroupId !== null}
        onClose={() => setOpenGroupId(null)}
        title={openGroup ? localize(openGroup.name) : undefined}
        subtitle={t('customer:home.browse.sheetSubtitle')}
        fullHeight
      >
        {groupCategories.map((category, index) => (
          <View key={category.id}>
            {index > 0 ? <Divider inset={56} /> : null}
            <ListItem
              leading={<CategoryIcon categoryId={category.id} size="md" />}
              title={localize(category.name)}
              subtitle={category.description ? localize(category.description) : undefined}
              onPress={() => {
                setOpenGroupId(null);
                onSelectCategory(category.id);
              }}
              testID={`group-category-${category.id}`}
            />
          </View>
        ))}
      </Sheet>
    </>
  );
}

const useStyles = makeStyles((t) => ({
  scroller: {
    marginHorizontal: -t.spacing.screen,
  },
  row: {
    gap: t.spacing.md,
    paddingHorizontal: t.spacing.screen,
    paddingBottom: t.spacing.xs,
  },
  groupCard: {
    width: 148,
    padding: t.spacing.md,
    gap: t.spacing.sm,
    borderRadius: t.radii.lg,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  pressed: {
    backgroundColor: t.colors.surfacePressed,
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: t.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupName: {
    minHeight: t.typography.captionStrong.lineHeight * 2,
  },
  groupFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
}));
