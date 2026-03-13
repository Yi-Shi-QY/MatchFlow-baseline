import React from 'react';
import { getActiveAnalysisDomain } from '@/src/services/domains/registry';
import { resolveDomainMatchFeed } from '@/src/services/domainMatchFeed';
import { getHistory } from '@/src/services/history';
import { getSavedSubjects } from '@/src/services/savedSubjects';
import {
  deriveAnalysisDataWorkspaceModel,
  type AnalysisDataWorkspaceModel,
} from './analysisDataWorkspaceModel';

export function useAnalysisDataWorkspaceState(language: 'zh' | 'en'): {
  activeDomainId: string;
  model: AnalysisDataWorkspaceModel;
  isRefreshing: boolean;
  refreshError: string | null;
  reload: () => Promise<void>;
} {
  const activeDomain = getActiveAnalysisDomain();
  const [savedSubjects, setSavedSubjects] = React.useState<Awaited<ReturnType<typeof getSavedSubjects>>>([]);
  const [recentHistory, setRecentHistory] = React.useState<Awaited<ReturnType<typeof getHistory>>>([]);
  const [liveSubjectDisplays, setLiveSubjectDisplays] = React.useState<
    Awaited<ReturnType<typeof resolveDomainMatchFeed>>
  >([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [refreshError, setRefreshError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const [saved, history, live] = await Promise.all([
        getSavedSubjects({ domainId: activeDomain.id }),
        getHistory({ domainId: activeDomain.id }),
        resolveDomainMatchFeed({ domainId: activeDomain.id }),
      ]);

      setSavedSubjects(saved);
      setRecentHistory(history);
      setLiveSubjectDisplays(live);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRefreshError(message);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeDomain.id]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const model = React.useMemo(
    () =>
      deriveAnalysisDataWorkspaceModel({
        activeDomainId: activeDomain.id,
        liveSubjectDisplays,
        savedSubjects,
        recentHistory,
        isRefreshing,
        refreshError,
        language,
      }),
    [
      activeDomain.id,
      isRefreshing,
      language,
      liveSubjectDisplays,
      recentHistory,
      refreshError,
      savedSubjects,
    ],
  );

  return {
    activeDomainId: activeDomain.id,
    model,
    isRefreshing,
    refreshError,
    reload,
  };
}
