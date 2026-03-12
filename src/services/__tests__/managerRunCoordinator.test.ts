import { describe, expect, it } from 'vitest';
import { createManagerRunCoordinator } from '@/src/services/manager-gateway/runCoordinator';

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return {
    promise,
    resolve,
  };
}

function createAbortError(): Error & { name: string } {
  const error = new Error('Manager run aborted') as Error & { name: string };
  error.name = 'AbortError';
  return error;
}

async function waitForCondition(
  condition: () => boolean,
  timeoutMs = 1000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for coordinator condition.');
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

describe('manager run coordinator', () => {
  it('serializes same-session work while allowing other sessions to proceed', async () => {
    const coordinator = createManagerRunCoordinator();
    const firstGate = createDeferred();
    const order: string[] = [];

    const firstReservation = coordinator.reserve('session_a');
    const secondReservation = coordinator.reserve('session_a');
    const otherReservation = coordinator.reserve('session_b');

    expect(firstReservation.queued).toBe(false);
    expect(secondReservation.queued).toBe(true);
    expect(otherReservation.queued).toBe(false);

    const firstPromise = firstReservation.run(async () => {
      order.push('first:start');
      await firstGate.promise;
      order.push('first:end');
      return 'first';
    });
    const secondPromise = secondReservation.run(async () => {
      order.push('second:start');
      order.push('second:end');
      return 'second';
    });
    const otherPromise = otherReservation.run(async () => {
      order.push('other:start');
      order.push('other:end');
      return 'other';
    });

    await waitForCondition(() => order.includes('first:start') && order.includes('other:start'));
    expect(order).toContain('first:start');
    expect(order).toContain('other:start');
    expect(order).not.toContain('second:start');

    firstGate.resolve();
    await expect(Promise.all([firstPromise, secondPromise, otherPromise])).resolves.toEqual([
      'first',
      'second',
      'other',
    ]);
    expect(order.indexOf('second:start')).toBeGreaterThan(order.indexOf('first:end'));
    expect(coordinator.isSessionBusy('session_a')).toBe(false);
    expect(coordinator.isSessionBusy('session_b')).toBe(false);
  });

  it('keeps the session busy until the active run finishes even if a queued reservation is cancelled', async () => {
    const coordinator = createManagerRunCoordinator();
    const firstGate = createDeferred();

    const firstReservation = coordinator.reserve('session_a');
    const queuedReservation = coordinator.reserve('session_a');
    queuedReservation.cancel();

    expect(coordinator.isSessionBusy('session_a')).toBe(true);

    const firstPromise = firstReservation.run(async () => {
      await firstGate.promise;
      return 'done';
    });

    firstGate.resolve();
    await expect(firstPromise).resolves.toBe('done');
    expect(coordinator.isSessionBusy('session_a')).toBe(false);

    const nextReservation = coordinator.reserve('session_a');
    expect(nextReservation.queued).toBe(false);
    nextReservation.cancel();
  });

  it('cancels a queued reservation by run id before execution starts', async () => {
    const coordinator = createManagerRunCoordinator();
    const firstGate = createDeferred();

    const firstReservation = coordinator.reserve('session_a');
    firstReservation.bindRunId('run_1');
    const queuedReservation = coordinator.reserve('session_a');
    queuedReservation.bindRunId('run_2');

    const firstPromise = firstReservation.run(async () => {
      await firstGate.promise;
      return 'first';
    });
    const queuedPromise = queuedReservation.run(async () => 'queued');

    expect(coordinator.cancelRun('run_2')).toBe('cancelled');

    firstGate.resolve();
    await expect(firstPromise).resolves.toBe('first');
    await expect(queuedPromise).rejects.toThrow('cancelled');
    expect(coordinator.cancelRun('run_2')).toBe('not_found');
    expect(coordinator.isSessionBusy('session_a')).toBe(false);
  });

  it('aborts a started reservation by run id when an abort controller is bound', async () => {
    const coordinator = createManagerRunCoordinator();
    const started = createDeferred();
    const controller = new AbortController();

    const reservation = coordinator.reserve('session_a');
    reservation.bindRunId('run_1');
    reservation.bindAbortController(controller);

    const runPromise = reservation.run(async () => {
      started.resolve();

      await new Promise((_, reject) => {
        controller.signal.addEventListener(
          'abort',
          () => {
            reject(createAbortError());
          },
          { once: true },
        );
      });

      return 'done';
    });

    await started.promise;
    expect(coordinator.cancelRun('run_1')).toBe('aborting');
    expect(controller.signal.aborted).toBe(true);
    await expect(runPromise).rejects.toMatchObject({
      name: 'AbortError',
    });
    await waitForCondition(() => !coordinator.isSessionBusy('session_a'));
    expect(coordinator.cancelRun('run_1')).toBe('not_found');
  });
});
