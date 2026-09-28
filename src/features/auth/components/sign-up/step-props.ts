import type { Control } from 'react-hook-form';
import type { LayoutChangeEvent } from 'react-native';

import type { SignUpField, SignUpFormValues } from '@/lib/validation/auth';

/** What every sign-up step receives from the flow. */
export interface SignUpStepProps {
  control: Control<SignUpFormValues>;
  /** Remembers where a field sits in the scroll content (to scroll to its error). */
  anchor: (field: SignUpField) => (event: LayoutChangeEvent) => void;
}
