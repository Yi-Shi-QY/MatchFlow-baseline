import { describe, expect, it } from 'vitest';
import {
  findBuiltinDomainLocalSubjectSnapshotById,
  getBuiltinDomainLocalSubjectSnapshots,
} from '@/src/services/domains/builtinModules';
import type { SubjectDisplay } from '@/src/services/subjectDisplay';

describe('built-in domain subject contracts', () => {
  it('returns built-in local subject snapshots through the shared subject contract', () => {
    const snapshots = getBuiltinDomainLocalSubjectSnapshots<SubjectDisplay>('football');

    expect(snapshots.length).toBeGreaterThanOrEqual(3);
    expect(typeof snapshots[0]?.id).toBe('string');
  });

  it('returns cloned snapshot instances on repeated reads', () => {
    const firstRead = getBuiltinDomainLocalSubjectSnapshots<SubjectDisplay>('football');
    const secondRead = getBuiltinDomainLocalSubjectSnapshots<SubjectDisplay>('football');

    expect(firstRead[0]).toEqual(secondRead[0]);
    expect(firstRead[0]).not.toBe(secondRead[0]);
  });

  it('finds built-in snapshots by subject id without match-only types', () => {
    const [first] = getBuiltinDomainLocalSubjectSnapshots<SubjectDisplay>('football');
    const found = findBuiltinDomainLocalSubjectSnapshotById<SubjectDisplay>({
      domainId: 'football',
      subjectId: first.id,
    });

    expect(found?.id).toBe(first.id);
  });
});
