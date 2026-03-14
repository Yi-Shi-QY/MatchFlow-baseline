import { Type, type FunctionDeclaration } from '@google/genai';
import type { Match } from '@/src/data/matches';
import { getDefaultRuntimeDomainPack } from '@/src/domains/runtime/registry';
import { extractMatchesFromRuntimeEvents } from '@/src/domains/runtime/sourceQueries';
import {
  finalizeAutomationDraftsForComposer,
  summarizeManagerResponse,
  type AutomationCommandComposerMode,
} from '@/src/services/automation/commandCenter';
import { parseAutomationCommand } from '@/src/services/automation/parser';
import type { AutomationDraft } from '@/src/services/automation/types';
import { createAutomationId } from '@/src/services/automation/utils';
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
  buildSequenceFollowUp,
  parseSequencePreference,
  parseSourcePreferenceIds,
} from '@/src/services/managerAgent';
import { resolveDomainEventFeed } from '@/src/services/domainMatchFeed';
import {
  runtimeManagerSupportsTool,
  resolveRuntimeManagerCapabilityText,
  resolveRuntimeManagerHelpText,
} from './runtimeIntentRouter';
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

function createPendingTask(
  sourceText: string,
  composerMode: AutomationCommandComposerMode,
  drafts: AutomationDraft[],
): ManagerPendingTask {
  return {
    id: createAutomationId('manager_pending'),
    sourceText,
    composerMode,
    drafts,
    stage: 'await_factors',
    createdAt: Date.now(),
  };
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
  return getDefaultRuntimeDomainPack().manifest.domainId;
}

function buildUnsupportedToolEffect(args: {
  domainId: string;
  language: ManagerLanguage;
}): ManagerConversationEffect {
  const agentText = args.domainId
    ? resolveRuntimeManagerHelpText({
        domainId: args.domainId,
        language: args.language,
      })
    : buildFallbackHelpText(args.language);

  return {
    agentText,
    messageKind: 'text',
    pendingTask: null,
  };
}

function ensureSupportedManagerTool(args: {
  domainId: string;
  language: ManagerLanguage;
  toolId: string;
}): ManagerConversationEffect | null {
  if (
    runtimeManagerSupportsTool({
      domainId: args.domainId,
      toolId: args.toolId,
    })
  ) {
    return null;
  }

  return buildUnsupportedToolEffect(args);
}

function buildFallbackHelpText(language: ManagerLanguage): string {
  return language === 'zh'
    ? '你可以直接问我今天有哪些比赛，或者说“今晚 20:00 分析皇马 vs 巴萨”“每天 09:00 分析英超”。我会先在对话里确认分析因素和顺序，再生成任务卡片。'
    : 'Ask what matches are on today, or tell me which match or league to analyze and when. I will confirm the analysis factors and sequence in chat before creating task cards.';
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
  signal?: AbortSignal;
}): Promise<ManagerConversationEffect> {
  throwIfAborted(args.signal);
  const unsupported = ensureSupportedManagerTool({
    domainId: args.domainId,
    language: args.language,
    toolId: managerQueryLocalMatchesDeclaration.name,
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
  signal?: AbortSignal;
}): Promise<ManagerConversationEffect> {
  throwIfAborted(args.signal);
  const unsupported = ensureSupportedManagerTool({
    domainId: args.domainId,
    language: args.language,
    toolId: managerDescribeCapabilityDeclaration.name,
  });
  if (unsupported) {
    return unsupported;
  }

  const agentText = resolveRuntimeManagerCapabilityText({
    domainId: args.domainId,
    language: args.language,
    topic: args.topic,
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
  signal?: AbortSignal;
}): Promise<ManagerConversationEffect> {
  throwIfAborted(args.signal);
  const unsupported = ensureSupportedManagerTool({
    domainId: args.defaultDomainId,
    language: args.language,
    toolId: managerPrepareTaskIntakeDeclaration.name,
  });
  if (unsupported) {
    return unsupported;
  }

  const now =
    typeof args.nowIso === 'string' && args.nowIso.trim().length > 0
      ? new Date(args.nowIso)
      : new Date();
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
  const pendingTask = createPendingTask(args.sourceText, args.composerMode, drafts);
  const clarification = summarizeManagerClarification({
    pendingTask,
    answer: args.sourceText,
  });
  const memoryCandidateMode: MemoryCandidateDetectionMode =
    clarification.sequencePreference && clarification.selectedSourceIds.length > 0
      ? 'analysis_profile'
      : clarification.sequencePreference
        ? 'analysis_sequence'
        : clarification.selectedSourceIds.length > 0
          ? 'analysis_factors'
          : 'freeform';
  const memoryCandidates = buildManagerTurnMemoryCandidates({
    text: args.sourceText,
    domainId: drafts[0]?.domainId || args.defaultDomainId,
    detectionMode: memoryCandidateMode,
  });

  if (clarification.isComplete && clarification.sequencePreference) {
    throwIfAborted(args.signal);
    const effect = await buildDraftBundleEffect(
      applyAnalysisProfileToDrafts(drafts, {
        selectedSourceIds: clarification.selectedSourceIds,
        sequencePreference: clarification.sequencePreference,
      }),
      args.composerMode,
      args.language,
    );
    return {
      ...effect,
      memoryCandidates,
    };
  }

  pendingTask.selectedSourceIds =
    clarification.selectedSourceIds.length > 0 ? clarification.selectedSourceIds : undefined;
  pendingTask.sequencePreference = clarification.sequencePreference || undefined;
  pendingTask.stage = clarification.nextStage || 'await_factors';
  pendingTask.clarificationSummary = toManagerClarificationSnapshot(clarification);
  const followUp = buildManagerClarificationFollowUp({
    language: args.language,
    summary: clarification,
  });

  return {
    agentText: followUp,
    messageKind: 'text',
    pendingTask,
    feedbackMessage: followUp,
    memoryCandidates,
  };
}

export const managerContinueTaskIntakeDeclaration: FunctionDeclaration = {
  name: 'manager_continue_task_intake',
  description:
    'Continue a pending task-intake turn by applying the user answer to analysis factors or sequence preference.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      pendingTask: {
        type: Type.OBJECT,
        description: 'The current pending task state stored by the manager runtime.',
      },
      answer: {
        type: Type.STRING,
        description: 'The latest user answer for factors or sequence preference.',
      },
      language: {
        type: Type.STRING,
        description: 'Reply language. Use "zh" for Chinese and "en" for English.',
      },
    },
    required: ['pendingTask', 'answer', 'language'],
  },
};

export async function executeManagerContinueTaskIntake(args: {
  pendingTask: ManagerPendingTask;
  answer: string;
  language: ManagerLanguage;
  signal?: AbortSignal;
}): Promise<ManagerConversationEffect> {
  throwIfAborted(args.signal);
  const domainId = args.pendingTask.drafts[0]?.domainId || resolveDefaultDomainId();
  const unsupported = ensureSupportedManagerTool({
    domainId,
    language: args.language,
    toolId: managerContinueTaskIntakeDeclaration.name,
  });
  if (unsupported) {
    return unsupported;
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
  signal?: AbortSignal;
}): Promise<ManagerConversationEffect> {
  throwIfAborted(args.signal);
  const unsupported = ensureSupportedManagerTool({
    domainId: args.domainId,
    language: args.language,
    toolId: managerHelpDeclaration.name,
  });
  if (unsupported) {
    return unsupported;
  }

  return {
    agentText: resolveRuntimeManagerHelpText({
      domainId: args.domainId,
      language: args.language,
    }),
    messageKind: 'text',
    pendingTask: null,
  };
}
