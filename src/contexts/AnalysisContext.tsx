import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { Match } from '@/src/data/matches';
import { streamAgentThoughts, MatchAnalysis, AnalysisResumeState, isAbortError } from '@/src/services/ai';
import { saveHistory, saveResumeState, clearResumeState, getResumeState } from '@/src/services/history';
import { deleteSavedMatch } from '@/src/services/savedMatches';
import { AgentResult, AgentSegment, parseAgentStream } from '@/src/services/agentParser';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { getSettings } from '@/src/services/settings';
import {
  buildPlannerRuntimeState,
  createPlannerRunId,
  type PlannerRuntimeState,
} from '@/src/services/planner/runtime';

export interface ActiveAnalysis {
  matchId: string;
  match: Match;
  dataToAnalyze: any;
  includeAnimations: boolean;
  thoughts: string;
  parsedStream: AgentResult | null;
  collapsedSegments: Record<string, boolean>;
  isAnalyzing: boolean;
  analysis: MatchAnalysis | null;
  error: string | null;
  planTotalSegments: number;
  planCompletedSegments: number;
  runtimeStatus: PlannerRuntimeState | null;
}

interface AnalysisContextType {
  activeAnalyses: Record<string, ActiveAnalysis>;
  startAnalysis: (match: Match, dataToAnalyze: any, includeAnimations: boolean, isResume?: boolean) => void;
  stopAnalysis: (matchId: string) => void;
  clearActiveAnalysis: (matchId: string) => void;
  setCollapsedSegments: (matchId: string, segments: Record<string, boolean>) => void;
}

const RESUME_SNAPSHOT_INTERVAL_MS = 3000;
const STREAM_UI_UPDATE_INTERVAL_MS = 80;

function areTagsEqual(a: AgentSegment['tags'], b: AgentSegment['tags']): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].label !== b[i].label ||
      a[i].team !== b[i].team ||
      a[i].color !== b[i].color
    ) {
      return false;
    }
  }
  return true;
}

function stabilizeSegment(prevSeg: AgentSegment, nextSeg: AgentSegment): AgentSegment {
  const sameCore =
    prevSeg.title === nextSeg.title &&
    prevSeg.thoughts === nextSeg.thoughts &&
    prevSeg.animationJson === nextSeg.animationJson &&
    prevSeg.isThoughtComplete === nextSeg.isThoughtComplete &&
    prevSeg.isAnimationComplete === nextSeg.isAnimationComplete &&
    areTagsEqual(prevSeg.tags, nextSeg.tags);

  if (sameCore) {
    return prevSeg;
  }

  if (
    prevSeg.animation &&
    nextSeg.animation &&
    nextSeg.isAnimationComplete &&
    prevSeg.animationJson &&
    prevSeg.animationJson === nextSeg.animationJson
  ) {
    return {
      ...nextSeg,
      animation: prevSeg.animation,
    };
  }

  return nextSeg;
}

function stabilizeParsedStream(
  prevParsed: AgentResult | null,
  nextParsed: AgentResult | null,
): AgentResult | null {
  if (!nextParsed) return null;
  if (!prevParsed) return nextParsed;

  const prevSegmentsById = new Map(prevParsed.segments.map(seg => [seg.id, seg]));
  const nextSegments = nextParsed.segments.map(seg => {
    const prevSeg = prevSegmentsById.get(seg.id);
    if (!prevSeg) return seg;
    return stabilizeSegment(prevSeg, seg);
  });

  const summary =
    prevParsed.summaryJson === nextParsed.summaryJson ? prevParsed.summary : nextParsed.summary;

  const fullyStable =
    prevParsed.isComplete === nextParsed.isComplete &&
    prevParsed.summaryJson === nextParsed.summaryJson &&
    prevParsed.segments.length === nextSegments.length &&
    nextSegments.every((seg, idx) => seg === prevParsed.segments[idx]);

  if (fullyStable) {
    return prevParsed;
  }

  return {
    ...nextParsed,
    segments: nextSegments,
    summary,
  };
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const [activeAnalyses, setActiveAnalyses] = useState<Record<string, ActiveAnalysis>>({});
  const analysisAbortControllersRef = useRef<Record<string, AbortController>>({});
  const lastNotificationKeyRef = useRef<string>('');
  const lastNotificationAtRef = useRef<number>(0);

  const createAbortError = () => {
    const err = new Error("Analysis aborted");
    (err as any).name = "AbortError";
    return err;
  };

  // Background Notification Effect
  useEffect(() => {
    const updateNotification = async () => {
      if (!Capacitor.isNativePlatform()) return;
      
      const settings = getSettings();
      if (!settings.enableBackgroundMode) return;

      const analyzingMatches = Object.values(activeAnalyses).filter(a => a.isAnalyzing);
      
      if (analyzingMatches.length > 0) {
        const additionalCount = Math.max(0, analyzingMatches.length - 1);
        const firstMatch = analyzingMatches[0];
        const segments = firstMatch.parsedStream?.segments || [];
        const lastSegment = segments[segments.length - 1];
        const language = settings.language === 'zh' ? 'zh' : 'en';
        const completedFromSegments = segments.filter(seg => seg.isThoughtComplete).length;
        const totalSegments =
          firstMatch.planTotalSegments > 0
            ? firstMatch.planTotalSegments
            : Math.max(segments.length, completedFromSegments, 1);
        const completedSegments = Math.min(
          totalSegments,
          Math.max(firstMatch.planCompletedSegments, completedFromSegments),
        );
        const progressPercent =
          totalSegments > 0
            ? Math.min(99, Math.floor((completedSegments / totalSegments) * 100))
            : 0;
        const status = lastSegment
          ? (lastSegment.title || (language === 'zh' ? '处理中...' : 'Processing...'))
          : (language === 'zh' ? '启动中...' : 'Starting...');

        const title =
          language === 'zh'
            ? `MatchFlow 后台分析中 (${analyzingMatches.length} 场)`
            : `MatchFlow Analysis Running (${analyzingMatches.length})`;
        const bodyLines = [
          `${firstMatch.match.homeTeam.name} vs ${firstMatch.match.awayTeam.name}`,
          language === 'zh'
            ? `进度：${completedSegments}/${totalSegments} (${progressPercent}%)`
            : `Progress: ${completedSegments}/${totalSegments} (${progressPercent}%)`,
          language === 'zh' ? `当前：${status}` : `Current: ${status}`,
          additionalCount > 0
            ? (language === 'zh' ? `另有 ${additionalCount} 场分析进行中` : `+${additionalCount} more matches in progress`)
            : '',
        ].filter(Boolean);
        const body = bodyLines.join('\n');

        const notificationKey = `${firstMatch.matchId}|${completedSegments}|${totalSegments}|${status}|${additionalCount}|${language}`;
        const now = Date.now();
        if (
          notificationKey === lastNotificationKeyRef.current &&
          now - lastNotificationAtRef.current < 1200
        ) {
          return;
        }
        lastNotificationKeyRef.current = notificationKey;
        lastNotificationAtRef.current = now;
        
        await LocalNotifications.schedule({
          notifications: [{
            id: 1001,
            title,
            body,
            ongoing: true,
            autoCancel: false,
            schedule: { at: new Date(Date.now() + 100) },
            extra: {
              matchId: firstMatch.matchId,
              route: `/match/${firstMatch.matchId}`,
            } as any,
          }]
        });
      } else {
        // Cancel notification if no analysis is running
        // We only cancel if we might have scheduled one (id 1001)
        try {
          await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
          lastNotificationKeyRef.current = '';
          lastNotificationAtRef.current = 0;
        } catch (e) {
          // Ignore error if notification doesn't exist
        }
      }
    };

    updateNotification();
  }, [activeAnalyses]);

  const updateAnalysis = useCallback((matchId: string, updates: Partial<ActiveAnalysis>) => {
    setActiveAnalyses(prev => {
      if (!prev[matchId]) return prev;
      return {
        ...prev,
        [matchId]: {
          ...prev[matchId],
          ...updates
        }
      };
    });
  }, []);

  const clearActiveAnalysis = useCallback((matchId: string) => {
    const controller = analysisAbortControllersRef.current[matchId];
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }
    delete analysisAbortControllersRef.current[matchId];

    setActiveAnalyses(prev => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
  }, []);

  const stopAnalysis = useCallback((matchId: string) => {
    const controller = analysisAbortControllersRef.current[matchId];
    if (controller && !controller.signal.aborted) {
      controller.abort();
    }

    const stopNote = "\n\n[SYSTEM] Analysis stopped by user.";

    setActiveAnalyses(prev => {
      const target = prev[matchId];
      if (!target || !target.isAnalyzing) return prev;

      const nextThoughts = target.thoughts.includes(stopNote.trim())
        ? target.thoughts
        : target.thoughts + stopNote;

      return {
        ...prev,
        [matchId]: {
          ...target,
          thoughts: nextThoughts,
          isAnalyzing: false,
          error: null,
          runtimeStatus: buildPlannerRuntimeState({
            stage: 'cancelled',
            runId: target.runtimeStatus?.runId || createPlannerRunId(`analysis_${matchId}`),
            segmentIndex: target.runtimeStatus?.segmentIndex ?? target.planCompletedSegments,
            totalSegments: target.runtimeStatus?.totalSegments ?? target.planTotalSegments,
            stageLabel: 'Cancelled',
          }),
        }
      };
    });
  }, []);

  const setCollapsedSegments = useCallback((matchId: string, segments: Record<string, boolean>) => {
    updateAnalysis(matchId, { collapsedSegments: segments });
  }, [updateAnalysis]);

  const startAnalysis = useCallback(async (match: Match, dataToAnalyze: any, includeAnimations: boolean, isResume: boolean = false) => {
    const matchId = match.id;
    const previousController = analysisAbortControllersRef.current[matchId];
    if (previousController && !previousController.signal.aborted) {
      previousController.abort();
    }

    const abortController = new AbortController();
    analysisAbortControllersRef.current[matchId] = abortController;
    
    // Initialize state
    let initialThoughts = '';
    let initialParsedStream: AgentResult | null = null;
    let initialCollapsed: Record<string, boolean> = {};
    let resumeStateData: AnalysisResumeState | undefined = undefined;

    if (isResume) {
      const savedState = await getResumeState(matchId);
      if (savedState) {
        resumeStateData = savedState.state;
        
        // Prefer completed segments. Keep draft thoughts only for temporary preview.
        if (resumeStateData && resumeStateData.segmentResults) {
          initialThoughts = resumeStateData.segmentResults.map(r => r.content).join('');
        } else {
          initialThoughts = savedState.thoughts;
        }

        initialParsedStream = parseAgentStream(initialThoughts);
        
        initialParsedStream.segments.forEach(seg => {
          if (seg.isThoughtComplete) {
            initialCollapsed[seg.id] = true;
          }
        });
      }
    } else {
      await clearResumeState(matchId);
    }

    const initialResumeState: AnalysisResumeState = {
      plan: Array.isArray(resumeStateData?.plan) ? resumeStateData.plan : [],
      completedSegmentIndices: Array.isArray(resumeStateData?.completedSegmentIndices)
        ? resumeStateData.completedSegmentIndices
        : [],
      fullAnalysisText:
        typeof resumeStateData?.fullAnalysisText === 'string'
          ? resumeStateData.fullAnalysisText
          : initialThoughts,
      segmentResults: Array.isArray(resumeStateData?.segmentResults)
        ? resumeStateData.segmentResults
        : [],
      runtimeStatus: resumeStateData?.runtimeStatus,
    };
    const initialPlanTotalSegments = initialResumeState.plan.length;
    const initialPlanCompletedSegments = initialResumeState.completedSegmentIndices.length;

    const persistedRuntimeStatus = initialResumeState.runtimeStatus
      ? buildPlannerRuntimeState({
          ...initialResumeState.runtimeStatus,
          runId:
            typeof initialResumeState.runtimeStatus.runId === 'string' &&
            initialResumeState.runtimeStatus.runId.trim().length > 0
              ? initialResumeState.runtimeStatus.runId
              : createPlannerRunId(`analysis_${matchId}`),
          segmentIndex:
            typeof initialResumeState.runtimeStatus.segmentIndex === 'number'
              ? initialResumeState.runtimeStatus.segmentIndex
              : initialPlanCompletedSegments,
          totalSegments:
            typeof initialResumeState.runtimeStatus.totalSegments === 'number'
              ? initialResumeState.runtimeStatus.totalSegments
              : initialPlanTotalSegments,
        })
      : null;

    const analysisRunId = persistedRuntimeStatus?.runId || createPlannerRunId(`analysis_${matchId}`);
    const initialRuntimeStatus = persistedRuntimeStatus
      ? persistedRuntimeStatus
      : buildPlannerRuntimeState({
          stage: 'booting',
          runId: analysisRunId,
          segmentIndex: initialPlanCompletedSegments,
          totalSegments: initialPlanTotalSegments,
          stageLabel: 'Booting',
        });

    const newAnalysis: ActiveAnalysis = {
      matchId,
      match,
      dataToAnalyze,
      includeAnimations,
      thoughts: initialThoughts,
      parsedStream: initialParsedStream,
      collapsedSegments: initialCollapsed,
      isAnalyzing: true,
      analysis: null,
      error: null,
      planTotalSegments: initialPlanTotalSegments,
      planCompletedSegments: initialPlanCompletedSegments,
      runtimeStatus: initialRuntimeStatus,
    };

    setActiveAnalyses(prev => ({ ...prev, [matchId]: newAnalysis }));

    let currentThoughts = initialThoughts;
    let latestResumeState: AnalysisResumeState = {
      ...initialResumeState,
      runtimeStatus: initialRuntimeStatus,
    };
    let latestRuntimeStatus: PlannerRuntimeState = initialRuntimeStatus;
    let lastSnapshotAt = 0;
    let lastUiRenderAt = 0;
    let dropStaleDraftOnFirstChunk =
      isResume && (!resumeStateData?.segmentResults || resumeStateData.segmentResults.length === 0);

    const persistResumeSnapshot = (force: boolean = false) => {
      const now = Date.now();
      if (!force && now - lastSnapshotAt < RESUME_SNAPSHOT_INTERVAL_MS) {
        return;
      }
      lastSnapshotAt = now;
      const stateToPersist: AnalysisResumeState = {
        ...latestResumeState,
        runtimeStatus: latestRuntimeStatus,
        matchSnapshot: match,
      };
      void saveResumeState(matchId, stateToPersist, currentThoughts);
    };

    const commitLivePreview = (
      parsedStream: AgentResult | null,
      collapsedSegments: Record<string, boolean>,
      force: boolean = false,
    ) => {
      const now = Date.now();
      if (!force && now - lastUiRenderAt < STREAM_UI_UPDATE_INTERVAL_MS) {
        return;
      }
      lastUiRenderAt = now;

      setActiveAnalyses(prev => {
        const target = prev[matchId];
        if (!target) return prev;
        const nextParsed = stabilizeParsedStream(target.parsedStream, parsedStream);

        return {
          ...prev,
          [matchId]: {
            ...target,
            thoughts: currentThoughts,
            parsedStream: nextParsed,
            collapsedSegments
          }
        };
      });
    };

    try {
      let currentParsedStream = initialParsedStream;
      let currentCollapsed = initialCollapsed;
      
      const stream = streamAgentThoughts(
        dataToAnalyze, 
        includeAnimations,
        resumeStateData,
        (state) => {
          const planTotalSegments = Array.isArray(state.plan) ? state.plan.length : 0;
          const planCompletedSegments = Array.isArray(state.completedSegmentIndices)
            ? state.completedSegmentIndices.length
            : 0;

          setActiveAnalyses(prev => {
            if (!prev[matchId]) return prev;
            return {
              ...prev,
              [matchId]: {
                ...prev[matchId],
                planTotalSegments,
                planCompletedSegments,
              }
            };
          });

          latestResumeState = {
            ...state,
            runtimeStatus: latestRuntimeStatus,
          };
          persistResumeSnapshot(true);
        },
        abortController.signal,
        (runtimeState) => {
          latestRuntimeStatus = runtimeState;
          latestResumeState = {
            ...latestResumeState,
            runtimeStatus: runtimeState,
          };

          setActiveAnalyses(prev => {
            const target = prev[matchId];
            if (!target) return prev;

            const planTotalSegments = runtimeState.totalSegments > 0
              ? Math.max(target.planTotalSegments, runtimeState.totalSegments)
              : target.planTotalSegments;
            const runtimeCompletedSegments = runtimeState.totalSegments > 0
              ? Math.min(runtimeState.totalSegments, runtimeState.segmentIndex)
              : target.planCompletedSegments;
            const planCompletedSegments = Math.max(target.planCompletedSegments, runtimeCompletedSegments);

            return {
              ...prev,
              [matchId]: {
                ...target,
                runtimeStatus: runtimeState,
                planTotalSegments,
                planCompletedSegments,
              }
            };
          });
          persistResumeSnapshot(true);
        },
        analysisRunId,
      );
      
      for await (const chunk of stream) {
        if (abortController.signal.aborted) {
          throw createAbortError();
        }
        if (dropStaleDraftOnFirstChunk) {
          // Avoid duplicated content when resuming from a draft-only snapshot.
          currentThoughts = '';
          dropStaleDraftOnFirstChunk = false;
        }
        currentThoughts += chunk;
        currentParsedStream = stabilizeParsedStream(
          currentParsedStream,
          parseAgentStream(currentThoughts),
        );
        
        // Auto-collapse completed thoughts
        const newCollapsed = { ...currentCollapsed };
        currentParsedStream.segments.forEach(seg => {
          if (seg.isThoughtComplete && !newCollapsed[seg.id]) {
            newCollapsed[seg.id] = true;
          }
        });
        currentCollapsed = newCollapsed;

        commitLivePreview(currentParsedStream, currentCollapsed, false);

        persistResumeSnapshot();
      }
      if (abortController.signal.aborted) {
        throw createAbortError();
      }

      // Final parse after stream completes
      const finalParsed = stabilizeParsedStream(
        currentParsedStream,
        parseAgentStream(currentThoughts),
      );
      
      setActiveAnalyses(prev => {
        const target = prev[matchId];
        if (!target) return prev;
        const nextParsed = stabilizeParsedStream(target.parsedStream, finalParsed);

        return {
          ...prev,
          [matchId]: {
            ...target,
            thoughts: currentThoughts,
            parsedStream: nextParsed,
            collapsedSegments: currentCollapsed
          }
        };
      });

      persistResumeSnapshot(true);

      if (finalParsed.summary) {
        const finalAnalysis = finalParsed.summary as MatchAnalysis;
        
        // Update match object with edited names before saving
        const finalMatch = { ...match };
        if (!finalMatch.homeTeam.id) finalMatch.homeTeam.id = 'home';
        if (!finalMatch.awayTeam.id) finalMatch.awayTeam.id = 'away';
        if (dataToAnalyze.homeTeam?.name) finalMatch.homeTeam.name = dataToAnalyze.homeTeam.name;
        if (dataToAnalyze.awayTeam?.name) finalMatch.awayTeam.name = dataToAnalyze.awayTeam.name;
        if (dataToAnalyze.league) finalMatch.league = dataToAnalyze.league;
        if (dataToAnalyze.odds) finalMatch.odds = dataToAnalyze.odds;
        if (dataToAnalyze.customInfo) (finalMatch as any).customInfo = dataToAnalyze.customInfo;
        
        setActiveAnalyses(prev => {
          const target = prev[matchId];
          if (!target) return prev;
          saveHistory(finalMatch, finalAnalysis, finalParsed).catch(console.error);
          
          // Also try to delete from saved matches if it exists (it's now history)
          deleteSavedMatch(matchId).catch(() => {});

          const totalSegments = Math.max(
            target.planTotalSegments,
            target.runtimeStatus?.totalSegments ?? 0,
            target.planCompletedSegments,
          );
          const completedSegments = totalSegments > 0 ? totalSegments : target.planCompletedSegments;

          return {
            ...prev,
            [matchId]: {
              ...target,
              analysis: finalAnalysis,
              isAnalyzing: false,
              planTotalSegments: totalSegments,
              planCompletedSegments: completedSegments,
              runtimeStatus: buildPlannerRuntimeState({
                stage: 'completed',
                runId: target.runtimeStatus?.runId || analysisRunId,
                segmentIndex: completedSegments,
                totalSegments,
                stageLabel: 'Completed',
                progressPercent: 100,
              }),
            }
          };
        });
        
        await clearResumeState(matchId);
      } else {
        setActiveAnalyses(prev => {
          const target = prev[matchId];
          if (!target) return prev;
          const totalSegments = Math.max(
            target.planTotalSegments,
            target.runtimeStatus?.totalSegments ?? 0,
            target.planCompletedSegments,
          );
          const completedSegments = totalSegments > 0 ? totalSegments : target.planCompletedSegments;
          return {
            ...prev,
            [matchId]: {
              ...target,
              isAnalyzing: false,
              planTotalSegments: totalSegments,
              planCompletedSegments: completedSegments,
              runtimeStatus: buildPlannerRuntimeState({
                stage: 'completed',
                runId: target.runtimeStatus?.runId || analysisRunId,
                segmentIndex: completedSegments,
                totalSegments,
                stageLabel: 'Completed',
                progressPercent: 100,
              }),
            }
          };
        });
      }

    } catch (error: any) {
      if (isAbortError(error) || abortController.signal.aborted) {
        const cancelledRuntimeStatus = buildPlannerRuntimeState({
          stage: 'cancelled',
          runId: latestRuntimeStatus?.runId || analysisRunId,
          segmentIndex: latestRuntimeStatus?.segmentIndex ?? latestResumeState.completedSegmentIndices.length,
          totalSegments: latestRuntimeStatus?.totalSegments ?? latestResumeState.plan.length,
          stageLabel: 'Cancelled',
        });
        latestRuntimeStatus = cancelledRuntimeStatus;
        latestResumeState = {
          ...latestResumeState,
          runtimeStatus: cancelledRuntimeStatus,
        };
        persistResumeSnapshot(true);
        setActiveAnalyses(prev => {
          const target = prev[matchId];
          if (!target) return prev;
          return {
            ...prev,
            [matchId]: {
              ...target,
              isAnalyzing: false,
              error: null,
              runtimeStatus: buildPlannerRuntimeState({
                stage: 'cancelled',
                runId: target.runtimeStatus?.runId || analysisRunId,
                segmentIndex: target.runtimeStatus?.segmentIndex ?? target.planCompletedSegments,
                totalSegments: target.runtimeStatus?.totalSegments ?? target.planTotalSegments,
                stageLabel: 'Cancelled',
              }),
            }
          };
        });
        return;
      }

      console.error("Analysis failed:", error);
      const failedRuntimeStatus = buildPlannerRuntimeState({
        stage: 'failed',
        runId: latestRuntimeStatus?.runId || analysisRunId,
        segmentIndex: latestRuntimeStatus?.segmentIndex ?? latestResumeState.completedSegmentIndices.length,
        totalSegments: latestRuntimeStatus?.totalSegments ?? latestResumeState.plan.length,
        stageLabel: 'Failed',
        errorMessage: error.message || "Analysis failed",
      });
      latestRuntimeStatus = failedRuntimeStatus;
      latestResumeState = {
        ...latestResumeState,
        runtimeStatus: failedRuntimeStatus,
      };
      persistResumeSnapshot(true);
      setActiveAnalyses(prev => {
        const target = prev[matchId];
        if (!target) return prev;
        return {
          ...prev,
          [matchId]: {
            ...target,
            error: error.message || "Analysis failed",
            isAnalyzing: false,
            thoughts: target.thoughts + "\n\n[ERROR] Analysis failed. Please try again.",
            runtimeStatus: buildPlannerRuntimeState({
              stage: 'failed',
              runId: target.runtimeStatus?.runId || analysisRunId,
              segmentIndex: target.runtimeStatus?.segmentIndex ?? target.planCompletedSegments,
              totalSegments: target.runtimeStatus?.totalSegments ?? target.planTotalSegments,
              stageLabel: 'Failed',
              errorMessage: error.message || "Analysis failed",
            }),
          }
        };
      });
    } finally {
      if (analysisAbortControllersRef.current[matchId] === abortController) {
        delete analysisAbortControllersRef.current[matchId];
      }
    }
  }, []);

  return (
    <AnalysisContext.Provider value={{ activeAnalyses, startAnalysis, stopAnalysis, clearActiveAnalysis, setCollapsedSegments }}>
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis() {
  const context = useContext(AnalysisContext);
  if (context === undefined) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
}
