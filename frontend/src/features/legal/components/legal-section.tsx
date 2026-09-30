import { View } from 'react-native';

import { AppText } from '@/components/ui';
import type { LayoutDirection } from '@/i18n/direction';
import { makeStyles } from '@/theme';
import type { LegalBlock, LegalSection } from '@/types/api/legal';

import { directionMark, LegalText } from './legal-text';

interface LegalContentProps {
  direction: LayoutDirection;
  onOpenLink: (url: string) => void;
}

/** A section of a legal document: its heading, then paragraphs, bullet lists and definitions. */
export function LegalSectionView({ section, ...content }: LegalContentProps & { section: LegalSection }) {
  const styles = useStyles();
  return (
    <View style={styles.section} testID={`legal-section-${section.id}`}>
      <AppText variant="heading" accessibilityRole="header">
        {directionMark(section.heading, content.direction)}
        {section.heading}
      </AppText>
      {section.blocks.map((block, index) => (
        <LegalBlockView key={index} block={block} {...content} />
      ))}
    </View>
  );
}

function LegalBlockView({ block, ...content }: LegalContentProps & { block: LegalBlock }) {
  const styles = useStyles();
  switch (block.type) {
    case 'paragraph':
      return <LegalText text={block.text} {...content} />;
    case 'list':
      return (
        <View role="list" style={styles.list}>
          {block.items.map((item, index) => (
            <View key={index} role="listitem" style={styles.listItem}>
              <AppText variant="body" color="muted" importantForAccessibility="no" accessibilityElementsHidden>
                •
              </AppText>
              <View style={styles.flex}>
                <LegalText text={item} {...content} />
              </View>
            </View>
          ))}
        </View>
      );
    case 'definitions':
      return (
        <View style={styles.list}>
          {block.items.map((item, index) => (
            <View key={index} style={styles.definition}>
              <AppText variant="bodyStrong">
                {directionMark(item.term, content.direction)}
                {item.term}
              </AppText>
              <LegalText text={item.text} color="secondary" {...content} />
            </View>
          ))}
        </View>
      );
  }
}

const useStyles = makeStyles((t) => ({
  section: {
    gap: t.spacing.md,
  },
  list: {
    gap: t.spacing.sm,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: t.spacing.sm,
    paddingStart: t.spacing.xs,
  },
  flex: {
    flex: 1,
  },
  definition: {
    gap: t.spacing.xxs,
  },
}));
