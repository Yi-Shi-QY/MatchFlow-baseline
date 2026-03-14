import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearSavedSubjects,
  getSavedSubjects,
  saveSubject,
} from '@/src/services/savedSubjects';
import { DEFAULT_SETTINGS, saveSettings } from '@/src/services/settings';
import { buildFallbackDisplayMatch } from '@/src/services/subjectDisplayMatch';

describe('saved subjects', () => {
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
    saveSettings({ ...DEFAULT_SETTINGS });
    await clearSavedSubjects();
  });

  it('uses the active configured domain when a saved subject omits domainId', async () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      activeDomainId: 'project_ops',
    });

    await saveSubject(
      {
        ...buildFallbackDisplayMatch('task_1', 'project_ops'),
        subjectType: 'task',
        title: 'Project task',
      },
      {
        subjectId: 'task_1',
        subjectType: 'task',
      },
    );

    const records = await getSavedSubjects({
      domainId: 'project_ops',
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      domainId: 'project_ops',
      subjectId: 'task_1',
      subjectType: 'task',
    });
  });

  it('round-trips generic subject refs through local persistence', async () => {
    await saveSubject(
      {
        ...buildFallbackDisplayMatch('brief_1', 'macro'),
        subjectType: 'brief',
        title: 'Macro brief',
      },
      {
        domainId: 'macro',
        subjectId: 'brief_1',
        subjectType: 'brief',
      },
    );

    const records = await getSavedSubjects({
      domainId: 'macro',
      subjectId: 'brief_1',
    });

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      domainId: 'macro',
      subjectId: 'brief_1',
      subjectType: 'brief',
      id: 'macro::brief_1',
    });
  });
});
