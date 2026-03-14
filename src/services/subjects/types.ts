export interface SubjectRef {
  domainId: string;
  subjectType: string;
  subjectId: string;
}

export interface SubjectDisplayBase {
  id: string;
  domainId: string;
  subjectType: string;
  title: string;
  subtitle?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface DomainSubjectSnapshot<
  TDisplay extends SubjectDisplayBase = SubjectDisplayBase,
  TRaw extends Record<string, unknown> = Record<string, unknown>,
> {
  ref: SubjectRef;
  display: TDisplay;
  raw?: TRaw;
}
