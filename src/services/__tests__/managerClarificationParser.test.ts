import { describe, expect, it } from 'vitest';
import {
  buildManagerClarificationFollowUp,
  summarizeManagerClarification,
  toManagerClarificationSnapshot,
} from '@/src/services/manager-workspace/clarificationSummary';
import type { ManagerPendingTask } from '@/src/services/manager/types';

function createPendingTask(
  overrides: Partial<ManagerPendingTask> = {},
): ManagerPendingTask {
  return {
    id: 'pending_task_1',
    sourceText: 'Tonight at 20:00 analyze Real Madrid vs Barcelona',
    composerMode: 'smart',
    drafts: [],
    stage: 'await_factors',
    createdAt: 100,
    ...overrides,
  };
}

describe('manager clarification parser', () => {
  it('recognizes an explicit factor answer', () => {
    const summary = summarizeManagerClarification({
      pendingTask: createPendingTask(),
      answer: 'focus on fundamentals and market',
    });

    expect(summary.selectedSourceIds).toEqual(['fundamental', 'market']);
    expect(summary.sequencePreference).toBeNull();
    expect(summary.missing).toEqual(['sequence']);
    expect(summary.nextStage).toBe('await_sequence');
  });

  it('recognizes an explicit sequence answer', () => {
    const summary = summarizeManagerClarification({
      pendingTask: createPendingTask({
        selectedSourceIds: ['fundamental', 'market'],
        stage: 'await_sequence',
      }),
      answer: 'fundamentals first, then market, then final prediction',
    });

    expect(summary.sequencePreference).toEqual([
      'fundamental',
      'market',
      'prediction',
    ]);
    expect(summary.missing).toEqual([]);
    expect(summary.isComplete).toBe(true);
  });

  it('recognizes mixed factor and sequence answers in a single reply', () => {
    const summary = summarizeManagerClarification({
      pendingTask: createPendingTask(),
      answer:
        'prioritize fundamentals and market, then go market first, fundamentals second, final prediction last',
    });

    expect(summary.selectedSourceIds).toEqual(['fundamental', 'market']);
    expect(summary.sequencePreference).toEqual([
      'market',
      'fundamental',
      'prediction',
    ]);
    expect(summary.isComplete).toBe(true);
    expect(summary.nextStage).toBeNull();
  });

  it('does not re-ask fields that were already recognized earlier', () => {
    const summary = summarizeManagerClarification({
      pendingTask: createPendingTask({
        sequencePreference: ['market', 'fundamental', 'prediction'],
        stage: 'await_factors',
      }),
      answer: 'fundamentals and market',
    });

    expect(summary.selectedSourceIds).toEqual(['fundamental', 'market']);
    expect(summary.sequencePreference).toEqual([
      'market',
      'fundamental',
      'prediction',
    ]);
    expect(summary.missing).toEqual([]);
    expect(summary.isComplete).toBe(true);
  });

  it('returns recognized vs missing summary for targeted follow-up copy', () => {
    const summary = summarizeManagerClarification({
      pendingTask: createPendingTask(),
      answer: 'market first, then final prediction',
    });
    const snapshot = toManagerClarificationSnapshot(summary);
    const followUp = buildManagerClarificationFollowUp({
      language: 'en',
      summary,
    });

    expect(snapshot).toEqual({
      recognizedSourceIds: [],
      recognizedSequence: ['market', 'prediction'],
      missingFields: ['factors'],
    });
    expect(followUp).toContain('Recognized analysis order');
    expect(followUp).toContain('which factors to prioritize');
  });
});
