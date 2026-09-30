import { describe, expect, it } from 'vitest';

import { createTestDeps } from '../../../../test/app.js';
import { newObjectId } from '../../../lib/ids.js';
import { publishToExplorers } from '../explorer-events.js';

describe('explorer refresh events are merged per professional', () => {
  const deps = createTestDeps({ env: { EXPLORER_EVENT_WINDOW_MS: '300' } });
  const requestIds = (userId: string) =>
    deps.realtime.eventsFor(userId).map((event) => (event.type === 'request.updated' ? event.requestId : event.type));

  it('sends the first event of a window at once and the rest as one event when it closes', async () => {
    const [busy, quiet] = [newObjectId().toHexString(), newObjectId().toHexString()];
    await publishToExplorers(deps, 'r1', [busy, quiet]);
    expect(requestIds(busy)).toEqual(['r1']);
    expect(requestIds(quiet)).toEqual(['r1']);

    // A burst for one professional: nothing more until the window closes, then only the latest.
    await publishToExplorers(deps, 'r2', [busy]);
    await publishToExplorers(deps, 'r3', [busy]);
    expect(requestIds(busy)).toEqual(['r1']);
    await deps.background.drain();
    expect(requestIds(busy)).toEqual(['r1', 'r3']);
    expect(requestIds(quiet)).toEqual(['r1']);

    // A new window opens once the previous one is over.
    await new Promise((resolve) => setTimeout(resolve, 350));
    await publishToExplorers(deps, 'r4', [busy]);
    expect(requestIds(busy)).toEqual(['r1', 'r3', 'r4']);
  });
});
