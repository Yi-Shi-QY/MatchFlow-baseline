import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getActiveAnalysisDomain } from '@/src/services/domains/registry';
import { resolveRuntimeManagerHelpText } from '@/src/services/manager/runtimeIntentRouter';
import {
  cancelGatewayBackedManagerRun,
  type GatewayBackedManagerActionResult,
  loadGatewayBackedManagerMainProjection,
  submitGatewayBackedManagerTurn,
  submitGatewayBackedManagerClarificationAnswer,
  submitGatewayBackedManagerDraftActivation,
  submitGatewayBackedManagerDraftDeletion,
  syncGatewayBackedManagerConversationWithDrafts,
} from '@/src/services/manager-gateway/compatActions';
import type { ManagerSessionProjection } from '@/src/services/manager-gateway/types';
import { buildManagerWorkspaceProjection } from '@/src/services/manager-workspace/projection';
import { useAutomationTaskState } from '@/src/pages/automation/useAutomationTaskState';
import { withWorkspaceBackContext } from '@/src/services/navigation/workspaceBackNavigation';
import {
  createCommandCenterWelcomeFeed,
  projectManagerSessionProjectionToCommandCenterFeed,
} from './feedAdapter';
import {
  deriveCommandCenterHomeLayout,
  type CommandCenterContinueAction,
  type CommandCenterSuggestionChip,
} from './homeLayoutModel';

function isAbortLikeError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

export function shouldNavigateCommandCenterActionResult(
  result: Pick<GatewayBackedManagerActionResult, 'navigation'>,
  options?: {
    navigateOnSuccess?: boolean;
  },
): boolean {
  if (options?.navigateOnSuccess === false) {
    return false;
  }

  if (options?.navigateOnSuccess === true) {
    return Boolean(result.navigation);
  }

  return Boolean(result.navigation);
}

export function useCommandCenterState(language: 'zh' | 'en') {
  const navigate = useNavigate();
  const activeDomain = getActiveAnalysisDomain();
  const taskState = useAutomationTaskState(language);
  const [commandText, setCommandText] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isCancellingRun, setIsCancellingRun] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [projection, setProjection] = React.useState<ManagerSessionProjection | null>(null);

  const fallbackFeedItems = React.useMemo(
    () => createCommandCenterWelcomeFeed(language, activeDomain.id),
    [activeDomain.id, language],
  );
  const composerPlaceholder = React.useMemo(
    () =>
      resolveRuntimeManagerHelpText({
        domainId: activeDomain.id,
        language,
      }),
    [activeDomain.id, language],
  );

  const feedItems = React.useMemo(() => {
    const projectedFeed = projectManagerSessionProjectionToCommandCenterFeed(projection);
    return projectedFeed.length > 0 ? projectedFeed : fallbackFeedItems;
  }, [fallbackFeedItems, projection]);
  const workspaceProjection = React.useMemo(
    () =>
      buildManagerWorkspaceProjection({
        managerProjection: projection,
        drafts: taskState.drafts,
        jobs: taskState.jobs,
        runs: taskState.runs,
        executionTickets: taskState.executionTickets,
        memoryCandidates: [],
      }),
    [
      projection,
      taskState.drafts,
      taskState.executionTickets,
      taskState.jobs,
      taskState.runs,
    ],
  );
  const homeLayout = React.useMemo(
    () =>
      deriveCommandCenterHomeLayout({
        workspaceProjection,
        language,
        domainId: activeDomain.id,
      }),
    [activeDomain.id, language, workspaceProjection],
  );

  const handleCommandTextChange = React.useCallback((value: string) => {
    setCommandText(value);
    setSubmitError(null);
  }, []);

  const scrollToElement = React.useCallback((elementId: string) => {
    if (typeof document === 'undefined') {
      return;
    }

    document.getElementById(elementId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, []);

  const applyActionResult = React.useCallback(
    async (
      result: GatewayBackedManagerActionResult,
      options?: {
        clearCommandText?: boolean;
        navigateOnSuccess?: boolean;
      },
    ) => {
      setProjection(result.projection);
      if (options?.clearCommandText) {
        setCommandText('');
      }
      if (result.shouldRefreshTaskState) {
        await taskState.refreshAll();
      }
      if (shouldNavigateCommandCenterActionResult(result, options) && result.navigation) {
        navigate(result.navigation.route, {
          state: withWorkspaceBackContext(result.navigation.state, '/'),
        });
      }
    },
    [navigate, taskState],
  );

  const refreshProjection = React.useCallback(async () => {
    return loadGatewayBackedManagerMainProjection({
      domainId: activeDomain.id,
      title: activeDomain.name,
    });
  }, [activeDomain.id, activeDomain.name]);

  React.useEffect(() => {
    let cancelled = false;

    setProjection(null);

    void refreshProjection()
      .then((nextProjection) => {
        if (cancelled) {
          return;
        }
        setProjection(nextProjection);
      })
      .catch((error) => {
        console.error('Failed to load command center projection', error);
      });

    return () => {
      cancelled = true;
    };
  }, [language, refreshProjection]);

  React.useEffect(() => {
    let cancelled = false;

    void syncGatewayBackedManagerConversationWithDrafts({
      language,
      draftIds: taskState.drafts.map((draft) => draft.id),
      domainId: activeDomain.id,
      title: activeDomain.name,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setProjection(result.projection);
      })
      .catch((error) => {
        console.error('Failed to sync command center drafts with projection', error);
      });

    return () => {
      cancelled = true;
    };
  }, [activeDomain.id, activeDomain.name, language, taskState.drafts]);

  React.useEffect(() => {
    let cancelled = false;
    let isRefreshing = false;
    const intervalMs = isSubmitting || projection?.activeRun ? 900 : 2500;
    const pollProjection = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }

      if (isRefreshing) {
        return;
      }

      isRefreshing = true;
      try {
        const nextProjection = await refreshProjection();
        if (!cancelled) {
          setProjection(nextProjection);
        }
      } catch (error) {
        console.error('Failed to poll command center projection', error);
      } finally {
        isRefreshing = false;
      }
    };

    void pollProjection();
    const timerId = window.setInterval(() => {
      void pollProjection();
    }, intervalMs);
    const canObserveVisibility = typeof document !== 'undefined';
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void pollProjection();
      }
    };
    if (canObserveVisibility) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
      if (canObserveVisibility) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [
    isSubmitting,
    projection?.activeRun?.id,
    projection?.activeRun?.status,
    refreshProjection,
  ]);

  React.useEffect(() => {
    if (!isCancellingRun) {
      return;
    }

    if (projection?.activeRun?.status !== 'running') {
      setIsCancellingRun(false);
    }
  }, [isCancellingRun, projection?.activeRun?.status]);

  const handleParseCommand = React.useCallback(async () => {
    const normalized = commandText.trim();
    if (!normalized) {
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const result = await submitGatewayBackedManagerTurn({
        input: normalized,
        language,
        domainId: activeDomain.id,
        title: activeDomain.name,
        allowHeuristicFallback: false,
      });
      await applyActionResult(result, {
        clearCommandText: true,
      });
    } catch (error) {
      console.error('Failed to submit command center turn', error);
      if (!isAbortLikeError(error)) {
        setSubmitError(error instanceof Error ? error.message : String(error));
      }
      try {
        const nextProjection = await refreshProjection();
        setProjection(nextProjection);
      } catch (refreshError) {
        console.error('Failed to refresh command center projection after submit error', refreshError);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeDomain.id,
    activeDomain.name,
    commandText,
    language,
    taskState,
  ]);

  const handleClarificationAnswer = React.useCallback(
    async (draftId: string, answer: string) => {
      const result = await submitGatewayBackedManagerClarificationAnswer({
        draftId,
        answer,
        language,
        domainId: activeDomain.id,
        title: activeDomain.name,
      });
      await applyActionResult(result);
    },
    [activeDomain.id, activeDomain.name, applyActionResult, language],
  );

  const handleActivateDraft = React.useCallback(
    async (draftId: string) => {
      const result = await submitGatewayBackedManagerDraftActivation({
        draftId,
        language,
        domainId: activeDomain.id,
        title: activeDomain.name,
      });
      await applyActionResult(result, {
        navigateOnSuccess: true,
      });
    },
    [activeDomain.id, activeDomain.name, applyActionResult, language],
  );

  const handleDeleteDraft = React.useCallback(
    async (draftId: string) => {
      const result = await submitGatewayBackedManagerDraftDeletion({
        draftId,
        language,
        domainId: activeDomain.id,
        title: activeDomain.name,
      });
      await applyActionResult(result);
    },
    [activeDomain.id, activeDomain.name, applyActionResult, language],
  );

  const handleOpenSettings = React.useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  const handleOpenAutomationEventRoute = React.useCallback(
    (route: string) => {
      navigate(route, {
        state: withWorkspaceBackContext(undefined, '/'),
      });
    },
    [navigate],
  );

  const handleContinueAction = React.useCallback(
    async (action: CommandCenterContinueAction) => {
      if (action.type === 'activate_draft') {
        await handleActivateDraft(action.draftId);
        return;
      }

      if (action.type === 'focus_draft') {
        scrollToElement(`automation-draft-${action.draftId}`);
        return;
      }

      if (action.type === 'focus_run_status') {
        scrollToElement('command-center-run-status');
        return;
      }

      scrollToElement('command-center-conversation');
    },
    [handleActivateDraft, scrollToElement],
  );

  const handleSuggestionSelect = React.useCallback(
    (chip: CommandCenterSuggestionChip) => {
      handleCommandTextChange(chip.fillText);
    },
    [handleCommandTextChange],
  );

  const handleOpenConversation = React.useCallback(() => {
    scrollToElement('command-center-conversation');
  }, [scrollToElement]);

  const handleCancelRun = React.useCallback(async () => {
    const sessionId = projection?.session.id;
    if (!sessionId) {
      return;
    }

    setSubmitError(null);
    setIsCancellingRun(true);
    let shouldKeepCancellingState = false;
    try {
      const result = await cancelGatewayBackedManagerRun({
        sessionId,
        domainId: activeDomain.id,
        title: activeDomain.name,
        mode: projection?.activeRun?.status === 'running' ? 'running' : 'auto',
      });
      setProjection(result.projection);
      shouldKeepCancellingState = result.outcome === 'interrupt_requested';
    } catch (error) {
      console.error('Failed to cancel queued manager run', error);
      setSubmitError(error instanceof Error ? error.message : String(error));
      try {
        const nextProjection = await refreshProjection();
        setProjection(nextProjection);
      } catch (refreshError) {
        console.error('Failed to refresh command center projection after cancel error', refreshError);
      }
    } finally {
      if (!shouldKeepCancellingState) {
        setIsCancellingRun(false);
      }
    }
  }, [
    activeDomain.id,
    activeDomain.name,
    projection?.session.id,
    refreshProjection,
  ]);

  return {
    commandText,
    setCommandText: handleCommandTextChange,
    isSubmitting,
    isCancellingRun,
    submitError,
    projection,
    feedItems,
    drafts: taskState.drafts,
    executionTickets: taskState.executionTickets,
    homeLayout,
    composerPlaceholder,
    handleParseCommand,
    handleClarificationAnswer,
    handleActivateDraft,
    handleDeleteDraft,
    handleOpenSettings,
    handleOpenAutomationEventRoute,
    handleCancelRun,
    handleContinueAction,
    handleSuggestionSelect,
    handleOpenConversation,
  };
}
