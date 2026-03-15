import type {
  AutomationAnalysisProfile,
  AutomationDraft,
} from '@/src/services/automation/types';
import { ANALYSIS_DATA_SOURCES } from '@/src/services/dataSources';
import type {
  ManagerLanguage,
  ManagerSequenceStepId,
  ManagerSourcePreferenceId,
} from '@/src/services/manager/types';

// Legacy pending-task clarification still uses a football-style analysis profile.
// Keep these helpers outside the generic intake runtime so the boundary stays explicit.
interface SourceDescriptor {
  id: ManagerSourcePreferenceId;
  aliases: string[];
}

const SOURCE_DESCRIPTORS: SourceDescriptor[] = [
  {
    id: 'fundamental',
    aliases: [
      'fundamental',
      'basic',
      'stats',
      'form',
      '基本面',
      '基础面',
      '阵容',
      '赛况',
      '状态',
      '基本数据',
    ],
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

function translateSourceLabel(
  id: ManagerSourcePreferenceId,
  language: ManagerLanguage,
): string {
  if (language === 'zh') {
    if (id === 'fundamental') return '基础面';
    if (id === 'market') return '赔率盘口';
    return '自定义情报';
  }

  if (id === 'fundamental') return 'fundamental context';
  if (id === 'market') return 'odds and market';
  return 'custom notes';
}

function translateSequenceLabel(
  id: ManagerSequenceStepId,
  language: ManagerLanguage,
): string {
  if (id === 'prediction') {
    return language === 'zh' ? '结论输出' : 'final prediction';
  }

  return translateSourceLabel(id, language);
}

export function formatManagerSourcePreferences(
  language: ManagerLanguage,
  sourceIds: ManagerSourcePreferenceId[],
): string {
  return sourceIds
    .map((id) => translateSourceLabel(id, language))
    .join(language === 'zh' ? '、' : ', ');
}

export function formatManagerSequencePreference(
  language: ManagerLanguage,
  sequence: ManagerSequenceStepId[],
): string {
  return sequence
    .map((id) => translateSequenceLabel(id, language))
    .join(' -> ');
}

export function describeAvailableFactors(language: ManagerLanguage): string {
  const sourceIds = ANALYSIS_DATA_SOURCES.map((source) => source.id).filter(
    (id): id is ManagerSourcePreferenceId =>
      id === 'fundamental' || id === 'market' || id === 'custom',
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

export function describeDefaultSequence(language: ManagerLanguage): string {
  const sequence: ManagerSequenceStepId[] = [
    'fundamental',
    'market',
    'custom',
    'prediction',
  ];

  if (language === 'zh') {
    return `默认顺序是：${sequence
      .map((id) => translateSequenceLabel(id, language))
      .join(' -> ')}。如果是临场或赔率驱动场景，我也可以改成先看盘口，再回看基础面，最后给出结论。`;
  }

  return `The default order is ${sequence
    .map((id) => translateSequenceLabel(id, language))
    .join(' -> ')}. For live or odds-driven cases, I can also switch to market first, then fundamentals, then the final prediction.`;
}

export function buildFactorsFollowUp(language: ManagerLanguage): string {
  if (language === 'zh') {
    return '在我生成分析任务前，先告诉我这次重点看哪些因素。可直接回答：基础面、赔率盘口、自定义情报，或者说“默认”。';
  }

  return 'Before I create the analysis task, tell me which factors to prioritize. You can reply with fundamentals, odds and market, custom notes, or simply say "default".';
}

export function buildSequenceFollowUp(
  language: ManagerLanguage,
  selectedSourceIds: ManagerSourcePreferenceId[],
): string {
  const readable = selectedSourceIds
    .map((id) => translateSourceLabel(id, language))
    .join(language === 'zh' ? '、' : ', ');

  if (language === 'zh') {
    return `收到，本次会重点看：${readable}。接下来告诉我分析顺序，比如“先基础面后盘口再结论”，或者直接说“默认顺序”。`;
  }

  return `Got it. I will prioritize ${readable}. Now tell me the analysis order, for example "fundamentals first, then market, then final prediction", or just say "default order".`;
}

export function parseSourcePreferenceIds(
  input: string,
): ManagerSourcePreferenceId[] | null {
  const normalized = input.toLowerCase();
  if (!normalized.trim()) {
    return null;
  }

  if (/(default|默认|都要|全部|all|都看)/i.test(normalized)) {
    return ['fundamental', 'market', 'custom'];
  }

  const selected = SOURCE_DESCRIPTORS.filter((descriptor) =>
    descriptor.aliases.some((alias) => normalized.includes(alias.toLowerCase())),
  ).map((descriptor) => descriptor.id);

  if (selected.length === 0) {
    return null;
  }

  return Array.from(new Set<ManagerSourcePreferenceId>(selected));
}

export function parseSequencePreference(
  input: string,
): ManagerSequenceStepId[] | null {
  const normalized = input.toLowerCase();
  if (!normalized.trim()) {
    return null;
  }

  if (/(default|默认)/i.test(normalized)) {
    return ['fundamental', 'market', 'custom', 'prediction'];
  }

  const tokens: Array<{ id: ManagerSequenceStepId; index: number }> = [];
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

  const uniqueOrdered = Array.from(new Set<ManagerSequenceStepId>(ordered));
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
