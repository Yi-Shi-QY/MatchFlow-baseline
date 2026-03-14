import type { DomainSubjectSnapshot, SubjectDisplayBase, SubjectRef } from './types';

interface BuildSubjectDisplayBaseInput {
  id: string;
  domainId: string;
  subjectType: string;
  title: string;
  subtitle?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export function buildSubjectDisplayBase(
  input: BuildSubjectDisplayBaseInput,
): SubjectDisplayBase {
  return {
    id: input.id,
    domainId: input.domainId,
    subjectType: input.subjectType,
    title: input.title,
    subtitle: input.subtitle,
    status: input.status,
    metadata: input.metadata,
  };
}

export function buildDomainSubjectSnapshot<
  TDisplay extends SubjectDisplayBase = SubjectDisplayBase,
  TRaw extends Record<string, unknown> = Record<string, unknown>,
>(input: {
  ref: SubjectRef;
  display: TDisplay;
  raw?: TRaw;
}): DomainSubjectSnapshot<TDisplay, TRaw> {
  return {
    ref: {
      domainId: input.ref.domainId,
      subjectType: input.ref.subjectType,
      subjectId: input.ref.subjectId,
    },
    display: buildSubjectDisplayBase(input.display) as TDisplay,
    raw: input.raw,
  };
}

export function cloneSubjectSnapshot<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
