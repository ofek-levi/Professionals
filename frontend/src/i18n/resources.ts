import { en } from './locales/en';
import { he } from './locales/he';

export const resources = { en, he } as const;

export const defaultNS = 'common';

type AppNamespace = keyof typeof en;
export const NAMESPACES = Object.keys(en) as AppNamespace[];
