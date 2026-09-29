/**
 * Fire-and-forget work that must not delay the response (push delivery to Expo). Failures are
 * logged; `drain()` waits for everything in flight (graceful shutdown, tests).
 */
import type { Logger } from './logger.js';

export class BackgroundTasks {
  private readonly running = new Set<Promise<void>>();

  constructor(private readonly logger: Logger) {}

  run(label: string, task: () => Promise<void>): void {
    const promise = task()
      .catch((error: unknown) => {
        this.logger.error({ err: error, task: label }, 'background task failed');
      })
      .finally(() => this.running.delete(promise));
    this.running.add(promise);
  }

  async drain(): Promise<void> {
    while (this.running.size > 0) await Promise.allSettled([...this.running]);
  }

  get size(): number {
    return this.running.size;
  }
}
