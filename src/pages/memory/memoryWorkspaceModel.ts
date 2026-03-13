import type { DailySummaryMetadataRecord, MemoryMetadataRecord } from '@/src/services/memoryMetadata';
import { buildDefaultMemoryMetadata } from '@/src/services/memoryMetadata';
import type { LoadedMemoryRecord } from '@/src/services/memoryWorkspace';

type MemorySectionId =
  | 'summary'
  | 'pending'
  | 'enabled'
  | 'daily_summary'
  | 'disabled';

interface MemorySection {
  id: MemorySectionId;
  title: string;
}

interface MemorySummaryMetric {
  id: string;
  label: string;
  value: number;
}

export interface MemorySummaryCardModel {
  title: string;
  description: string;
  metrics: MemorySummaryMetric[];
}

export interface WorkspaceMemoryCardModel {
  memoryId: string;
  title: string;
  statusLabel: string;
  summary: string;
  scopeLabel: string;
  actions: string[];
}

export interface WorkspaceDailySummaryCardModel {
  summaryId: string;
  title: string;
  summary: string;
  statusLabel: string;
  ctaLabel: string;
}

export interface MemoryWorkspacePageModel {
  sections: MemorySection[];
  summaryCard: MemorySummaryCardModel;
  pendingCards: WorkspaceMemoryCardModel[];
  enabledCards: WorkspaceMemoryCardModel[];
  dailySummaryCards: WorkspaceDailySummaryCardModel[];
  disabledCards: WorkspaceMemoryCardModel[];
}

function truncateText(input: string, maxLength = 120): string {
  const normalized = input.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function getScopeLabel(memory: LoadedMemoryRecord, language: 'zh' | 'en'): string {
  if (language === 'zh') {
    if (memory.scopeType === 'global') return '全局';
    if (memory.scopeType === 'session') return '当前会话';
    return '当前领域';
  }

  if (memory.scopeType === 'global') return 'Global';
  if (memory.scopeType === 'session') return 'Session';
  return 'Domain';
}

function getStatusLabel(
  status: MemoryMetadataRecord['status'],
  language: 'zh' | 'en',
): string {
  if (language === 'zh') {
    if (status === 'enabled') return '已启用';
    if (status === 'disabled') return '已停用';
    return '待确认';
  }

  if (status === 'enabled') return 'Enabled';
  if (status === 'disabled') return 'Disabled';
  return 'Pending';
}

function getSummaryStatusLabel(
  status: DailySummaryMetadataRecord['extractionStatus'],
  language: 'zh' | 'en',
): string {
  if (language === 'zh') {
    if (status === 'completed') return '已提炼';
    if (status === 'partial') return '部分提炼';
    return '未提炼';
  }

  if (status === 'completed') return 'Generated';
  if (status === 'partial') return 'Partially generated';
  return 'Not generated';
}

function getDailySummaryCtaLabel(
  status: DailySummaryMetadataRecord['extractionStatus'],
  language: 'zh' | 'en',
): string {
  if (language === 'zh') {
    if (status === 'completed') return '查看已生成记忆';
    if (status === 'partial') return '查看提炼结果';
    return '生成记忆';
  }

  if (status === 'completed') return 'View generated memories';
  if (status === 'partial') return 'View extraction result';
  return 'Generate memories';
}

function buildMemoryCard(
  memory: LoadedMemoryRecord,
  metadata: MemoryMetadataRecord,
  language: 'zh' | 'en',
): WorkspaceMemoryCardModel {
  const actions =
    metadata.status === 'pending'
      ? [
          language === 'zh' ? '查看理由' : 'View reason',
          language === 'zh' ? '确认启用' : 'Enable',
          language === 'zh' ? '暂不使用' : 'Not now',
        ]
      : metadata.status === 'enabled'
        ? [
            language === 'zh' ? '查看详情' : 'View detail',
            language === 'zh' ? '停用' : 'Disable',
          ]
        : [
            language === 'zh' ? '查看详情' : 'View detail',
            language === 'zh' ? '重新启用' : 'Re-enable',
          ];

  return {
    memoryId: memory.memoryId,
    title: metadata.title || memory.title,
    statusLabel: getStatusLabel(metadata.status, language),
    summary: truncateText(metadata.reasoning || memory.contentText),
    scopeLabel: getScopeLabel(memory, language),
    actions,
  };
}

export function deriveMemoryWorkspaceModel(input: {
  memories: LoadedMemoryRecord[];
  metadataRecords: MemoryMetadataRecord[];
  dailySummaries: DailySummaryMetadataRecord[];
  language: 'zh' | 'en';
}): MemoryWorkspacePageModel {
  const { memories, metadataRecords, dailySummaries, language } = input;
  const metadataByMemoryId = new Map(
    metadataRecords.map((record) => [record.memoryId, record]),
  );

  const pendingCards: WorkspaceMemoryCardModel[] = [];
  const enabledCards: WorkspaceMemoryCardModel[] = [];
  const disabledCards: WorkspaceMemoryCardModel[] = [];

  memories.forEach((memory) => {
    const metadata = metadataByMemoryId.get(memory.memoryId) || buildDefaultMemoryMetadata(memory);
    const card = buildMemoryCard(memory, metadata, language);
    if (metadata.status === 'enabled') {
      enabledCards.push(card);
      return;
    }
    if (metadata.status === 'disabled') {
      disabledCards.push(card);
      return;
    }
    pendingCards.push(card);
  });

  const dailySummaryCards = dailySummaries
    .slice()
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .map((summary) => ({
      summaryId: summary.summaryId,
      title: summary.title,
      summary: truncateText(summary.contentText),
      statusLabel: getSummaryStatusLabel(summary.extractionStatus, language),
      ctaLabel: getDailySummaryCtaLabel(summary.extractionStatus, language),
    }));

  return {
    sections: [
      {
        id: 'summary',
        title: language === 'zh' ? '摘要区' : 'Summary',
      },
      {
        id: 'pending',
        title: language === 'zh' ? '待确认' : 'Pending',
      },
      {
        id: 'enabled',
        title: language === 'zh' ? '已启用' : 'Enabled',
      },
      {
        id: 'daily_summary',
        title: language === 'zh' ? '每日摘要' : 'Daily summary',
      },
      {
        id: 'disabled',
        title: language === 'zh' ? '已停用' : 'Disabled',
      },
    ],
    summaryCard: {
      title: language === 'zh' ? '记忆' : 'Memory',
      description:
        language === 'zh'
          ? '任何会影响未来推荐和默认行为的记忆，都先在这里可见、可解释、可编辑。'
          : 'Any memory that changes future recommendations or defaults should be visible, explainable, and editable here first.',
      metrics: [
        {
          id: 'enabled',
          label: language === 'zh' ? '已启用' : 'Enabled',
          value: enabledCards.length,
        },
        {
          id: 'pending',
          label: language === 'zh' ? '待确认' : 'Pending',
          value: pendingCards.length,
        },
        {
          id: 'daily_summary',
          label: language === 'zh' ? '今日摘要' : 'Daily summaries',
          value: dailySummaryCards.length,
        },
        {
          id: 'disabled',
          label: language === 'zh' ? '已停用' : 'Disabled',
          value: disabledCards.length,
        },
      ],
    },
    pendingCards,
    enabledCards,
    dailySummaryCards,
    disabledCards,
  };
}
