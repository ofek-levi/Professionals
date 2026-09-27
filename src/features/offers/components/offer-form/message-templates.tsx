/** Quick template chips that append localized sentences to the offer message. */
import { ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui';
import { makeStyles } from '@/theme';

export const MESSAGE_TEMPLATES = ['intro', 'arrival', 'included', 'warranty', 'questions'] as const;
export type MessageTemplate = (typeof MESSAGE_TEMPLATES)[number];

const TEMPLATE_ICONS: Record<MessageTemplate, string> = {
  intro: 'hand-wave-outline',
  arrival: 'clock-check-outline',
  included: 'package-variant-closed-check',
  warranty: 'shield-check-outline',
  questions: 'camera-outline',
};

export interface MessageTemplatesProps {
  name: string;
  onInsert: (text: string) => void;
}

export function MessageTemplates({ name, onInsert }: MessageTemplatesProps) {
  const styles = useStyles();
  const { t } = useTranslation('offers');
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} keyboardShouldPersistTaps="handled">
      {MESSAGE_TEMPLATES.map((template) => (
        <Chip
          key={template}
          size="sm"
          icon={TEMPLATE_ICONS[template]}
          label={t(`form.templates.${template}.label`)}
          accessibilityLabel={t('form.templates.insertA11y', { label: t(`form.templates.${template}.label`) })}
          onPress={() => onInsert(t(`form.templates.${template}.text`, { name }))}
          testID={`offer-template-${template}`}
        />
      ))}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) => ({
  row: {
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xxs,
  },
}));
