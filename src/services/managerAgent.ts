import { createAutomationId } from '@/src/services/automation/utils';
import type { AutomationDraft } from '@/src/services/automation';
import type { AutomationCommandComposerMode } from '@/src/services/automation/commandCenter';
import { ANALYSIS_DATA_SOURCES } from '@/src/services/dataSources';
import { listTodayLocalMatches } from '@/src/services/syncedMatches';

type Language = 'zh' | 'en';

type SourcePreferenceId = 'fundamental' | 'market' | 'custom';
type SequenceStepId = SourcePreferenceId | 'prediction';

interface SourceDescriptor {
  id: SourcePreferenceId;
  aliases: string[];
}

const SOURCE_DESCRIPTORS: SourceDescriptor[] = [
  {
    id: 'fundamental',
    aliases: ['fundamental', 'basic', 'stats', 'form', '基本面', '基础面', '阵容', '赛况', '状态', '基本数据'],
  },
  {
    id: 'market',
    aliases: ['market', 'odds', 'line', 'handicap', '赔率', '盘口', '欧赔', '亚盘'],
  },
  {
    id: 'custom',
    aliases: ['custom', 'notes', 'intel', 'news', '自定义', '情报', '新闻', '补充信息'],
  },
];

export interface ManagerPendingTask {
  id: string;
  sourceText: string;
  composerMode: AutomationCommandComposerMode;
  drafts: AutomationDraft[];
  stage: 'await_factors' | 'await_sequence';
  selectedSourceIds?: SourcePreferenceId[];
  sequencePreference?: SequenceStepId[];
  createdAt: number;
}

export interface AutomationAnalysisProfile {
  selectedSourceIds: SourcePreferenceId[];
  sequencePreference: SequenceStepId[];
}

export function isTodayMatchesQuery(input: string): boolean {
  return /(today('|’)s matches|matches today|what matches.*today|今天.*(比赛|赛程)|今日.*(比赛|赛程)|今天有哪些比赛)/i.test(
    input,
  );
}

export function isAnalysisFactorsQuestion(input: string): boolean {
  return /(what factors|which factors|consider.*factors|分析.*(因素|维度)|要考虑哪些因素|关注哪些因素)/i.test(
    input,
  );
}

export function isAnalysisSequenceQuestion(input: string): boolean {
  return /(analysis order|what order|sequence|步骤顺序|分析顺序|先看什么|怎么排序)/i.test(
    input,
  );
}

export function looksLikeTaskCommand(input: string): boolean {
  return /(analy[sz]e|run analysis|schedule|automate|create task|创建分析|分析|安排分析|定时|自动分析|每天.*分析)/i.test(
    input,
  );
}

function translateSourceLabel(id: SourcePreferenceId, language: Language): string {
  if (language === 'zh') {
    if (id === 'fundamental') return '基础面';
    if (id === 'market') return '赔率盘口';
    return '自定义情报';
  }
  if (id === 'fundamental') return 'fundamental context';
  if (id === 'market') return 'odds and market';
  return 'custom notes';
}

function translateSequenceLabel(id: SequenceStepId, language: Language): string {
  if (id === 'prediction') {
    return language === 'zh' ? '结论输出' : 'final prediction';
  }
  return translateSourceLabel(id, language);
}

export function describeAvailableFactors(language: Language): string {
  const sourceIds = ANALYSIS_DATA_SOURCES.map((source) => source.id).filter(
    (id): id is SourcePreferenceId => id === 'fundamental' || id === 'market' || id === 'custom',
  );
  if (language === 'zh') {
    return `我当前支持的分析因素有：${sourceIds
      .map((id) => translateSourceLabel(id, language))
      .join('、')}。默认至少会保留基础面，如果你愿意，我也可以按你的要求偏重赔率盘口或自定义情报。`;
  }
  return `I currently support these analysis factors: ${sourceIds
    .map((id) => translateSourceLabel(id, language))
    .join(', ')}. I keep fundamental context by default, and I can bias the run toward market signals or custom notes if you want.`;
}

export function describeDefaultSequence(language: Language): string {
  const sequence: SequenceStepId[] = ['fundamental', 'market', 'custom', 'prediction'];
  if (language === 'zh') {
    return `默认顺序是：${sequence
      .map((id) => translateSequenceLabel(id, language))
      .join(' → ')}。如果是临场或赔率驱动场景，我也可以改成先看盘口，再回看基础面，最后给出结论。`;
  }
  return `The default order is ${sequence
    .map((id) => translateSequenceLabel(id, language))
    .join(' -> ')}. For live or odds-driven cases, I can also switch to market first, then fundamentals, then the final prediction.`;
}

export function buildFactorsFollowUp(language: Language): string {
  if (language === 'zh') {
    return '在我生成分析任务前，先告诉我这次重点看哪些因素。可直接回答：基础面、赔率盘口、自定义情报，或者说“默认”。';
  }
  return 'Before I create the analysis task, tell me which factors to prioritize. You can reply with fundamentals, odds and market, custom notes, or simply say "default".';
}

export function buildSequenceFollowUp(language: Language, selectedSourceIds: SourcePreferenceId[]): string {
  const readable = selectedSourceIds.map((id) => translateSourceLabel(id, language)).join(language === 'zh' ? '、' : ', ');
  if (language === 'zh') {
    return `收到，本次会重点看：${readable}。接下来告诉我分析顺序，比如“先基础面后盘口再结论”，或者直接说“默认顺序”。`;
  }
  return `Got it. I will prioritize ${readable}. Now tell me the analysis order, for example "fundamentals first, then market, then final prediction", or just say "default order".`;
}

export function createPendingTask(
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

export function parseSourcePreferenceIds(
  input: string,
): SourcePreferenceId[] | null {
  const normalized = input.toLowerCase();
  if (!normalized.trim()) return null;
  if (/(default|默认|都要|全部|all|都看)/i.test(normalized)) {
    return ['fundamental', 'market', 'custom'];
  }

  const selected = SOURCE_DESCRIPTORS.filter((descriptor) =>
    descriptor.aliases.some((alias) => normalized.includes(alias.toLowerCase())),
  ).map((descriptor) => descriptor.id);

  if (selected.length === 0) {
    return null;
  }

  return Array.from(new Set<SourcePreferenceId>(selected));
}

export function parseSequencePreference(
  input: string,
): SequenceStepId[] | null {
  const normalized = input.toLowerCase();
  if (!normalized.trim()) return null;
  if (/(default|默认)/i.test(normalized)) {
    return ['fundamental', 'market', 'custom', 'prediction'];
  }

  const tokens: Array<{ id: SequenceStepId; index: number }> = [];
  SOURCE_DESCRIPTORS.forEach((descriptor) => {
    descriptor.aliases.forEach((alias) => {
      const index = normalized.indexOf(alias.toLowerCase());
      if (index >= 0) {
        tokens.push({ id: descriptor.id, index });
      }
    });
  });

  ['prediction', '结论', '输出', 'final prediction', 'summary'].forEach((alias) => {
    const index = normalized.indexOf(alias.toLowerCase());
    if (index >= 0) {
      tokens.push({ id: 'prediction', index });
    }
  });

  if (tokens.length === 0) {
    return null;
  }

  const ordered = tokens
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.id);

  const uniqueOrdered = Array.from(new Set<SequenceStepId>(ordered));
  if (!uniqueOrdered.includes('prediction')) {
    uniqueOrdered.push('prediction');
  }
  return uniqueOrdered;
}

export function applyAnalysisProfileToDrafts(
  drafts: AutomationDraft[],
  profile: AutomationAnalysisProfile,
): AutomationDraft[] {
  return drafts.map((draft) => ({
    ...draft,
    analysisProfile: {
      selectedSourceIds: [...profile.selectedSourceIds],
      sequencePreference: [...profile.sequencePreference],
    },
    updatedAt: Date.now(),
  }));
}

function resolveMatchStatusLabel(status: string, language: Language): string {
  if (language === 'zh') {
    if (status === 'live') return '进行中';
    if (status === 'finished') return '已结束';
    return '未开赛';
  }
  if (status === 'live') return 'live';
  if (status === 'finished') return 'finished';
  return 'upcoming';
}

export async function answerTodayMatchesQuery(
  domainId: string,
  language: Language,
): Promise<string> {
  const matches = await listTodayLocalMatches(domainId);
  if (matches.length === 0) {
    return language === 'zh'
      ? '我刚按本地同步库查询过了，今天还没有可用比赛记录。'
      : 'I queried the local synced database and there are no match records for today yet.';
  }

  const lines = matches.slice(0, 12).map((match, index) => {
    const kickOff = new Date(match.date).toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${index + 1}. ${kickOff} | ${match.league} | ${match.homeTeam.name} vs ${match.awayTeam.name} | ${resolveMatchStatusLabel(match.status, language)}`;
  });

  if (language === 'zh') {
    return `我刚按本地同步库查了今天的比赛，共找到 ${matches.length} 场：\n${lines.join('\n')}`;
  }

  return `I queried the local synced database and found ${matches.length} match(es) today:\n${lines.join('\n')}`;
}
