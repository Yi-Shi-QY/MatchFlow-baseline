import type { ManagerGatewayRunCoordinator } from './types';

interface RunQueueEntry {
  sessionId: string;
  runId: string | null;
  abortController: AbortController | null;
  previous: Promise<void>;
  tail: Promise<void>;
  releaseCurrent: () => void;
  consumed: boolean;
  released: boolean;
  cancelled: boolean;
  started: boolean;
}

interface SessionQueueState {
  tail: Promise<void>;
  entries: RunQueueEntry[];
}

export function createManagerRunCoordinator(): ManagerGatewayRunCoordinator {
  const sessionStates = new Map<string, SessionQueueState>();
  const runIndex = new Map<string, RunQueueEntry>();

  function removeEntry(entry: RunQueueEntry): void {
    const state = sessionStates.get(entry.sessionId);
    if (!state) {
      return;
    }

    const nextEntries = state.entries.filter((candidate) => candidate !== entry);
    if (nextEntries.length === 0) {
      sessionStates.delete(entry.sessionId);
      return;
    }

    sessionStates.set(entry.sessionId, {
      tail: nextEntries[nextEntries.length - 1].tail,
      entries: nextEntries,
    });
  }

  function releaseEntry(entry: RunQueueEntry): void {
    if (entry.released) {
      return;
    }

    entry.released = true;
    entry.releaseCurrent();
    if (entry.runId) {
      runIndex.delete(entry.runId);
    }
    removeEntry(entry);
  }

  function cancelEntry(entry: RunQueueEntry): boolean {
    if (entry.started) {
      return false;
    }

    entry.cancelled = true;
    releaseEntry(entry);
    return true;
  }

  function requestAbort(entry: RunQueueEntry): boolean {
    if (!entry.started || entry.released) {
      return false;
    }

    if (!entry.abortController) {
      return false;
    }

    if (!entry.abortController.signal.aborted) {
      entry.abortController.abort();
    }

    return true;
  }

  function reserve(sessionId: string) {
    const previousState = sessionStates.get(sessionId);
    const queued = Boolean(previousState);
    const previous = previousState?.tail || Promise.resolve();
    let releaseCurrent!: () => void;
    const current = new Promise<void>((resolve) => {
      releaseCurrent = resolve;
    });
    const tail = previous
      .catch(() => undefined)
      .then(() => current);

    const entry: RunQueueEntry = {
      sessionId,
      runId: null,
      abortController: null,
      previous,
      tail,
      releaseCurrent,
      consumed: false,
      released: false,
      cancelled: false,
      started: false,
    };

    sessionStates.set(sessionId, {
      tail,
      entries: [...(previousState?.entries || []), entry],
    });

    return {
      queued,
      bindRunId(runId: string): void {
        entry.runId = runId;
        runIndex.set(runId, entry);
      },
      bindAbortController(controller: AbortController): void {
        entry.abortController = controller;
      },
      async run<T>(task: () => Promise<T>): Promise<T> {
        if (entry.consumed) {
          throw new Error(`Run reservation for session "${sessionId}" has already been consumed.`);
        }

        entry.consumed = true;
        await entry.previous.catch(() => undefined);

        if (entry.cancelled) {
          throw new Error(`Run reservation for session "${sessionId}" was cancelled.`);
        }

        entry.started = true;
        try {
          return await task();
        } finally {
          releaseEntry(entry);
        }
      },
      cancel(): boolean {
        return cancelEntry(entry);
      },
    };
  }

  return {
    reserve,

    cancelRun(runId: string): 'cancelled' | 'aborting' | 'running' | 'not_found' {
      const entry = runIndex.get(runId);
      if (!entry) {
        return 'not_found';
      }

      if (cancelEntry(entry)) {
        return 'cancelled';
      }

      if (entry.abortController?.signal.aborted) {
        return 'aborting';
      }

      return requestAbort(entry) ? 'aborting' : 'running';
    },

    cancelLatestQueuedRun(sessionId: string): string | null {
      const state = sessionStates.get(sessionId);
      if (!state) {
        return null;
      }

      for (let index = state.entries.length - 1; index >= 0; index -= 1) {
        const entry = state.entries[index];
        if (entry.started || entry.released || entry.cancelled) {
          continue;
        }

        const runId = entry.runId;
        cancelEntry(entry);
        return runId;
      }

      return null;
    },

    isSessionBusy(sessionId: string): boolean {
      const state = sessionStates.get(sessionId);
      return Boolean(state && state.entries.length > 0);
    },

    async runExclusive<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
      const reservation = reserve(sessionId);
      return reservation.run(task);
    },
  };
}
