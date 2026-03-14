import React from 'react';
import { getHistory } from '@/src/services/history';
import { getSavedSubjects } from '@/src/services/savedSubjects';
import {
  buildFallbackProjectOpsSubjectDisplay,
  coerceProjectOpsSubjectDisplay,
  findProjectOpsLocalCaseById,
  type ProjectOpsSubjectDisplay,
} from '@/src/services/domains/modules/projectOps/localCases';

interface ProjectOpsSubjectDetailProps {
  domainId: string;
  subjectId: string;
  subjectType: string;
  routeState?: unknown;
}

function isRecordObject(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input);
}

function resolveSubjectFromRouteState(
  routeState: unknown,
  subjectId: string,
): ProjectOpsSubjectDisplay | null {
  if (!isRecordObject(routeState)) {
    return null;
  }

  const candidates = [
    routeState.subjectSnapshot,
    routeState.importedData,
    routeState.subjectDisplay,
  ];

  for (const candidate of candidates) {
    if (candidate) {
      return coerceProjectOpsSubjectDisplay(candidate, subjectId);
    }
  }

  return null;
}

function Field({ label, value }: { label: string; value: string | number | undefined | null }) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[var(--mf-border)] bg-[var(--mf-surface)]/70 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">{label}</div>
      <div className="mt-2 text-sm font-medium text-[var(--mf-text)]">{value}</div>
    </div>
  );
}

function ListCard({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <section className="rounded-[1.75rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/82 p-5 shadow-sm">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">{title}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        {items.length > 0 ? (
          items.map((item, index) => (
            <span
              key={`${item}_${index}`}
              className="rounded-full border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-3 py-1.5 text-xs text-[var(--mf-text)]"
            >
              {item}
            </span>
          ))
        ) : (
          <div className="text-sm text-[var(--mf-text-muted)]">{emptyText}</div>
        )}
      </div>
    </section>
  );
}

export default function ProjectOpsSubjectDetail({
  domainId,
  subjectId,
  subjectType,
  routeState,
}: ProjectOpsSubjectDetailProps) {
  const initialSubject = React.useMemo(
    () =>
      resolveSubjectFromRouteState(routeState, subjectId) ||
      findProjectOpsLocalCaseById(subjectId) ||
      null,
    [routeState, subjectId],
  );
  const [subject, setSubject] = React.useState<ProjectOpsSubjectDisplay | null>(initialSubject);
  const [isLoading, setIsLoading] = React.useState(initialSubject == null);

  React.useEffect(() => {
    let cancelled = false;

    if (initialSubject) {
      setSubject(initialSubject);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    void Promise.all([
      getSavedSubjects({ domainId, subjectId }),
      getHistory({ domainId, subjectId }),
    ])
      .then(([savedSubjects, historyRecords]) => {
        if (cancelled) {
          return;
        }

        const savedSnapshot = savedSubjects[0]?.subjectSnapshot || savedSubjects[0]?.subjectDisplay;
        const historySnapshot = historyRecords[0]?.subjectSnapshot || historyRecords[0]?.subjectDisplay;
        const nextSubject =
          (savedSnapshot && coerceProjectOpsSubjectDisplay(savedSnapshot, subjectId)) ||
          (historySnapshot && coerceProjectOpsSubjectDisplay(historySnapshot, subjectId)) ||
          findProjectOpsLocalCaseById(subjectId) ||
          buildFallbackProjectOpsSubjectDisplay(subjectId);

        setSubject(nextSubject);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [domainId, initialSubject, subjectId]);

  const resolvedSubject = subject || buildFallbackProjectOpsSubjectDisplay(subjectId);
  const blockers = resolvedSubject.metadata.blockers || [];
  const checklist = resolvedSubject.metadata.checklist || [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#18312d,transparent_42%),linear-gradient(180deg,#0b1211,#060807)] text-[var(--mf-text)]">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pb-8 pt-6 sm:px-6">
        <section className="rounded-[2rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-6 shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
                {resolvedSubject.subjectType} / {resolvedSubject.metadata.stage}
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-[var(--mf-text)]">{resolvedSubject.title}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--mf-text-muted)]">
                  {resolvedSubject.metadata.summary}
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-[rgba(120,220,180,0.2)] bg-[rgba(72,163,126,0.12)] px-4 py-3 text-right">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--mf-text-muted)]">
                Status
              </div>
              <div className="mt-2 text-sm font-medium text-[var(--mf-text)]">
                {resolvedSubject.status}
              </div>
              {isLoading ? (
                <div className="mt-2 text-xs text-[var(--mf-text-muted)]">Loading local state...</div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Owner" value={resolvedSubject.metadata.owner} />
            <Field label="Priority" value={resolvedSubject.metadata.priority} />
            <Field label="Next event" value={resolvedSubject.metadata.nextEventTitle} />
            <Field label="Event time" value={resolvedSubject.metadata.nextEventTime} />
            <Field label="Risk score" value={resolvedSubject.metadata.riskScore} />
            <Field label="Confidence" value={resolvedSubject.metadata.confidence} />
            <Field label="Domain" value={domainId} />
            <Field label="Route subject type" value={subjectType} />
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/82 p-5 shadow-sm">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">
            Recommended action
          </div>
          <div className="mt-3 text-sm leading-7 text-[var(--mf-text)]">
            {resolvedSubject.metadata.recommendedAction || 'No recommendation captured yet.'}
          </div>
          {resolvedSubject.customInfo ? (
            <div className="mt-4 rounded-2xl border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-4 py-3 text-sm leading-6 text-[var(--mf-text-muted)]">
              {resolvedSubject.customInfo}
            </div>
          ) : null}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <ListCard
            title="Checklist"
            items={checklist}
            emptyText="No checklist items captured for this subject."
          />
          <ListCard
            title="Blockers"
            items={blockers}
            emptyText="No active blockers are stored for this subject."
          />
        </div>
      </div>
    </main>
  );
}
