import {
  resolveImmediateAnalysisNavigation,
} from '@/src/services/automation/commandCenter';
import { activateAutomationDraft } from '@/src/services/automation/activation';
import {
  deleteAutomationDraft,
  getAutomationDraft,
  saveAutomationDraft,
  saveAutomationDrafts,
} from '@/src/services/automation/draftStore';
import {
  ensureExecutionTicketForDraft,
  patchExecutionTicket,
} from '@/src/services/manager-workspace/executionTicketStore';
import {
  applyClarificationAnswer,
  getNextClarificationQuestion,
} from '@/src/services/automation/clarification';
import { DEFAULT_DOMAIN_ID } from '@/src/services/domains/builtinModules';
import { createManagerSessionStore } from '@/src/services/manager-gateway/sessionStore';
import { projectManagerSessionProjectionToLegacySnapshot } from '@/src/services/manager-gateway/legacyCompat';
import { getManagerGateway } from '@/src/services/manager-gateway/service';
import type { ManagerSessionProjection } from '@/src/services/manager-gateway/types';
import { getSettings } from '@/src/services/settings';
import type {
  ManagerConversationAction,
  ManagerConversationMessage,
  ManagerLanguage,
  ManagerSessionResult,
  ManagerSessionSnapshot,
} from './types';

interface MainSessionRef {
  domainId?: string;
  title?: string;
}

export interface ManagerProjectionActionResult {
  projection: ManagerSessionProjection;
  feedbackMessage?: string;
  shouldRefreshTaskState: boolean;
  navigation?: ManagerSessionResult['navigation'];
}

function createMessage(
  role: ManagerConversationMessage['role'],
  kind: ManagerConversationMessage['kind'],
  text: string,
  options?: {
    createdAt?: number;
    draftIds?: string[];
    action?: ManagerConversationAction;
  },
): ManagerConversationMessage {
  const createdAt = options?.createdAt ?? Date.now();
  const draftIds =
    options?.draftIds && options.draftIds.length > 0
      ? Array.from(new Set(options.draftIds))
      : undefined;

  return {
    id: `${role}_${createdAt}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    kind,
    text,
    createdAt,
    draftIds,
    action: options?.action,
  };
}

function buildInitialAgentMessage(language: ManagerLanguage): ManagerConversationMessage {
  return createMessage(
    'agent',
    'text',
    language === 'zh'
      ? '总管 Agent 已就位。你可以直接问“今天有哪些比赛”，也可以说“今晚 20:00 分析皇马 vs 巴萨”。我会先查本地同步数据，再在对话里安排分析任务。'
      : 'The manager agent is ready. Ask what matches are on today, or tell me which match to analyze and when. I will query local synced data first, then arrange the analysis task in the conversation.',
    {
      createdAt: 0,
    },
  );
}

function buildInitialSnapshot(language: ManagerLanguage): ManagerSessionSnapshot {
  return {
    messages: [buildInitialAgentMessage(language)],
    pendingTask: null,
  };
}

function buildSnapshotFromProjection(
  projection: ManagerSessionProjection,
  language: ManagerLanguage,
): ManagerSessionSnapshot {
  const snapshot = projectManagerSessionProjectionToLegacySnapshot(projection);
  if (snapshot.messages.length > 0 || snapshot.pendingTask) {
    return snapshot;
  }
  return buildInitialSnapshot(language);
}

function buildPayloadData(message: ManagerConversationMessage): string | null {
  const payload =
    message.kind === 'draft_bundle' || message.action
      ? {
          draftIds: message.draftIds,
          action: message.action,
        }
      : null;

  return payload ? JSON.stringify(payload) : null;
}

function mapMessageRole(
  role: ManagerConversationMessage['role'],
): 'user' | 'assistant' | 'system' {
  return role === 'user' ? 'user' : 'assistant';
}

function mapMessageBlockType(
  message: ManagerConversationMessage,
):
  | 'user_text'
  | 'assistant_text'
  | 'draft_bundle' {
  if (message.role === 'user') {
    return 'user_text';
  }
  return message.kind === 'draft_bundle' ? 'draft_bundle' : 'assistant_text';
}

function parseDraftIdsFromPayloadData(payloadData: string | null | undefined): string[] {
  if (!payloadData) {
    return [];
  }

  try {
    const parsed = JSON.parse(payloadData);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [];
    }

    return Array.isArray((parsed as { draftIds?: unknown }).draftIds)
      ? ((parsed as { draftIds: unknown[] }).draftIds).filter(
          (draftId): draftId is string => typeof draftId === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

function getLatestDraftBundleIds(projection: ManagerSessionProjection): string[] {
  const latestBundle = [...projection.feed]
    .reverse()
    .find(
      (block) =>
        block.blockType === 'draft_bundle' &&
        parseDraftIdsFromPayloadData(block.payloadData).length > 0,
    );

  return latestBundle ? parseDraftIdsFromPayloadData(latestBundle.payloadData) : [];
}

function defaultMainSessionRef(): MainSessionRef {
  const settings = getSettings();
  return {
    domainId: settings.activeDomainId || DEFAULT_DOMAIN_ID,
  };
}

async function loadMainProjection(
  session: MainSessionRef = {},
): Promise<ManagerSessionProjection> {
  const gateway = getManagerGateway();
  const defaults = defaultMainSessionRef();
  return gateway.getOrCreateMainSession({
    domainId: session.domainId || defaults.domainId,
    title: session.title,
  });
}

async function appendConversationMessages(args: {
  messages: ManagerConversationMessage[];
  session?: MainSessionRef;
}): Promise<ManagerSessionProjection> {
  if (args.messages.length === 0) {
    return loadMainProjection(args.session);
  }

  const gateway = getManagerGateway();
  const projection = await loadMainProjection(args.session);
  const store = createManagerSessionStore();
  if (!store.appendMessage) {
    throw new Error('Manager runtime requires a mutable session store.');
  }

  for (const message of args.messages) {
    await store.appendMessage({
      sessionId: projection.session.id,
      role: mapMessageRole(message.role),
      blockType: mapMessageBlockType(message),
      text: message.text,
      payloadData: buildPayloadData(message),
      createdAt: message.createdAt,
    });
  }

  return (await gateway.loadSessionProjection(projection.session.id)) || projection;
}

function buildProjectionActionResult(
  projection: ManagerSessionProjection,
  extras?: {
    feedbackMessage?: string;
    shouldRefreshTaskState?: boolean;
    navigation?: ManagerSessionResult['navigation'];
  },
): ManagerProjectionActionResult {
  return {
    projection,
    feedbackMessage: extras?.feedbackMessage,
    shouldRefreshTaskState: extras?.shouldRefreshTaskState ?? false,
    navigation: extras?.navigation,
  };
}

function buildLegacySessionResult(
  projection: ManagerSessionProjection,
  language: ManagerLanguage,
  extras?: {
    feedbackMessage?: string;
    shouldRefreshTaskState?: boolean;
    navigation?: ManagerSessionResult['navigation'];
  },
): ManagerSessionResult {
  return {
    ...buildSnapshotFromProjection(projection, language),
    feedbackMessage: extras?.feedbackMessage,
    shouldRefreshTaskState: extras?.shouldRefreshTaskState ?? false,
    navigation: extras?.navigation,
  };
}

function buildDraftActivationMessage(args: {
  draft: {
    title: string;
    intentType: 'one_time' | 'recurring';
    activationMode: 'save_only' | 'run_now';
  };
  activationKind: 'job' | 'rule';
  language: ManagerLanguage;
}): string {
  const { draft, activationKind, language } = args;

  if (language === 'zh') {
    if (draft.activationMode === 'run_now' && activationKind === 'job') {
      return `总管已确认“${draft.title}”，正式任务已拉起并开始执行。`;
    }

    if (activationKind === 'rule' || draft.intentType === 'recurring') {
      return `总管已启用周期规则“${draft.title}”。`;
    }

    return `总管已安排定时任务“${draft.title}”。`;
  }

  if (draft.activationMode === 'run_now' && activationKind === 'job') {
    return `The manager confirmed "${draft.title}" and started the formal task.`;
  }

  if (activationKind === 'rule' || draft.intentType === 'recurring') {
    return `The manager enabled recurring rule "${draft.title}".`;
  }

  return `The manager scheduled "${draft.title}".`;
}

export async function submitManagerTurnProjectionResult(args: {
  input: string;
  language: ManagerLanguage;
  domainId: string;
  domainName: string;
  allowHeuristicFallback?: boolean;
}): Promise<ManagerProjectionActionResult> {
  const gateway = getManagerGateway();
  const result = await gateway.submitMainSessionTurn({
    input: args.input,
    language: args.language,
    domainId: args.domainId,
    title: args.domainName,
    allowHeuristicFallback: args.allowHeuristicFallback,
  });
  const draftsToSave = Array.isArray(result.diagnostics?.draftsToSave)
    ? (result.diagnostics.draftsToSave as Parameters<typeof saveAutomationDrafts>[0])
    : [];

  if (draftsToSave.length > 0) {
    await saveAutomationDrafts(draftsToSave);
    await Promise.all(
      draftsToSave
        .filter((draft) => draft.status === 'ready')
        .map((draft) =>
          ensureExecutionTicketForDraft({
            draft,
            source: 'command_center',
          }),
        ),
    );
  }

  return buildProjectionActionResult(result.projection, {
    feedbackMessage: result.feedbackMessage,
    shouldRefreshTaskState: result.shouldRefreshTaskState,
    navigation: result.navigationIntent as ManagerSessionResult['navigation'],
  });
}

export async function submitManagerTurn(args: {
  input: string;
  language: ManagerLanguage;
  domainId: string;
  domainName: string;
  allowHeuristicFallback?: boolean;
}): Promise<ManagerSessionResult> {
  const result = await submitManagerTurnProjectionResult(args);
  return buildLegacySessionResult(result.projection, args.language, result);
}

export async function syncManagerConversationWithDraftsProjectionResult(args: {
  language: ManagerLanguage;
  draftIds: string[];
  session?: MainSessionRef;
}): Promise<ManagerProjectionActionResult> {
  const currentProjection = await loadMainProjection(args.session);
  if (args.draftIds.length === 0) {
    return buildProjectionActionResult(currentProjection);
  }

  const latestIds = getLatestDraftBundleIds(currentProjection);
  const alreadyCovered = args.draftIds.every((draftId) => latestIds.includes(draftId));
  if (alreadyCovered) {
    return buildProjectionActionResult(currentProjection);
  }

  const reminderText =
    args.language === 'zh'
      ? `当前还有 ${args.draftIds.length} 张待处理卡片，我已经继续放在对话里。`
      : `There are still ${args.draftIds.length} pending card(s), and I have kept them in the conversation.`;

  const projection = await appendConversationMessages({
    session: args.session,
    messages: [
      createMessage('agent', 'draft_bundle', reminderText, {
        draftIds: args.draftIds,
      }),
    ],
  });

  return buildProjectionActionResult(projection);
}

export async function syncManagerConversationWithDrafts(args: {
  language: ManagerLanguage;
  draftIds: string[];
}): Promise<ManagerSessionSnapshot> {
  const result = await syncManagerConversationWithDraftsProjectionResult(args);
  return buildSnapshotFromProjection(result.projection, args.language);
}

export async function submitManagerClarificationAnswerProjectionResult(args: {
  draftId: string;
  answer: string;
  language: ManagerLanguage;
  session?: MainSessionRef;
}): Promise<ManagerProjectionActionResult> {
  const normalizedAnswer = args.answer.trim();
  const currentProjection = await loadMainProjection(args.session);
  const draft = await getAutomationDraft(args.draftId);

  if (!draft || !normalizedAnswer) {
    return buildProjectionActionResult(currentProjection);
  }

  const question = getNextClarificationQuestion(draft, args.language);
  const nextDraft = applyClarificationAnswer(draft, normalizedAnswer);
  await saveAutomationDraft(nextDraft);

  const createdAt = Date.now();
  const projection = await appendConversationMessages({
    session: args.session,
    messages: [
      createMessage(
        'user',
        'text',
        question ? `${question.prompt} ${normalizedAnswer}` : normalizedAnswer,
        {
          createdAt,
        },
      ),
      createMessage(
        'agent',
        'draft_bundle',
        nextDraft.status === 'ready'
          ? args.language === 'zh'
            ? '总管已经补全这张卡片，现在可以直接确认执行。'
            : 'The manager has completed this card. It is now ready to confirm.'
          : args.language === 'zh'
            ? '总管已经更新这张卡片，但还需要你再补充一步。'
            : 'The manager updated this card, but still needs one more detail.',
        {
          createdAt: createdAt + 1,
          draftIds: [nextDraft.id],
        },
      ),
    ],
  });

  return buildProjectionActionResult(projection, {
    feedbackMessage: args.language === 'zh' ? '任务草稿已更新。' : 'Draft updated.',
    shouldRefreshTaskState: true,
  });
}

export async function submitManagerClarificationAnswer(args: {
  draftId: string;
  answer: string;
  language: ManagerLanguage;
}): Promise<ManagerSessionResult> {
  const result = await submitManagerClarificationAnswerProjectionResult(args);
  return buildLegacySessionResult(result.projection, args.language, result);
}

export async function submitManagerDraftDeletionProjectionResult(args: {
  draftId: string;
  language: ManagerLanguage;
  session?: MainSessionRef;
}): Promise<ManagerProjectionActionResult> {
  const currentProjection = await loadMainProjection(args.session);
  const draft = await getAutomationDraft(args.draftId);
  await deleteAutomationDraft(args.draftId);

  const projection = await appendConversationMessages({
    session: args.session,
    messages: [
      createMessage(
        'agent',
        'text',
        args.language === 'zh'
          ? `总管已移除${draft?.title ? `“${draft.title}”` : '这张'}草稿卡片。`
          : `The manager removed ${draft?.title ? `"${draft.title}"` : 'that'} draft card.`,
      ),
    ],
  });

  return buildProjectionActionResult(projection || currentProjection, {
    feedbackMessage: args.language === 'zh' ? '草稿已删除。' : 'Draft deleted.',
    shouldRefreshTaskState: true,
  });
}

export async function submitManagerDraftDeletion(args: {
  draftId: string;
  language: ManagerLanguage;
}): Promise<ManagerSessionResult> {
  const result = await submitManagerDraftDeletionProjectionResult(args);
  return buildLegacySessionResult(result.projection, args.language, result);
}

export async function submitManagerDraftActivationProjectionResult(args: {
  draftId: string;
  language: ManagerLanguage;
  session?: MainSessionRef;
}): Promise<ManagerProjectionActionResult> {
  const currentProjection = await loadMainProjection(args.session);
  const draft = await getAutomationDraft(args.draftId);

  if (!draft) {
    return buildProjectionActionResult(currentProjection);
  }

  if (false && draft.activationMode === 'run_now') {
    const ticket = await ensureExecutionTicketForDraft({
      draft,
      source: 'command_center',
    });
    const result = await resolveImmediateAnalysisNavigation(draft, args.language);
    if (result.status !== 'ready' || !result.navigation) {
      const projection = await appendConversationMessages({
        session: args.session,
        messages: [
          createMessage(
            'agent',
            'text',
            result.message ||
              (args.language === 'zh'
                ? '这条指令暂时还不能直接执行立即分析。'
                : 'This command cannot run as an immediate analysis yet.'),
          ),
        ],
      });

      return buildProjectionActionResult(projection, {
        feedbackMessage: result.message,
      });
    }

    await patchExecutionTicket({
      ticketId: ticket.id,
      patch: {
        status: 'confirmed',
      },
    });
    await deleteAutomationDraft(args.draftId);
    const projection = await appendConversationMessages({
      session: args.session,
      messages: [
        createMessage(
          'agent',
          'text',
          args.language === 'zh'
            ? `总管已确认“${draft.title}”，现在开始跳转并启动分析。`
            : `The manager confirmed "${draft.title}" and is starting the analysis now.`,
        ),
      ],
    });

    return buildProjectionActionResult(projection, {
      navigation: result.navigation,
      shouldRefreshTaskState: true,
    });
  }

  const ticket = await ensureExecutionTicketForDraft({
    draft,
    source: 'command_center',
  });
  const activationResult = await activateAutomationDraft(draft);
  await patchExecutionTicket({
    ticketId: ticket.id,
    patch: {
      status: 'confirmed',
      jobId: activationResult.kind === 'job' ? activationResult.job.id : undefined,
    },
  });
  await deleteAutomationDraft(args.draftId);
  const { kickAutomationRuntime } = await import('@/src/services/automation/runtimeCoordinator');
  kickAutomationRuntime('draft_activated');

  {
    const projection = await appendConversationMessages({
      session: args.session,
      messages: [
        createMessage(
          'agent',
          'text',
          buildDraftActivationMessage({
            draft,
            activationKind: activationResult.kind,
            language: args.language,
          }),
        ),
      ],
    });

    return buildProjectionActionResult(projection, {
      shouldRefreshTaskState: true,
    });
  }

  const projection = await appendConversationMessages({
    session: args.session,
    messages: [
      createMessage(
        'agent',
        'text',
        args.language === 'zh'
          ? draft.intentType === 'recurring'
            ? `总管已启用周期规则“${draft.title}”。`
            : `总管已安排定时任务“${draft.title}”。`
          : draft.intentType === 'recurring'
            ? `The manager enabled recurring rule "${draft.title}".`
            : `The manager scheduled "${draft.title}".`,
      ),
    ],
  });

  return buildProjectionActionResult(projection, {
    shouldRefreshTaskState: true,
  });
}

export async function submitManagerDraftActivation(args: {
  draftId: string;
  language: ManagerLanguage;
}): Promise<ManagerSessionResult> {
  const result = await submitManagerDraftActivationProjectionResult(args);
  return buildLegacySessionResult(result.projection, args.language, result);
}
