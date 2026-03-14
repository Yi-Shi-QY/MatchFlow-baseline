import { describe, expect, it } from 'vitest';
import {
  buildDomainSubjectSnapshot,
  buildSubjectDisplayBase,
  cloneSubjectSnapshot,
} from '@/src/services/subjectDisplay';
import { coerceSubjectSnapshotToDisplayMatch } from '@/src/services/subjectDisplayMatch';

describe('subjectDisplay shared contracts', () => {
  it('builds canonical subject display base records', () => {
    const display = buildSubjectDisplayBase({
      id: 'subject-1',
      domainId: 'project_ops',
      subjectType: 'task',
      title: 'Launch task',
      subtitle: 'Planning',
      status: 'open',
      metadata: {
        priority: 'high',
      },
    });

    expect(display).toEqual({
      id: 'subject-1',
      domainId: 'project_ops',
      subjectType: 'task',
      title: 'Launch task',
      subtitle: 'Planning',
      status: 'open',
      metadata: {
        priority: 'high',
      },
    });
  });

  it('builds canonical domain subject snapshots', () => {
    const snapshot = buildDomainSubjectSnapshot({
      ref: {
        domainId: 'project_ops',
        subjectType: 'task',
        subjectId: 'task-1',
      },
      display: buildSubjectDisplayBase({
        id: 'task-1',
        domainId: 'project_ops',
        subjectType: 'task',
        title: 'Write launch checklist',
      }),
      raw: {
        owner: 'ops',
      },
    });

    expect(snapshot.ref).toEqual({
      domainId: 'project_ops',
      subjectType: 'task',
      subjectId: 'task-1',
    });
    expect(snapshot.display.title).toBe('Write launch checklist');
    expect(snapshot.raw).toEqual({
      owner: 'ops',
    });
  });

  it('clones nested subject snapshots defensively', () => {
    const original = {
      id: 'subject-2',
      status: 'open',
      nested: {
        label: 'before',
      },
    };

    const cloned = cloneSubjectSnapshot(original);
    cloned.nested.label = 'after';

    expect(cloned).toEqual({
      id: 'subject-2',
      status: 'open',
      nested: {
        label: 'after',
      },
    });
    expect(original.nested.label).toBe('before');
    expect(cloned).not.toBe(original);
  });

  it('keeps football display matches football-shaped while adding canonical metadata', () => {
    const display = coerceSubjectSnapshotToDisplayMatch(
      {
        id: 'match-1',
        league: 'La Liga',
        status: 'live',
        homeTeam: {
          id: 'rm',
          name: 'Real Madrid',
          logo: 'rm.png',
          form: ['W'],
        },
        awayTeam: {
          id: 'bar',
          name: 'Barcelona',
          logo: 'bar.png',
          form: ['D'],
        },
      },
      'match-1',
      'football',
    );

    expect(display.domainId).toBe('football');
    expect(display.subjectType).toBe('match');
    expect(display.title).toBe('Real Madrid vs Barcelona');
    expect(display.subtitle).toBe('La Liga');
    expect(display.homeTeam.name).toBe('Real Madrid');
    expect(display.awayTeam.name).toBe('Barcelona');
  });
});
