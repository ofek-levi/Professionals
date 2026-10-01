/**
 * The operator of the service and the dates of the legal documents (Terms of Use, Privacy Policy,
 * account deletion page): the one file to fill in before launch. Staging/production refuse to start
 * while an operator field is empty (`assertLegalConfigured`); development shows placeholders.
 */
export const LEGAL_CONFIG = {
  operator: {
    /** Legal name as registered (company or individual), shown in both languages. */
    name: { en: '', he: '' },
    /**
     * Optional registration number and what it is, shown after the name: "(Company No. 51-…)" /
     * "(ח.פ. 51-…)". The label says the legal form (e.g. Company No. / ח.פ., Licensed Dealer No. /
     * ע.מ., Exempt Dealer No. / ע.פ., Non-profit No. / ע״ר); it is required with a number. An empty
     * number hides both.
     */
    registration: { label: { en: '', he: '' }, number: '' },
    /** Postal address for legal notices. */
    address: { en: '', he: '' },
    /** Privacy, legal and support requests (published in the documents). */
    email: '',
  },
  /** Date the current versions take effect (ISO yyyy-mm-dd); also the version recorded when a user accepts them. */
  effectiveDate: '2026-09-30',
  /** Retention the operator commits to (must match the hosting setup: OPERATIONS.md). */
  retention: { serverLogsDays: 30, backupsDays: 30 },
} as const;
