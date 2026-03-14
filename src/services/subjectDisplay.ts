import type {
  DomainSubjectSnapshot,
  SubjectDisplayBase,
  SubjectRef,
} from '@/src/services/subjects/types';

export type SubjectDisplay = {
  id: string;
  domainId?: string;
  subjectType?: string;
  title?: string;
  subtitle?: string;
  status?: string;
  metadata?: Record<string, unknown>;
} & Record<string, any>;

export type SubjectDisplayStatus = SubjectDisplay['status'];

export type { DomainSubjectSnapshot, SubjectDisplayBase, SubjectRef };
export {
  buildDomainSubjectSnapshot,
  buildSubjectDisplayBase,
  cloneSubjectSnapshot,
} from '@/src/services/subjects/display';
