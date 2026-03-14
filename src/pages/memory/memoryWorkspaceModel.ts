import { translateText } from '@/src/i18n/translate';
import type {
  DailySummaryMetadataRecord,
  MemoryMetadataRecord,
} from '@/src/services/memoryMetadata';
import {
  buildDefaultCandidateMetadata,
  buildDefaultMemoryMetadata,
} from '@/src/services/memoryMetadata';
import type {
  LoadedMemoryCandidate,
  LoadedMemoryRecord,
} from '@/src/services/memoryWorkspace';

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

type WorkspaceItem =
  | { kind: 'memory'; record: LoadedMemoryRecord }
  | { kind: 'candidate'; record: LoadedMemoryCandidate };

function tr(
  language: 'zh' | 'en',
  key: string,
  zh: string,
  en: string,
  options: Record<string, unknown> = {},
): string {
  return translateText(language, key, language === 'zh' ? zh : en, options);
}

function truncateText(input: string, maxLength = 120): string {
  const normalized = input.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function getScopeLabel(
  item: Pick<LoadedMemoryRecord, 'scopeType'> | Pick<LoadedMemoryCandidate, 'scopeType'>,
  language: 'zh' | 'en',
): string {
  if (item.scopeType === 'global') {
    return tr(language, 'memory_workspace.scope.global', '全局', 'Global');
  }
  if (item.scopeType === 'session') {
    return tr(language, 'memory_workspace.scope.session', '当前会话', 'Session');
  }
  return tr(language, 'memory_workspace.scope.domain', '当前领域', 'Domain');
}

function getStatusLabel(
  status: MemoryMetadataRecord['status'],
  language: 'zh' | 'en',
): string {
  if (status === 'enabled') {
    return tr(language, 'memory_workspace.status.enabled', '已启用', 'Enabled');
  }
  if (status === 'disabled') {
    return tr(language, 'memory_workspace.status.disabled', '已停用', 'Disabled');
  }
  return tr(language, 'memory_workspace.status.pending', '待确认', 'Pending');
}

function getSummaryStatusLabel(
  status: DailySummaryMetadataRecord['extractionStatus'],
  language: 'zh' | 'en',
): string {
  if (status === 'completed') {
    return tr(language, 'memory_workspace.daily_summary_status.completed', '已提炼', 'Generated');
  }
  if (status === 'partial') {
    return tr(
      language,
      'memory_workspace.daily_summary_status.partial',
      '部分提炼',
      'Partially generated',
    );
  }
  return tr(language, 'memory_workspace.daily_summary_status.pending', '未提炼', 'Not generated');
}

function getDailySummaryCtaLabel(
  status: DailySummaryMetadataRecord['extractionStatus'],
  language: 'zh' | 'en',
): string {
  if (status === 'completed') {
    return tr(
      language,
      'memory_workspace.daily_summary_cta.completed',
      '查看已生成记忆',
      'View generated memories',
    );
  }
  if (status === 'partial') {
    return tr(
      language,
      'memory_workspace.daily_summary_cta.partial',
      '查看提炼结果',
      'View extraction result',
    );
  }
  return tr(
    language,
    'memory_workspace.daily_summary_cta.generate',
    '生成记忆',
    'Generate memories',
  );
}

function buildCardActions(args: {
  kind: WorkspaceItem['kind'];
  status: MemoryMetadataRecord['status'];
  language: 'zh' | 'en';
}): string[] {
  if (args.status === 'pending') {
    return [
      tr(args.language, 'memory_workspace.actions.view_reason', '查看理由', 'View reason'),
      tr(args.language, 'memory_workspace.actions.enable', '确认启用', 'Enable'),
      tr(args.language, 'memory_workspace.actions.not_now', '暂不使用', 'Not now'),
    ];
  }

  if (args.status === 'enabled') {
    return [
      tr(args.language, 'memory_workspace.actions.view_detail', '查看详情', 'View detail'),
      tr(args.language, 'memory_workspace.actions.disable', '停用', 'Disable'),
    ];
  }

  return [
    tr(
      args.language,
      args.kind === 'candidate'
        ? 'memory_workspace.actions.view_reason'
        : 'memory_workspace.actions.view_detail',
      args.kind === 'candidate' ? '查看理由' : '查看详情',
      args.kind === 'candidate' ? 'View reason' : 'View detail',
    ),
    tr(args.language, 'memory_workspace.actions.re_enable', '重新启用', 'Re-enable'),
  ];
}

function buildWorkspaceCard(
  item: WorkspaceItem,
  metadata: MemoryMetadataRecord,
  language: 'zh' | 'en',
): WorkspaceMemoryCardModel {
  const record = item.record;
  const primaryText =
    metadata.reasoning ||
    ('contentText' in record ? record.contentText : '');

  return {
    memoryId: item.kind === 'candidate' ? item.record.candidateId : item.record.memoryId,
    title: metadata.title || record.title,
    statusLabel: getStatusLabel(metadata.status, language),
    summary: truncateText(primaryText),
    scopeLabel: getScopeLabel(record, language),
    actions: buildCardActions({
      kind: item.kind,
      status: metadata.status,
      language,
    }),
  };
}

export function deriveMemoryWorkspaceModel(input: {
  candidates?: LoadedMemoryCandidate[];
  memories: LoadedMemoryRecord[];
  metadataRecords: MemoryMetadataRecord[];
  dailySummaries: DailySummaryMetadataRecord[];
  language: 'zh' | 'en';
}): MemoryWorkspacePageModel {
  const {
    candidates = [],
    memories,
    metadataRecords,
    dailySummaries,
    language,
  } = input;
  const metadataByMemoryId = new Map(
    metadataRecords.map((record) => [record.memoryId, record]),
  );

  const pendingCandidateCards: WorkspaceMemoryCardModel[] = [];
  const pendingMemoryCards: WorkspaceMemoryCardModel[] = [];
  const enabledCards: WorkspaceMemoryCardModel[] = [];
  const disabledCards: WorkspaceMemoryCardModel[] = [];

  candidates
    .slice()
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .forEach((candidate) => {
      if (candidate.status === 'enabled') {
        return;
      }

      const metadata =
        metadataByMemoryId.get(candidate.candidateId) ||
        buildDefaultCandidateMetadata(candidate);
      const card = buildWorkspaceCard(
        { kind: 'candidate', record: candidate },
        metadata,
        language,
      );

      if (metadata.status === 'disabled') {
        disabledCards.push(card);
        return;
      }

      pendingCandidateCards.push(card);
    });

  memories.forEach((memory) => {
    const metadata = metadataByMemoryId.get(memory.memoryId) || buildDefaultMemoryMetadata(memory);
    const card = buildWorkspaceCard({ kind: 'memory', record: memory }, metadata, language);
    if (metadata.status === 'enabled') {
      enabledCards.push(card);
      return;
    }
    if (metadata.status === 'disabled') {
      disabledCards.push(card);
      return;
    }
    pendingMemoryCards.push(card);
  });

  const pendingCards = [...pendingCandidateCards, ...pendingMemoryCards];
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
        title: tr(language, 'memory_workspace.sections.summary', '摘要区', 'Summary'),
      },
      {
        id: 'pending',
        title: tr(language, 'memory_workspace.sections.pending', '待确认', 'Pending'),
      },
      {
        id: 'enabled',
        title: tr(language, 'memory_workspace.sections.enabled', '已启用', 'Enabled'),
      },
      {
        id: 'daily_summary',
        title: tr(
          language,
          'memory_workspace.sections.daily_summary',
          '每日摘要',
          'Daily summary',
        ),
      },
      {
        id: 'disabled',
        title: tr(language, 'memory_workspace.sections.disabled', '已停用', 'Disabled'),
      },
    ],
    summaryCard: {
      title: tr(language, 'memory_workspace.summary_card.title', '记忆', 'Memory'),
      description: tr(
        language,
        'memory_workspace.summary_card.description',
        '任何会影响未来推荐和默认行为的记忆，都应该先在这里可见、可解释、可编辑。',
        'Any memory that changes future recommendations or defaults should be visible, explainable, and editable here first.',
      ),
      metrics: [
        {
          id: 'enabled',
          label: tr(
            language,
            'memory_workspace.summary_card.metrics.enabled',
            '已启用',
            'Enabled',
          ),
          value: enabledCards.length,
        },
        {
          id: 'pending',
          label: tr(
            language,
            'memory_workspace.summary_card.metrics.pending',
            '待确认',
            'Pending',
          ),
          value: pendingCards.length,
        },
        {
          id: 'daily_summary',
          label: tr(
            language,
            'memory_workspace.summary_card.metrics.daily_summary',
            '今日摘要',
            'Daily summaries',
          ),
          value: dailySummaryCards.length,
        },
        {
          id: 'disabled',
          label: tr(
            language,
            'memory_workspace.summary_card.metrics.disabled',
            '已停用',
            'Disabled',
          ),
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
