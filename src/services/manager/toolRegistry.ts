import { Type, type FunctionDeclaration } from '@google/genai';
import type { Match } from '@/src/data/matches';
import type {
  RuntimeManagerCapability,
  RuntimeTaskIntakeCapability,
  RuntimeTaskIntakeValue,
} from '@/src/domains/runtime/types';
import { extractMatchesFromRuntimeEvents } from '@/src/domains/runtime/sourceQueries';
import {
  finalizeAutomationDraftsForComposer,
  summarizeManagerResponse,
  type AutomationCommandComposerMode,
} from '@/src/services/automation/commandCenter';
import type { AutomationDraft } from '@/src/services/automation/types';
import { DEFAULT_DOMAIN_ID } from '@/src/services/domains/builtinModules';
import { buildManagerIntakePrompt } from '@/src/services/manager-intake/promptBuilder';
import {
  applyManagerIntakeAnswer,
  createManagerIntakeWorkflowState,
} from '@/src/services/manager-intake/runtime';
import type { ManagerIntakeWorkflowState } from '@/src/services/manager-intake/types';
import {
  buildManagerClarificationFollowUp,
  summarizeManagerClarification,
  toManagerClarificationSnapshot,
} from '@/src/services/manager-workspace/clarificationSummary';
import { detectMemoryCandidatesFromManagerInput } from '@/src/services/memoryCandidateDetectors';
import type { MemoryCandidateDetectionMode } from '@/src/services/memoryCandidateTypes';
import { ensureExecutionTicketForDraft } from '@/src/services/manager-workspace/executionTicketStore';
import {
  applyAnalysisProfileToDrafts,
} from '@/src/services/manager-legacy/analysisProfile';
import { resolveDomainEventFeed } from '@/src/services/domainMatchFeed';
import type {
  ManagerConversationEffect,
  ManagerLanguage,
  ManagerPendingTask,
  ManagerSequenceStepId,
  ManagerSourcePreferenceId,
} from './types';

interface ManagerLeagueDescriptor {
  label: string;
  aliases: string[];
}

interface ManagerMatchQueryResolution {
  filters: {
    matchDate?: string;
    statuses?: string[];
    leagueTerms?: string[];
  };
  scopeLabel: string;
}

export interface ManagerToolRuntimeSupport {
  domainId?: string;
  skillIds?: readonly string[];
  taskIntake?: RuntimeTaskIntakeCapability | null;
  plannerHints?: RuntimeManagerCapability['plannerHints'];
}

export type ManagerToolRuntimeSupportResolver = (
  domainId: string,
) => ManagerToolRuntimeSupport | null;

function createAbortError(): Error & { name: string } {
  const error = new Error('Manager tool execution aborted') as Error & { name: string };
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  throw createAbortError();
}

const MANAGER_LEAGUES: ManagerLeagueDescriptor[] = [
  { label: 'Premier League', aliases: ['premier league', 'epl', '英超'] },
  { label: 'La Liga', aliases: ['la liga', '西甲'] },
  { label: 'Serie A', aliases: ['serie a', '意甲'] },
  { label: 'Bundesliga', aliases: ['bundesliga', '德甲'] },
  { label: 'Ligue 1', aliases: ['ligue 1', '法甲'] },
  { label: 'Champions League', aliases: ['champions league', 'ucl', '欧冠'] },
];

const DEFAULT_SOURCE_PREFERENCES: ManagerSourcePreferenceId[] = [
  'fundamental',
  'market',
  'custom',
];

function toLocalDateKey(input: Date): string {
  const year = input.getFullYear();
  const month = `${input.getMonth() + 1}`.padStart(2, '0');
  const day = `${input.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeInput(input: string): string {
  return input.toLowerCase().trim();
}

function buildManagerTurnMemoryCandidates(args: {
  text: string;
  domainId: string;
  detectionMode?: MemoryCandidateDetectionMode;
  recentUserMessages?: string[];
}) {
  return detectMemoryCandidatesFromManagerInput({
    text: args.text,
    domainId: args.domainId,
    detectionMode: args.detectionMode,
    recentUserMessages: args.recentUserMessages,
  });
}

function resolveDefaultDomainId(): string {
  return DEFAULT_DOMAIN_ID;
}

function buildUnsupportedToolEffect(args: {
  domainId: string;
  language: ManagerLanguage;
  support?: ManagerToolRuntimeSupport | null;
  resolveSupport?: ManagerToolRuntimeSupportResolver | null;
}): ManagerConversationEffect {
  return {
    agentText: resolveManagerHelpText(args),
    messageKind: 'text',
    pendingTask: null,
  };
}

function buildMissingTaskIntakeEffect(args: {
  language: ManagerLanguage;
}): ManagerConversationEffect {
  const agentText =
    args.language === 'zh'
      ? '当前没有可继续的任务收集流程。请先直接告诉我你想分析什么，以及何时执行。'
      : 'There is no active task intake to continue. Tell me what to analyze and when to run it first.';

  return {
    agentText,
    messageKind: 'text',
    pendingTask: null,
    intakeWorkflow: null,
    feedbackMessage: agentText,
  };
}

function ensureSupportedManagerTool(args: {
  domainId: string;
  language: ManagerLanguage;
  toolId: string;
  support?: ManagerToolRuntimeSupport | null;
  resolveSupport?: ManagerToolRuntimeSupportResolver | null;
}): ManagerConversationEffect | null {
  const support = resolveManagerSupport(args);
  if (!Array.isArray(support?.skillIds) || support.skillIds.includes(args.toolId)) {
    return null;
  }

  return buildUnsupportedToolEffect({
    domainId: args.domainId,
    language: args.language,
    support,
    resolveSupport: args.resolveSupport,
  });
}

function buildFallbackHelpText(language: ManagerLanguage): string {
  return language === 'zh'
    ? '你可以直接问我今天有哪些比赛，或者说“今晚 20:00 分析皇马 vs 巴萨”“每天 09:00 分析英超”。我会先在对话里确认分析因素和顺序，再生成任务卡片。'
    : 'Ask what matches are on today, or tell me which match or league to analyze and when. I will confirm the analysis factors and sequence in chat before creating task cards.';
}

function resolveManagerSupport(args: {
  domainId?: string | null;
  support?: ManagerToolRuntimeSupport | null;
  resolveSupport?: ManagerToolRuntimeSupportResolver | null;
}): ManagerToolRuntimeSupport | null {
  const domainId =
    typeof args.domainId === 'string' && args.domainId.trim().length > 0
      ? args.domainId.trim()
      : null;

  if (domainId && typeof args.resolveSupport === 'function') {
    const resolved = args.resolveSupport(domainId);
    if (resolved) {
      return resolved;
    }
  }

  if (!args.support) {
    return null;
  }

  if (!domainId || !args.support.domainId || args.support.domainId === domainId) {
    return args.support;
  }

  return null;
}

function readPlannerHint(
  support: ManagerToolRuntimeSupport | null,
  language: ManagerLanguage,
  key: 'helpText' | 'factorsText' | 'sequenceText',
): string | null {
  const text = support?.plannerHints?.[key]?.[language];
  return typeof text === 'string' && text.trim().length > 0 ? text.trim() : null;
}

function resolveManagerHelpText(args: {
  domainId?: string | null;
  language: ManagerLanguage;
  support?: ManagerToolRuntimeSupport | null;
  resolveSupport?: ManagerToolRuntimeSupportResolver | null;
}): string {
  const support = resolveManagerSupport(args);
  const taskIntakeText = support?.taskIntake?.describeTopic?.({
    topic: 'help',
    language: args.language,
  });
  if (typeof taskIntakeText === 'string' && taskIntakeText.trim().length > 0) {
    return taskIntakeText.trim();
  }

  return readPlannerHint(support, args.language, 'helpText') || buildFallbackHelpText(args.language);
}

function resolveManagerCapabilityText(args: {
  domainId?: string | null;
  language: ManagerLanguage;
  topic: 'factors' | 'sequence' | 'help';
  support?: ManagerToolRuntimeSupport | null;
  resolveSupport?: ManagerToolRuntimeSupportResolver | null;
}): string {
  const support = resolveManagerSupport(args);
  const taskIntakeText = support?.taskIntake?.describeTopic?.({
    topic: args.topic,
    language: args.language,
  });
  if (typeof taskIntakeText === 'string' && taskIntakeText.trim().length > 0) {
    return taskIntakeText.trim();
  }

  const plannerHintKey =
    args.topic === 'factors'
      ? 'factorsText'
      : args.topic === 'sequence'
        ? 'sequenceText'
        : 'helpText';

  return (
    readPlannerHint(support, args.language, plannerHintKey) ||
    resolveManagerHelpText({
      domainId: args.domainId,
      language: args.language,
      support,
      resolveSupport: args.resolveSupport,
    })
  );
}

function resolveTaskIntakeCapability(args: {
  domainId?: string | null;
  support?: ManagerToolRuntimeSupport | null;
  resolveSupport?: ManagerToolRuntimeSupportResolver | null;
}): RuntimeTaskIntakeCapability | null {
  return resolveManagerSupport(args)?.taskIntake || null;
}

async function finalizeDraftsFromTaskIntake(args: {
  capability: RuntimeTaskIntakeCapability;
  drafts: AutomationDraft[];
  slotValues: Record<string, RuntimeTaskIntakeValue>;
  language: ManagerLanguage;
}): Promise<AutomationDraft[]> {
  if (typeof args.capability.finalizeDrafts !== 'function') {
    return args.drafts.map((draft) => ({ ...draft }));
  }

  const finalized = await args.capability.finalizeDrafts({
    drafts: args.drafts,
    slotValues: args.slotValues,
    language: args.language,
  });
  return finalized.map((draft) => ({ ...draft }));
}

export function looksLikeLocalMatchesQuery(input: string): boolean {
  return /(matches|fixtures|games|比赛|赛程)/i.test(input);
}

function resolveMatchDateLabel(
  sourceText: string,
  language: ManagerLanguage,
): { matchDate: string; label: string } {
  const now = new Date();
  const normalized = normalizeInput(sourceText);
  if (/(tomorrow|明天|明晚)/i.test(normalized)) {
    return {
      matchDate: toLocalDateKey(addDays(now, 1)),
      label: language === 'zh' ? '明天' : 'tomorrow',
    };
  }

  if (/(tonight|今晚)/i.test(normalized)) {
    return {
      matchDate: toLocalDateKey(now),
      label: language === 'zh' ? '今晚' : 'tonight',
    };
  }

  return {
    matchDate: toLocalDateKey(now),
    label: language === 'zh' ? '今天' : 'today',
  };
}

function resolveStatusFilters(
  sourceText: string,
  language: ManagerLanguage,
): { statuses?: string[]; label?: string } {
  const normalized = normalizeInput(sourceText);
  if (/(live|in progress|进行中|正在进行)/i.test(normalized)) {
    return {
      statuses: ['live'],
      label: language === 'zh' ? '进行中的' : 'live',
    };
  }
  if (/(finished|completed|已结束|完赛)/i.test(normalized)) {
    return {
      statuses: ['finished'],
      label: language === 'zh' ? '已结束的' : 'finished',
    };
  }
  if (/(upcoming|未开赛|即将开始)/i.test(normalized)) {
    return {
      statuses: ['upcoming'],
      label: language === 'zh' ? '未开赛的' : 'upcoming',
    };
  }
  return {};
}

function resolveLeagueFilters(sourceText: string): string[] {
  const normalized = normalizeInput(sourceText);
  return Array.from(
    new Set(
      MANAGER_LEAGUES.filter((league) =>
        league.aliases.some((alias) => normalized.includes(alias.toLowerCase())),
      ).map((league) => league.label),
    ),
  );
}

function resolveMatchQuery(
  sourceText: string,
  language: ManagerLanguage,
  _domainId: string,
): ManagerMatchQueryResolution {
  const date = resolveMatchDateLabel(sourceText, language);
  const status = resolveStatusFilters(sourceText, language);
  const leagues = resolveLeagueFilters(sourceText);
  const scopeParts = [date.label];

  if (leagues.length > 0) {
    scopeParts.push(leagues.join(language === 'zh' ? '、' : ', '));
  }
  if (status.label) {
    scopeParts.push(status.label);
  }
  scopeParts.push(language === 'zh' ? '比赛' : 'matches');

  return {
    filters: {
      matchDate: date.matchDate,
      statuses: status.statuses,
      leagueTerms: leagues,
    },
    scopeLabel: scopeParts.join(language === 'zh' ? '' : ' '),
  };
}

function resolveMatchStatusLabel(status: string, language: ManagerLanguage): string {
  if (language === 'zh') {
    if (status === 'live') return '进行中';
    if (status === 'finished') return '已结束';
    return '未开赛';
  }

  if (status === 'live') return 'live';
  if (status === 'finished') return 'finished';
  return 'upcoming';
}

function formatMatchReply(
  language: ManagerLanguage,
  scopeLabel: string,
  matches: Match[],
): string {
  if (matches.length === 0) {
    return language === 'zh'
      ? `我已经查询本地同步库，但没有找到${scopeLabel}的记录。`
      : `I queried the football runtime sources, but found no ${scopeLabel} records.`;
  }

  const lines = matches.slice(0, 12).map((match, index) => {
    const kickOff = new Date(match.date).toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${index + 1}. ${kickOff} | ${match.league} | ${match.homeTeam.name} vs ${match.awayTeam.name} | ${resolveMatchStatusLabel(match.status, language)}`;
  });

  return language === 'zh'
    ? `我已经查询本地同步库，找到 ${matches.length} 场${scopeLabel}：\n${lines.join('\n')}`
    : `I queried the football runtime sources and found ${matches.length} ${scopeLabel}:\n${lines.join('\n')}`;
}

async function buildDraftBundleEffect(
  drafts: AutomationDraft[],
  composerMode: AutomationCommandComposerMode,
  language: ManagerLanguage,
): Promise<ManagerConversationEffect> {
  await Promise.all(
    drafts
      .filter((draft) => draft.status === 'ready')
      .map((draft) =>
        ensureExecutionTicketForDraft({
          draft,
          source: 'command_center',
        }),
      ),
  );

  const summary = summarizeManagerResponse(drafts, {
    composerMode,
    language,
  });

  return {
    agentText: summary.message,
    messageKind: drafts.length > 0 ? 'draft_bundle' : 'text',
    draftIds: drafts.map((draft) => draft.id),
    draftsToSave: drafts,
    pendingTask: null,
    shouldRefreshTaskState: true,
    feedbackMessage: summary.message,
  };
}

export const managerQueryLocalMatchesDeclaration: FunctionDeclaration = {
  name: 'manager_query_local_matches',
  description:
    'Query football runtime data sources for requests such as today, tomorrow, tonight, live, or league-scoped fixtures.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sourceText: {
        type: Type.STRING,
        description: 'The latest user message asking about matches or fixtures.',
      },
      domainId: {
        type: Type.STRING,
        description: 'The active analysis domain, usually football.',
      },
      language: {
        type: Type.STRING,
        description: 'Reply language. Use "zh" for Chinese and "en" for English.',
      },
    },
    required: ['sourceText', 'domainId', 'language'],
  },
};

export async function executeManagerQueryLocalMatches(args: {
  sourceText: string;
  domainId: string;
  language: ManagerLanguage;
  support?: ManagerToolRuntimeSupport | null;
  resolveSupport?: ManagerToolRuntimeSupportResolver | null;
  signal?: AbortSignal;
}): Promise<ManagerConversationEffect> {
  throwIfAborted(args.signal);
  const unsupported = ensureSupportedManagerTool({
    domainId: args.domainId,
    language: args.language,
    toolId: managerQueryLocalMatchesDeclaration.name,
    support: args.support,
    resolveSupport: args.resolveSupport,
  });
  if (unsupported) {
    return unsupported;
  }

  const resolution = resolveMatchQuery(args.sourceText, args.language, args.domainId);
  const events = await resolveDomainEventFeed({
    domainId: args.domainId,
    filters: resolution.filters,
    signal: args.signal,
  });
  const matches = extractMatchesFromRuntimeEvents(events);
  throwIfAborted(args.signal);

  return {
    agentText: formatMatchReply(args.language, resolution.scopeLabel, matches),
    messageKind: 'text',
    pendingTask: null,
    memoryCandidates: buildManagerTurnMemoryCandidates({
      text: args.sourceText,
      domainId: args.domainId,
      detectionMode: 'freeform',
    }),
  };
}

export const managerDescribeCapabilityDeclaration: FunctionDeclaration = {
  name: 'manager_describe_capability',
  description:
    'Explain supported analysis factors, default analysis sequence, or general chat command help.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      topic: {
        type: Type.STRING,
        description: 'One of "factors", "sequence", or "help".',
      },
      domainId: {
        type: Type.STRING,
        description: 'The active analysis domain for manager capability hints.',
      },
      language: {
        type: Type.STRING,
        description: 'Reply language. Use "zh" for Chinese and "en" for English.',
      },
    },
    required: ['topic', 'domainId', 'language'],
  },
};

export async function executeManagerDescribeCapability(args: {
  topic: 'factors' | 'sequence' | 'help';
  domainId: string;
  language: ManagerLanguage;
  support?: ManagerToolRuntimeSupport | null;
  resolveSupport?: ManagerToolRuntimeSupportResolver | null;
  signal?: AbortSignal;
}): Promise<ManagerConversationEffect> {
  throwIfAborted(args.signal);
  const unsupported = ensureSupportedManagerTool({
    domainId: args.domainId,
    language: args.language,
    toolId: managerDescribeCapabilityDeclaration.name,
    support: args.support,
    resolveSupport: args.resolveSupport,
  });
  if (unsupported) {
    return unsupported;
  }

  const agentText = resolveManagerCapabilityText({
    domainId: args.domainId,
    language: args.language,
    topic: args.topic,
    support: args.support,
    resolveSupport: args.resolveSupport,
  });

  return {
    agentText,
    messageKind: 'text',
    pendingTask: null,
  };
}

export const managerPrepareTaskIntakeDeclaration: FunctionDeclaration = {
  name: 'manager_prepare_task_intake',
  description:
    'Parse a natural-language analysis command, extract time and targets, and either create automation drafts or ask a follow-up question for missing analysis profile details.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sourceText: {
        type: Type.STRING,
        description: 'The user command describing when and what to analyze.',
      },
      composerMode: {
        type: Type.STRING,
        description: 'Use "smart", "analyze_now", or "automation".',
      },
      defaultDomainId: {
        type: Type.STRING,
        description: 'The active domain id used when the command does not specify another domain.',
      },
      language: {
        type: Type.STRING,
        description: 'Reply language. Use "zh" for Chinese and "en" for English.',
      },
      nowIso: {
        type: Type.STRING,
        description: 'Optional ISO timestamp for deterministic parsing in tests.',
      },
    },
    required: ['sourceText', 'composerMode', 'defaultDomainId', 'language'],
  },
};

export async function executeManagerPrepareTaskIntake(args: {
  sourceText: string;
  composerMode: AutomationCommandComposerMode;
  defaultDomainId: string;
  language: ManagerLanguage;
  nowIso?: string;
  support?: ManagerToolRuntimeSupport | null;
  resolveSupport?: ManagerToolRuntimeSupportResolver | null;
  signal?: AbortSignal;
}): Promise<ManagerConversationEffect> {
  throwIfAborted(args.signal);
  const unsupported = ensureSupportedManagerTool({
    domainId: args.defaultDomainId,
    language: args.language,
    toolId: managerPrepareTaskIntakeDeclaration.name,
    support: args.support,
    resolveSupport: args.resolveSupport,
  });
  if (unsupported) {
    return unsupported;
  }

  const now =
    typeof args.nowIso === 'string' && args.nowIso.trim().length > 0
      ? new Date(args.nowIso)
      : new Date();
  const { parseAutomationCommand } = await import('@/src/services/automation/parser');
  const drafts = finalizeAutomationDraftsForComposer(
    args.sourceText,
    parseAutomationCommand(args.sourceText, {
      defaultDomainId: args.defaultDomainId,
      now,
    }),
    {
      composerMode: args.composerMode,
      now,
    },
  );
  const domainId = drafts[0]?.domainId || args.defaultDomainId || resolveDefaultDomainId();
  const memoryCandidates = buildManagerTurnMemoryCandidates({
    text: args.sourceText,
    domainId,
    detectionMode: 'freeform',
  });
  const capability = resolveTaskIntakeCapability({
    domainId,
    support: args.support,
    resolveSupport: args.resolveSupport,
  });
  if (!capability) {
    const effect = await buildDraftBundleEffect(drafts, args.composerMode, args.language);
    return {
      ...effect,
      memoryCandidates,
    };
  }

  const intakeWorkflow = await createManagerIntakeWorkflowState({
    capability,
    domainId,
    sourceText: args.sourceText,
    composerMode: args.composerMode,
    drafts,
    language: args.language,
    signal: args.signal,
  });

  if (intakeWorkflow.completed) {
    throwIfAborted(args.signal);
    const effect = await buildDraftBundleEffect(
      await finalizeDraftsFromTaskIntake({
        capability,
        drafts: intakeWorkflow.drafts,
        slotValues: intakeWorkflow.slotValues,
        language: args.language,
      }),
      args.composerMode,
      args.language,
    );
    return {
      ...effect,
      memoryCandidates,
    };
  }

  const prompt = buildManagerIntakePrompt({
    capability,
    state: intakeWorkflow,
    language: args.language,
  });

  return {
    agentText: prompt.body,
    messageKind: 'text',
    feedbackMessage: prompt.body,
    intakeWorkflow,
    memoryCandidates,
  };
}

export const managerContinueTaskIntakeDeclaration: FunctionDeclaration = {
  name: 'manager_continue_task_intake',
  description:
    'Continue an active task-intake workflow by applying the latest user answer to the current clarification step. Prefer `intakeWorkflow`; use `pendingTask` only as a legacy compatibility fallback.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      intakeWorkflow: {
        type: Type.OBJECT,
        description: 'The active generic task-intake workflow state stored by the manager runtime.',
      },
      pendingTask: {
        type: Type.OBJECT,
        description:
          'Legacy pending-task state for older manager workflows. Use only when the generic intakeWorkflow state is unavailable.',
      },
      domainId: {
        type: Type.STRING,
        description:
          'Optional active domain id. Helps resolve domain-specific capability hints when only domain context is available.',
      },
      answer: {
        type: Type.STRING,
        description: 'The latest user answer for the active clarification step.',
      },
      language: {
        type: Type.STRING,
        description: 'Reply language. Use "zh" for Chinese and "en" for English.',
      },
    },
    required: ['answer', 'language'],
  },
};

export async function executeManagerContinueTaskIntake(args: {
  domainId?: string;
  pendingTask?: ManagerPendingTask;
  intakeWorkflow?: ManagerIntakeWorkflowState;
  answer: string;
  language: ManagerLanguage;
  support?: ManagerToolRuntimeSupport | null;
  resolveSupport?: ManagerToolRuntimeSupportResolver | null;
  signal?: AbortSignal;
}): Promise<ManagerConversationEffect> {
  throwIfAborted(args.signal);
  const domainId =
    args.intakeWorkflow?.domainId ||
    args.pendingTask?.drafts[0]?.domainId ||
    args.domainId ||
    resolveDefaultDomainId();
  const unsupported = ensureSupportedManagerTool({
    domainId,
    language: args.language,
    toolId: managerContinueTaskIntakeDeclaration.name,
    support: args.support,
    resolveSupport: args.resolveSupport,
  });
  if (unsupported) {
    return unsupported;
  }

  const capability = resolveTaskIntakeCapability({
    domainId,
    support: args.support,
    resolveSupport: args.resolveSupport,
  });
  if (args.intakeWorkflow) {
    if (!capability) {
      return buildUnsupportedToolEffect({
        domainId,
        language: args.language,
        support: args.support,
        resolveSupport: args.resolveSupport,
      });
    }

    const memoryCandidates = buildManagerTurnMemoryCandidates({
      text: args.answer,
      domainId,
      detectionMode: 'freeform',
    });
    const nextWorkflow = await applyManagerIntakeAnswer({
      capability,
      state: args.intakeWorkflow,
      answer: args.answer,
      language: args.language,
      signal: args.signal,
    });

    if (!nextWorkflow.completed) {
      const isRetry =
        nextWorkflow.activeStepId === args.intakeWorkflow.activeStepId &&
        nextWorkflow.missingSlotIds.length === args.intakeWorkflow.missingSlotIds.length &&
        nextWorkflow.recognizedSlotIds.length === args.intakeWorkflow.recognizedSlotIds.length;
      const prompt = buildManagerIntakePrompt({
        capability,
        state: nextWorkflow,
        language: args.language,
        isRetry,
      });
      return {
        agentText: prompt.body,
        messageKind: 'text',
        feedbackMessage: prompt.body,
        intakeWorkflow: nextWorkflow,
        memoryCandidates,
      };
    }

    throwIfAborted(args.signal);
    const effect = await buildDraftBundleEffect(
      await finalizeDraftsFromTaskIntake({
        capability,
        drafts: nextWorkflow.drafts,
        slotValues: nextWorkflow.slotValues,
        language: args.language,
      }),
      nextWorkflow.composerMode,
      args.language,
    );
    return {
      ...effect,
      memoryCandidates,
    };
  }

  if (!args.pendingTask) {
    return buildMissingTaskIntakeEffect({
      language: args.language,
    });
  }

  const clarification = summarizeManagerClarification({
    pendingTask: args.pendingTask,
    answer: args.answer,
  });
  const memoryCandidateMode: MemoryCandidateDetectionMode =
    clarification.sequencePreference && clarification.selectedSourceIds.length > 0
      ? 'analysis_profile'
      : clarification.sequencePreference
        ? 'analysis_sequence'
        : clarification.selectedSourceIds.length > 0
          ? 'analysis_factors'
          : args.pendingTask.stage === 'await_sequence'
            ? 'analysis_sequence'
            : args.pendingTask.stage === 'await_factors'
              ? 'analysis_factors'
              : 'freeform';
  const memoryCandidates = buildManagerTurnMemoryCandidates({
    text: args.answer,
    domainId,
    detectionMode: memoryCandidateMode,
  });

  if (!clarification.isComplete || !clarification.sequencePreference) {
    const nextPendingTask: ManagerPendingTask = {
      ...args.pendingTask,
      stage: clarification.nextStage || args.pendingTask.stage,
      selectedSourceIds:
        clarification.selectedSourceIds.length > 0
          ? clarification.selectedSourceIds
          : undefined,
      sequencePreference: clarification.sequencePreference || undefined,
      clarificationSummary: toManagerClarificationSnapshot(clarification),
    };
    const followUp = buildManagerClarificationFollowUp({
      language: args.language,
      summary: clarification,
    });
    return {
      agentText: followUp,
      messageKind: 'text',
      pendingTask: nextPendingTask,
      feedbackMessage: followUp,
      memoryCandidates,
    };
  }

  const completedSourceIds =
    clarification.selectedSourceIds.length > 0
      ? clarification.selectedSourceIds
      : DEFAULT_SOURCE_PREFERENCES;
  const completedDrafts = applyAnalysisProfileToDrafts(args.pendingTask.drafts, {
    selectedSourceIds: completedSourceIds,
    sequencePreference: clarification.sequencePreference as ManagerSequenceStepId[],
  });
  throwIfAborted(args.signal);

  const effect = await buildDraftBundleEffect(
    completedDrafts,
    args.pendingTask.composerMode,
    args.language,
  );
  return {
    ...effect,
    memoryCandidates,
  };

  /*
   * Legacy football-only fallback below has been retired from the live path.
   * It stays commented temporarily as a reference until the remaining compat layer is removed.
  if (args.pendingTask.stage === 'await_factors') {
    const selectedSourceIds = parseSourcePreferenceIds(args.answer);
    if (!selectedSourceIds) {
      const retryMessage =
        args.language === 'zh'
          ? '我还没有识别出你想优先看的分析因素。你可以直接回复：基础面、赔率盘口、自定义情报，或者说“默认”。'
          : 'I still cannot tell which factors to prioritize. Reply with fundamentals, odds and market, custom notes, or say "default".';
      return {
        agentText: retryMessage,
        messageKind: 'text',
        pendingTask: args.pendingTask,
        feedbackMessage: retryMessage,
      };
    }

    const nextPendingTask: ManagerPendingTask = {
      ...args.pendingTask,
      stage: 'await_sequence',
      selectedSourceIds,
    };
    const followUp = buildSequenceFollowUp(args.language, selectedSourceIds);
    return {
      agentText: followUp,
      messageKind: 'text',
      pendingTask: nextPendingTask,
      feedbackMessage: followUp,
    };
  }

  const sequencePreference = parseSequencePreference(args.answer);
  if (!sequencePreference) {
    const retryMessage =
      args.language === 'zh'
        ? '我还没有识别出你想要的分析顺序。你可以直接说“先基础面后盘口再结论”，或者说“默认顺序”。'
        : 'I still cannot tell the analysis order you want. Reply with something like "fundamentals first, then market, then final prediction", or say "default order".';
    return {
      agentText: retryMessage,
      messageKind: 'text',
      pendingTask: args.pendingTask,
      feedbackMessage: retryMessage,
    };
  }

  const selectedSourceIds =
    args.pendingTask.selectedSourceIds || DEFAULT_SOURCE_PREFERENCES;
  const finalizedDrafts = applyAnalysisProfileToDrafts(args.pendingTask.drafts, {
    selectedSourceIds,
    sequencePreference: sequencePreference as ManagerSequenceStepId[],
  });
  throwIfAborted(args.signal);

  return buildDraftBundleEffect(
    finalizedDrafts,
    args.pendingTask.composerMode,
    args.language,
  );
  */
}

export const managerHelpDeclaration: FunctionDeclaration = {
  name: 'manager_help',
  description:
    'Reply with general manager guidance when the request is ambiguous or unsupported.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      domainId: {
        type: Type.STRING,
        description: 'The active analysis domain for manager guidance.',
      },
      language: {
        type: Type.STRING,
        description: 'Reply language. Use "zh" for Chinese and "en" for English.',
      },
    },
    required: ['domainId', 'language'],
  },
};

export async function executeManagerHelp(args: {
  domainId: string;
  language: ManagerLanguage;
  support?: ManagerToolRuntimeSupport | null;
  resolveSupport?: ManagerToolRuntimeSupportResolver | null;
  signal?: AbortSignal;
}): Promise<ManagerConversationEffect> {
  throwIfAborted(args.signal);
  const unsupported = ensureSupportedManagerTool({
    domainId: args.domainId,
    language: args.language,
    toolId: managerHelpDeclaration.name,
    support: args.support,
    resolveSupport: args.resolveSupport,
  });
  if (unsupported) {
    return unsupported;
  }

  return {
    agentText: resolveManagerHelpText({
      domainId: args.domainId,
      language: args.language,
      support: args.support,
      resolveSupport: args.resolveSupport,
    }),
    messageKind: 'text',
    pendingTask: null,
  };
}
