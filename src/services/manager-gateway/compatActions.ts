import type { ManagerLanguage, ManagerSessionResult } from '@/src/services/manager/types';
import {
  submitManagerClarificationAnswerProjectionResult,
  submitManagerDraftActivationProjectionResult,
  submitManagerDraftDeletionProjectionResult,
  submitManagerTurnProjectionResult,
  syncManagerConversationWithDraftsProjectionResult,
} from '@/src/services/manager/runtime';
import { getManagerGateway } from './service';
import type { ManagerSessionProjection } from './types';

export interface GatewayBackedManagerActionResult {
  projection: ManagerSessionProjection;
  feedbackMessage?: string;
  shouldRefreshTaskState: boolean;
  navigation?: ManagerSessionResult['navigation'];
  outcome?: 'cancelled' | 'interrupt_requested' | 'not_supported' | 'noop';
  runId?: string;
}

interface GatewayBackedManagerSessionRef {
  domainId?: string;
  title?: string;
}

async function loadGatewayProjection(
  session: GatewayBackedManagerSessionRef,
): Promise<ManagerSessionProjection> {
  return getManagerGateway().getOrCreateMainSession({
    domainId: session.domainId,
    title: session.title,
  });
}

export async function loadGatewayBackedManagerMainProjection(
  session: GatewayBackedManagerSessionRef,
): Promise<ManagerSessionProjection> {
  return loadGatewayProjection(session);
}

export async function cancelGatewayBackedManagerRun(args: {
  sessionId?: string;
  domainId?: string;
  title?: string;
  mode?: 'auto' | 'running' | 'queued';
}): Promise<GatewayBackedManagerActionResult> {
  const gateway = getManagerGateway();
  const projection = args.sessionId
    ? await gateway.loadSessionProjection(args.sessionId)
    : await loadGatewayProjection({
        domainId: args.domainId,
        title: args.title,
      });

  if (!projection) {
    throw new Error('Manager session was not found for cancellation.');
  }

  const result = await gateway.cancelSessionRun(projection.session.id, {
    mode: args.mode,
  });
  return {
    projection: result.projection,
    feedbackMessage: result.feedbackMessage,
    shouldRefreshTaskState: false,
    outcome: result.outcome,
    runId: result.runId,
  };
}

export async function submitGatewayBackedManagerTurn(args: {
  input: string;
  language: ManagerLanguage;
  domainId: string;
  title: string;
  allowHeuristicFallback?: boolean;
}): Promise<GatewayBackedManagerActionResult> {
  return submitManagerTurnProjectionResult({
    input: args.input,
    language: args.language,
    domainId: args.domainId,
    domainName: args.title,
    allowHeuristicFallback: args.allowHeuristicFallback,
  });
}

export async function syncGatewayBackedManagerConversationWithDrafts(args: {
  language: ManagerLanguage;
  draftIds: string[];
  domainId?: string;
  title?: string;
}): Promise<GatewayBackedManagerActionResult> {
  return syncManagerConversationWithDraftsProjectionResult({
    language: args.language,
    draftIds: args.draftIds,
    session: {
      domainId: args.domainId,
      title: args.title,
    },
  });
}

export async function submitGatewayBackedManagerClarificationAnswer(args: {
  draftId: string;
  answer: string;
  language: ManagerLanguage;
  domainId?: string;
  title?: string;
}): Promise<GatewayBackedManagerActionResult> {
  return submitManagerClarificationAnswerProjectionResult({
    draftId: args.draftId,
    answer: args.answer,
    language: args.language,
    session: {
      domainId: args.domainId,
      title: args.title,
    },
  });
}

export async function submitGatewayBackedManagerDraftActivation(args: {
  draftId: string;
  language: ManagerLanguage;
  domainId?: string;
  title?: string;
}): Promise<GatewayBackedManagerActionResult> {
  return submitManagerDraftActivationProjectionResult({
    draftId: args.draftId,
    language: args.language,
    session: {
      domainId: args.domainId,
      title: args.title,
    },
  });
}

export async function submitGatewayBackedManagerDraftDeletion(args: {
  draftId: string;
  language: ManagerLanguage;
  domainId?: string;
  title?: string;
}): Promise<GatewayBackedManagerActionResult> {
  return submitManagerDraftDeletionProjectionResult({
    draftId: args.draftId,
    language: args.language,
    session: {
      domainId: args.domainId,
      title: args.title,
    },
  });
}
