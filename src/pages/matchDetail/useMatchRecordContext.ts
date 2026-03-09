import React from 'react';
import type { Match } from '@/src/data/matches';
import { getHistory, getResumeState, type HistoryRecord } from '@/src/services/history';
import {
  getSavedSubjects,
  type SavedSubjectRecord,
} from '@/src/services/savedSubjects';

export interface MatchRecordContextState {
  historyRecord: HistoryRecord | undefined;
  savedMatchRecord: SavedSubjectRecord | undefined;
  resumeMatch: Match | undefined;
  isLoadingRecordContext: boolean;
}

interface UseMatchRecordContextArgs {
  id: string;
  domainId: string;
}

export function useMatchRecordContext({
  id,
  domainId,
}: UseMatchRecordContextArgs): MatchRecordContextState {
  const [historyRecord, setHistoryRecord] = React.useState<HistoryRecord | undefined>(
    undefined,
  );
  const [savedMatchRecord, setSavedMatchRecord] = React.useState<
    SavedSubjectRecord | undefined
  >(undefined);
  const [resumeMatch, setResumeMatch] = React.useState<Match | undefined>(undefined);
  const [isLoadingRecordContext, setIsLoadingRecordContext] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setIsLoadingRecordContext(true);
      try {
        const history = await getHistory({ domainId });
        if (cancelled) return;
        const record = history.find((h) => h.subjectId === id || h.matchId === id || h.id === id);
        setHistoryRecord(record);

        if (!record) {
          const savedMatches = await getSavedSubjects({ domainId });
          if (cancelled) return;
          const saved = savedMatches.find((s) => s.subjectId === id || s.id === id);
          setSavedMatchRecord(saved);
        } else {
          setSavedMatchRecord(undefined);
        }

        if (id) {
          const resumeState = await getResumeState(id, {
            domainId,
            subjectId: id,
            subjectType: 'match',
          });
          if (cancelled) return;
          const snapshot = resumeState?.state?.subjectSnapshot || resumeState?.state?.matchSnapshot;
          if (snapshot && typeof snapshot === 'object') {
            setResumeMatch(snapshot as Match);
          } else {
            setResumeMatch(undefined);
          }
        } else {
          setResumeMatch(undefined);
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
    savedMatchRecord,
    resumeMatch,
    isLoadingRecordContext,
  };
}
