import { KavikError } from './errors';
import type { BulkJob, KavikResponse, PollOptions } from './types';

/**
 * Poll a bulk job until it reaches a terminal state (completed or failed).
 * @internal Used by Kavik.waitForBulkJob
 */
export async function pollBulkJob(
  getter: (id: string) => Promise<KavikResponse<BulkJob>>,
  jobId: string,
  options: PollOptions = {},
): Promise<KavikResponse<BulkJob>> {
  const interval = options.interval ?? 5000;
  const timeout = options.timeout ?? 600_000;
  const signal = options.signal;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (signal?.aborted) {
      throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
    }

    const result = await getter(jobId);

    if (options.onProgress) {
      options.onProgress(result.data);
    }

    if (result.data.status === 'completed' || result.data.status === 'failed') {
      return result;
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, interval);
      if (signal) {
        const onAbort = () => {
          clearTimeout(timer);
          reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
        };
        if (signal.aborted) {
          clearTimeout(timer);
          reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
        // Clean up listener if timer fires first
        const origResolve = resolve;
        resolve = () => {
          signal.removeEventListener('abort', onAbort);
          origResolve();
        };
      }
    });
  }

  throw new KavikError(
    `Bulk job ${jobId} did not complete within ${timeout}ms`,
    'INTERNAL_ERROR',
    0,
  );
}
