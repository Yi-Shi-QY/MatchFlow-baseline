import { beforeEach, describe, expect, it } from 'vitest';
import type { NormalizedPlanSegment } from '@/src/services/ai/contracts';
import {
  clearResumeState,
  getRecoverableResumeStates,
  isResumeStateRecoverable,
  saveResumeState,
  type SavedResumeState,
} from '@/src/services/history';
import { DEFAULT_SETTINGS, saveSettings } from '@/src/services/settings';

const basePlan: NormalizedPlanSegment[] = [
  {
    title: 'Segment A',
    focus: 'Test focus',
    animationType: 'none',
    agentType: 'general',
  },
];

function buildBaseSavedState(overrides?: Partial<SavedResumeState>): SavedResumeState {
  return {
    domainId: 'football',
    subjectId: 'match_1',
    subjectType: 'match',
    thoughts: 'partial analysis text',
    timestamp: Date.now(),
    state: {
      plan: basePlan,
      completedSegmentIndices: [],
      fullAnalysisText: 'partial analysis text',
    },
    ...(overrides || {}),
  };
}

describe('history resume recoverability', () => {
  beforeEach(async () => {
    const map = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        get length() {
          return map.size;
        },
        clear() {
          map.clear();
        },
        getItem(key: string) {
          return map.has(key) ? map.get(key)! : null;
        },
        key(index: number) {
          return Array.from(map.keys())[index] ?? null;
        },
        removeItem(key: string) {
          map.delete(key);
        },
        setItem(key: string, value: string) {
          map.set(key, value);
        },
      } satisfies Storage,
      configurable: true,
    });
    localStorage.clear();
    await clearResumeState();
  });

  it('returns true for unfinished analysis artifacts', () => {
    const state = buildBaseSavedState();
    expect(isResumeStateRecoverable(state)).toBe(true);
  });

  it('remains recoverable for unfinished subject-route artifacts beyond match-first subject types', () => {
    const state = buildBaseSavedState({
      subjectId: 'subject_42',
      subjectType: 'team_report',
    });
    expect(isResumeStateRecoverable(state)).toBe(true);
  });

  it('returns false when runtime stage is completed', () => {
    const state = buildBaseSavedState({
      state: {
        plan: basePlan,
        completedSegmentIndices: [0],
        fullAnalysisText: 'done',
        runtimeStatus: { stage: 'completed' } as any,
      },
    });
    expect(isResumeStateRecoverable(state)).toBe(false);
  });

  it('returns false when there are no recoverable artifacts', () => {
    const state = buildBaseSavedState({
      thoughts: '',
      state: {
        plan: [],
        completedSegmentIndices: [],
        fullAnalysisText: '',
        segmentResults: [],
      },
    });
    expect(isResumeStateRecoverable(state)).toBe(false);
  });

  it('lists only recoverable resume states for a domain', async () => {
    await saveResumeState(
      'match_1',
      {
        plan: basePlan,
        completedSegmentIndices: [],
        fullAnalysisText: 'unfinished work',
      },
      'unfinished work',
      {
        domainId: 'football',
        subjectId: 'match_1',
      },
    );
    await saveResumeState(
      'match_2',
      {
        plan: basePlan,
        completedSegmentIndices: [0],
        fullAnalysisText: 'done',
        runtimeStatus: { stage: 'completed' } as any,
      },
      'done',
      {
        domainId: 'football',
        subjectId: 'match_2',
      },
    );
    await saveResumeState(
      'match_3',
      {
        plan: basePlan,
        completedSegmentIndices: [],
        fullAnalysisText: 'other domain pending',
      },
      'other domain pending',
      {
        domainId: 'basketball',
        subjectId: 'match_3',
      },
    );

    const recoverable = await getRecoverableResumeStates({
      domainId: 'football',
    });

    expect(recoverable.map((item) => item.subjectId)).toEqual(['match_1']);
  });

  it('uses the active configured domain when a resume state omits domainId', async () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      activeDomainId: 'project_ops',
    });

    await saveResumeState(
      'task_1',
      {
        plan: basePlan,
        completedSegmentIndices: [],
        fullAnalysisText: 'unfinished project task',
      },
      'unfinished project task',
      {
        subjectId: 'task_1',
        subjectType: 'task',
      },
    );

    const recoverable = await getRecoverableResumeStates({
      domainId: 'project_ops',
    });

    expect(recoverable).toHaveLength(1);
    expect(recoverable[0]).toMatchObject({
      domainId: 'project_ops',
      subjectId: 'task_1',
      subjectType: 'task',
    });
  });
});
