/**
 * Hebrew resources must provide exactly the same keys as English, plus the Hebrew dual plural
 * form: every `<key>_other` in English requires a `<key>_two` in Hebrew (Intl.PluralRules('he')
 * yields one/two/other and i18next does not fall back from `_two` to `_other`).
 *
 * Declaring a Hebrew namespace as `LocaleNamespace<typeof enNamespace>` makes TypeScript report
 * missing or extra keys.
 */
type HebrewDualKeys<T> = {
  [K in keyof T as K extends `${infer Base}_other` ? `${Base}_two` : never]: string;
};

export type LocaleNamespace<T> = {
  [K in keyof T]: T[K] extends string ? string : LocaleNamespace<T[K]>;
} & HebrewDualKeys<T>;
