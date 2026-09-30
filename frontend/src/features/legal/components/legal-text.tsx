import { useMemo } from 'react';
import { Text } from 'react-native';

import { AppText } from '@/components/ui';
import type { LayoutDirection } from '@/i18n/direction';
import { makeStyles } from '@/theme';
import { getTextDirection } from '@/utils/bidi';

import { parseLegalText } from '../legal-markup';

/** LEFT-TO-RIGHT MARK / RIGHT-TO-LEFT MARK: invisible, they set the direction of a paragraph. */
const DIRECTION_MARKS: Record<LayoutDirection, string> = { ltr: '‎', rtl: '‏' };

/**
 * The mark to put before a text of a `direction` document whose first word is in the other script
 * ("Professionals היא…"): without it the paragraph would run in that word's direction. `''` when
 * the text already starts in the document's direction.
 */
export function directionMark(text: string, direction: LayoutDirection): string {
  return !text || getTextDirection(text) === direction ? '' : DIRECTION_MARKS[direction];
}

interface LegalTextProps {
  /** Document text with its inline markup (`**bold**`, `[label](url)`). */
  text: string;
  /** The document's direction: every paragraph runs in it, whatever its first word. */
  direction: LayoutDirection;
  onOpenLink: (url: string) => void;
  color?: 'default' | 'secondary';
}

/** One paragraph, list item or definition of a legal document: bold runs and links inside the text. */
export function LegalText({ text, direction, onOpenLink, color }: LegalTextProps) {
  const styles = useStyles();
  const segments = useMemo(() => parseLegalText(text), [text]);
  const mark = directionMark(segments.map((segment) => segment.text).join(''), direction);

  return (
    <AppText variant="body" color={color}>
      {mark}
      {segments.map((segment, index) =>
        segment.kind === 'link' ? (
          <Text
            key={index}
            accessibilityRole="link"
            onPress={() => onOpenLink(segment.url)}
            style={[styles.link, segment.bold ? styles.bold : null]}
          >
            {segment.text}
          </Text>
        ) : segment.bold ? (
          <Text key={index} style={styles.bold}>
            {segment.text}
          </Text>
        ) : (
          segment.text
        ),
      )}
    </AppText>
  );
}

const useStyles = makeStyles((t) => ({
  bold: {
    fontFamily: t.typography.bodyStrong.fontFamily,
  },
  link: {
    color: t.colors.primary,
    textDecorationLine: 'underline',
  },
}));
