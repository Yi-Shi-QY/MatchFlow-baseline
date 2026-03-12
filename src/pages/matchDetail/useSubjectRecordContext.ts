import React from 'react';
import { getHistory, getResumeState, type HistoryRecord } from '@/src/services/history';
import {
  getSavedSubjects,
  type SavedSubjectRecord,
} from '@/src/services/savedSubjects';
import {
  coerceSubjectSnapshotToDisplayMatch,
  type SubjectDisplayMatch,
} from '@/src/services/subjectDisplayMatch';

export interface SubjectRecordContextState {
  historyRecord: HistoryRecord | undefined;
  savedSubjectRecord: SavedSubjectRecord | undefined;
  resumeSubjectDisplay: SubjectDisplayMatch | undefined;
  isLoadingRecordContext: boolean;
}

interface UseSubjectRecordContextArgs {
  id: string;
  domainId: string;
}

export function useSubjectRecordContext({
  id,
  domainId,
}: UseSubjectRecordContextArgs): SubjectRecordContextState {
  const [historyRecord, setHistoryRecord] = React.useState<HistoryRecord | undefined>(
    undefined,
  );
  const [savedSubjectRecord, setSavedSubjectRecord] = React.useState<
    SavedSubjectRecord | undefined
  >(undefined);
  const [resumeSubjectDisplay, setResumeSubjectDisplay] = React.useState<
    SubjectDisplayMatch | undefined
  >(undefined);
  const [isLoadingRecordContext, setIsLoadingRecordContext] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setIsLoadingRecordContext(true);
      try {
        if (!id) {
          setHistoryRecord(undefined);
          setSavedSubjectRecord(undefined);
          setResumeSubjectDisplay(undefined);
          return;
        }

        const history = await getHistory({ domainId, subjectId: id });
        if (cancelled) return;
        const record = history[0];
        setHistoryRecord(record);

        if (!record) {
          const savedSubjects = await getSavedSubjects({ domainId, subjectId: id });
          if (cancelled) return;
          setSavedSubjectRecord(savedSubjects[0]);
        } else {
          setSavedSubjectRecord(undefined);
        }

        const resumeState = await getResumeState(id, {
          domainId,
          subjectId: id,
          subjectType: 'match',
        });
        if (cancelled) return;
        const snapshot =
          resumeState?.state?.subjectSnapshot || resumeState?.state?.subjectDisplaySnapshot;
        if (snapshot && typeof snapshot === 'object') {
          setResumeSubjectDisplay(coerceSubjectSnapshotToDisplayMatch(snapshot, id, domainId));
        } else {
          setResumeSubjectDisplay(undefined);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingRecordContext(false);
        }
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [id, domainId]);

  return {
    historyRecord,
    savedSubjectRecord,
    resumeSubjectDisplay,
    isLoadingRecordContext,
  };
}
