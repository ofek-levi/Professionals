/** Tiny helpers shared by the request / offer / job state machines. */
import { DomainError } from './domain-error';

/** Allowed target states for every state. Terminal states map to an empty list. */
export type TransitionTable<S extends string> = Readonly<Record<S, readonly S[]>>;

export function canTransition<S extends string>(table: TransitionTable<S>, from: S, to: S): boolean {
  return table[from]?.includes(to) ?? false;
}

/** Throws `INVALID_STATE_TRANSITION` (409) when `from → to` is not allowed. */
export function assertTransition<S extends string>(table: TransitionTable<S>, entity: string, from: S, to: S): void {
  if (!canTransition(table, from, to)) throw DomainError.invalidTransition(entity, from, to);
}

/** States without outgoing transitions. */
export function terminalStates<S extends string>(table: TransitionTable<S>): S[] {
  return (Object.keys(table) as S[]).filter((state) => table[state].length === 0);
}
