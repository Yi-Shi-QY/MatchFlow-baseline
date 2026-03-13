import React from 'react';
import { getActiveAnalysisDomain } from '@/src/services/domains/registry';
import {
  getHistory,
  getRecoverableResumeStates,
} from '@/src/services/history';
import { getSavedSubjects } from '@/src/services/savedSubjects';
import {
  deriveHistoryWorkspaceModel,
  type HistoryWorkspaceModel,
} from './historyWorkspaceModel';

export function useHistoryWorkspaceState(language: 'zh' | 'en'): {
  model: HistoryWorkspaceModel;
  isLoading: boolean;
  reload: () => Promise<void>;
} {
  const activeDomain = getActiveAnalysisDomain();
  const [historyRecords, setHistoryRecords] = React.useState<Awaited<ReturnType<typeof getHistory>>>([]);
  const [resumeStates, setResumeStates] = React.useState<
    Awaited<ReturnType<typeof getRecoverableResumeStates>>
  >([]);
  const [savedSubjects, setSavedSubjects] = React.useState<
    Awaited<ReturnType<typeof getSavedSubjects>>
  >([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const reload = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [history, resumable, saved] = await Promise.all([
        getHistory({ domainId: activeDomain.id }),
        getRecoverableResumeStates({ domainId: activeDomain.id }),
        getSavedSubjects({ domainId: activeDomain.id }),
      ]);

      setHistoryRecords(history);
      setResumeStates(resumable);
      setSavedSubjects(saved);
    } finally {
      setIsLoading(false);
    }
  }, [activeDomain.id]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const model = React.useMemo(
    () =>
      deriveHistoryWorkspaceModel({
        historyRecords,
        resumeStates,
        savedSubjects,
        language,
      }),
    [historyRecords, language, resumeStates, savedSubjects],
  );

  return {
    model,
    isLoading,
    reload,
  };
}
