import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildSubjectRoute,
  buildSubjectRouteFromRef,
  parseSubjectRoute,
} from '@/src/services/navigation/subjectRoute';
import { DEFAULT_SETTINGS, saveSettings } from '@/src/services/settings';

describe('subjectRoute', () => {
  beforeEach(() => {
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
  });

  it('builds canonical subject routes', () => {
    expect(buildSubjectRoute('football', 'match_1')).toBe('/subject/football/match_1');
    expect(
      buildSubjectRouteFromRef({
        domainId: 'project_ops',
        subjectId: 'task-1',
      }),
    ).toBe('/subject/project_ops/task-1');
  });

  it('normalizes empty route segments with safe fallbacks', () => {
    expect(buildSubjectRoute('', '')).toBe('/subject/football/unknown_subject');
  });

  it('uses the active configured domain when a route omits domainId', () => {
    saveSettings({
      ...DEFAULT_SETTINGS,
      activeDomainId: 'project_ops',
    });

    expect(buildSubjectRoute('', 'task_7')).toBe('/subject/project_ops/task_7');
  });

  it('parses encoded subject routes back into canonical refs', () => {
    expect(parseSubjectRoute('/subject/project_ops/task%201')).toEqual({
      domainId: 'project_ops',
      subjectId: 'task 1',
    });
    expect(parseSubjectRoute('/history')).toBeNull();
  });
});
