import { useTranslation } from 'react-i18next';

type LooseTranslate = (key: string, options?: Record<string, unknown>) => string;

const I18N_KEY_PATTERN = /^[a-z]+:[\w.-]+$/i;

/**
 * Returns a translator for form error messages. Zod schemas use i18n keys as messages
 * (`'validation:request.descriptionTooShort'`); anything that is not an existing key is shown as-is.
 */
export function useTranslatedError(): (message: string | null | undefined) => string | undefined {
  const { i18n } = useTranslation();
  // Keys are only known at runtime here, so we use i18next's untyped call signature.
  const translate = i18n.t.bind(i18n) as unknown as LooseTranslate;
  return (message) => {
    if (!message) return undefined;
    if (I18N_KEY_PATTERN.test(message) && i18n.exists(message)) return translate(message);
    return message;
  };
}
