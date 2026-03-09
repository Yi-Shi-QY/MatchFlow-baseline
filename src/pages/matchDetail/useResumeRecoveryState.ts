import React from 'react';
import type { Match } from '@/src/data/matches';
import type { ActiveAnalysis } from '@/src/contexts/AnalysisContext';
import {
  clearResumeState,
  getResumeState,
  isResumeStateRecoverable,
  type HistoryRecord,
  type SavedResumeState,
} from '@/src/services/history';
import type { PlannerStage } from '@/src/services/planner/runtime';
import { getPlannerStageI18nKey } from '@/src/services/planner/stageI18n';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export interface ResumeStatusMeta {
  stageLabel: string;
  completedSegments: number;
  totalSegments: number;
  progressPercent: number;
  lastSaved: string;
  activeSegmentTitle: string | null;
}

interface UseResumeRecoveryStateArgs {
  match: Match | undefined;
  activeAnalysis: ActiveAnalysis | null;
  historyRecord: HistoryRecord | undefined;
  activeDomainId: string;
  language: string;
  t: TranslateFn;
}

export function useResumeRecoveryState({
  match,
  activeAnalysis,
  historyRecord,
  activeDomainId,
  language,
  t,
}: UseResumeRecoveryStateArgs): {
  savedResumeState: SavedResumeState | null;
  resumeStatusMeta: ResumeStatusMeta | null;
} {
  const [savedResumeState, setSavedResumeState] = React.useState<SavedResumeState | null>(
    null,
  );

  React.useEffect(() => {
    if (!match) return;

    const shouldLoadResume =
      !activeAnalysis || (!activeAnalysis.isAnalyzing && !activeAnalysis.analysis);

    if (historyRecord && !activeAnalysis) {
      setSavedResumeState(null);
      return;
    }

    if (!shouldLoadResume) {
      setSavedResumeState(null);
      return;
    }

    let cancelled = false;
    const resumeOptions = {
      domainId: activeDomainId,
      subjectId: match.id,
      subjectType: 'match' as const,
    };

    const loadResumeState = async () => {
      const resumeState = await getResumeState(match.id, resumeOptions);
      if (cancelled) return;

      if (!isResumeStateRecoverable(resumeState)) {
        setSavedResumeState(null);
        if (resumeState) {
          await clearResumeState(match.id, resumeOptions);
        }
        return;
      }

      setSavedResumeState(resumeState);
    };

    void loadResumeState();
    return () => {
      cancelled = true;
    };
  }, [match, activeAnalysis, historyRecord, activeDomainId]);

  const resumeStatusMeta = React.useMemo<ResumeStatusMeta | null>(() => {
    if (!savedResumeState) return null;

    const resumeState = savedResumeState.state;
    const runtimeStatus = resumeState?.runtimeStatus;
    const stage: PlannerStage = runtimeStatus?.stage || 'booting';
    const stageLabel = t(getPlannerStageI18nKey(stage));

    const completedSegments = Array.isArray(resumeState?.completedSegmentIndices)
      ? resumeState.completedSegmentIndices.length
      : Math.max(0, runtimeStatus?.segmentIndex || 0);
    const totalSegments = Array.isArray(resumeState?.plan)
      ? resumeState.plan.length
      : Math.max(0, runtimeStatus?.totalSegments || 0);
    const progressPercent =
      typeof runtimeStatus?.progressPercent === 'number'
        ? Math.max(0, Math.min(100, Math.round(runtimeStatus.progressPercent)))
        : totalSegments > 0
          ? Math.round((completedSegments / totalSegments) * 100)
          : 0;

    const locale = language.startsWith('zh') ? 'zh-CN' : 'en-US';
    const lastSaved = new Date(savedResumeState.timestamp).toLocaleString(locale, {
      hour12: false,
    });
    const activeSegmentTitle =
      typeof runtimeStatus?.activeSegmentTitle === 'string' &&
      runtimeStatus.activeSegmentTitle.trim().length > 0
        ? runtimeStatus.activeSegmentTitle.trim()
        : null;

    return {
      stageLabel,
      completedSegments,
      totalSegments,
      progressPercent,
      lastSaved,
      activeSegmentTitle,
    };
  }, [savedResumeState, t, language]);

  return { savedResumeState, resumeStatusMeta };
}
