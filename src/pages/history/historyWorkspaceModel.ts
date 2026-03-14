import { translateText } from '@/src/i18n/translate';
import type { SubjectDisplayMatch } from '@/src/services/subjectDisplayMatch';
import {
  coerceSubjectSnapshotToDisplayMatch,
} from '@/src/services/subjectDisplayMatch';
import {
  isResumeStateRecoverable,
  type HistoryRecord,
  type SavedResumeState,
} from '@/src/services/history';
import type { SavedSubjectRecord } from '@/src/services/savedSubjects';
import { buildSubjectRoute } from '@/src/services/navigation/subjectRoute';

type HistorySectionId =
  | 'summary'
  | 'recent_completed'
  | 'resumable_topics'
  | 'saved_topics';

interface HistorySection {
  id: HistorySectionId;
  title: string;
}

interface HistorySummaryMetric {
  id: string;
  label: string;
  value: number;
}

interface HistoryPrimaryAction {
  label: string;
  route: string;
  state: {
    importedData: SubjectDisplayMatch;
    subjectSnapshot?: unknown;
    subjectType: string;
  };
}

export interface HistorySummaryCardModel {
  title: string;
  description: string;
  metrics: HistorySummaryMetric[];
}

interface BaseHistoryCardModel {
  id: string;
  domainId: string;
  subjectId: string;
  title: string;
  tag: string;
  metaLabel: string;
  timestampLabel: string;
  primaryAction: HistoryPrimaryAction;
}

export interface HistoryResultCardModel extends BaseHistoryCardModel {
  summary: string;
}

export interface HistoryResumeCardModel extends BaseHistoryCardModel {
  reason: string;
}

export interface HistorySavedTopicCardModel extends BaseHistoryCardModel {
  summary: string;
}

export interface HistoryWorkspaceModel {
  sections: HistorySection[];
  summaryCard: HistorySummaryCardModel;
  recentCompletedCards: HistoryResultCardModel[];
  resumableCards: HistoryResumeCardModel[];
  savedTopicCards: HistorySavedTopicCardModel[];
}

function tr(
  language: 'zh' | 'en',
  key: string,
  zh: string,
  en: string,
  options: Record<string, unknown> = {},
): string {
  return translateText(language, key, language === 'zh' ? zh : en, options);
}

function buildSubjectKey(domainId: string, subjectId: string): string {
  return `${domainId}::${subjectId}`;
}

function formatTimestamp(value: number, language: 'zh' | 'en'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildMatchTitle(subjectDisplay: SubjectDisplayMatch): string {
  return `${subjectDisplay.homeTeam.name} vs ${subjectDisplay.awayTeam.name}`;
}

function getStatusLabel(
  status: SubjectDisplayMatch['status'],
  language: 'zh' | 'en',
): string {
  if (status === 'live') {
    return tr(language, 'history_workspace.match_status.live', '进行中', 'Live');
  }
  if (status === 'finished') {
    return tr(language, 'history_workspace.match_status.finished', '已结束', 'Finished');
  }
  return tr(language, 'history_workspace.match_status.upcoming', '待开始', 'Upcoming');
}

function buildTopicTag(
  subjectDisplay: SubjectDisplayMatch,
  language: 'zh' | 'en',
): string {
  return `${subjectDisplay.league} · ${getStatusLabel(subjectDisplay.status, language)}`;
}

function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/[#>*_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(input: string, maxLength = 120): string {
  const normalized = input.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
}

function deriveResultSummary(
  record: HistoryRecord,
  language: 'zh' | 'en',
): string {
  const envelopeSummary = stripMarkdown(record.analysisOutputEnvelope?.summaryMarkdown || '');
  if (envelopeSummary) {
    return truncateText(envelopeSummary);
  }

  const summary =
    record.parsedStream?.summary && typeof record.parsedStream.summary === 'object'
      ? JSON.stringify(record.parsedStream.summary)
      : '';
  if (summary) {
    return truncateText(summary);
  }

  return tr(
    language,
    'history_workspace.defaults.result_summary',
    '从这里重新打开结果详情，再决定是否继续跟进。',
    'Reopen the result details here before deciding on the next step.',
  );
}

function deriveResumeReason(
  resumeState: SavedResumeState,
  language: 'zh' | 'en',
): string {
  const text = truncateText(
    stripMarkdown(
      resumeState.thoughts ||
        resumeState.state.fullAnalysisText ||
        '',
    ),
  );
  if (text) {
    return text;
  }

  return tr(
    language,
    'history_workspace.defaults.resume_reason',
    '这个主题仍然保留了可恢复的分析上下文。',
    'This topic still has recoverable analysis context.',
  );
}

function deriveSavedSummary(
  language: 'zh' | 'en',
): string {
  return tr(
    language,
    'history_workspace.defaults.saved_summary',
    '保留这个主题，之后可以直接重新打开继续查看。',
    'Keep this topic handy so it can be reopened quickly later.',
  );
}

function buildPrimaryAction(input: {
  language: 'zh' | 'en';
  subjectDisplay: SubjectDisplayMatch;
  subjectSnapshot?: unknown;
  domainId: string;
  subjectId: string;
  label: string;
}): HistoryPrimaryAction {
  return {
    label: input.label,
    route: buildSubjectRoute(input.domainId, input.subjectId),
    state: {
      importedData: input.subjectDisplay,
      subjectSnapshot: input.subjectSnapshot,
      subjectType: input.subjectDisplay.subjectType || 'match',
    },
  };
}

export function deriveHistoryWorkspaceModel(input: {
  historyRecords: HistoryRecord[];
  resumeStates: SavedResumeState[];
  savedSubjects: SavedSubjectRecord[];
  language: 'zh' | 'en';
}): HistoryWorkspaceModel {
  const { historyRecords, resumeStates, savedSubjects, language } = input;
  const usedSubjectKeys = new Set<string>();

  const recentCompletedCards = historyRecords
    .slice()
    .sort((left, right) => right.timestamp - left.timestamp)
    .filter((record) => {
      const key = buildSubjectKey(record.domainId, record.subjectId);
      if (usedSubjectKeys.has(key)) {
        return false;
      }
      usedSubjectKeys.add(key);
      return true;
    })
    .map((record) => ({
      id: `history:${record.id}`,
      domainId: record.domainId,
      subjectId: record.subjectId,
      title: buildMatchTitle(record.subjectDisplay),
      tag: buildTopicTag(record.subjectDisplay, language),
      metaLabel: tr(language, 'history_workspace.meta.completed', '完成时间', 'Completed'),
      timestampLabel: formatTimestamp(record.timestamp, language),
      summary: deriveResultSummary(record, language),
      primaryAction: buildPrimaryAction({
        language,
        subjectDisplay: record.subjectDisplay,
        subjectSnapshot: record.subjectSnapshot,
        domainId: record.domainId,
        subjectId: record.subjectId,
        label: tr(language, 'history_workspace.actions.view_result', '查看结果', 'View result'),
      }),
    }));

  const resumableCards = resumeStates
    .slice()
    .filter((record) => isResumeStateRecoverable(record))
    .sort((left, right) => right.timestamp - left.timestamp)
    .filter((record) => {
      const key = buildSubjectKey(record.domainId, record.subjectId);
      if (usedSubjectKeys.has(key)) {
        return false;
      }
      usedSubjectKeys.add(key);
      return true;
    })
    .map((record) => {
      const subjectDisplay = coerceSubjectSnapshotToDisplayMatch(
        record.state.subjectDisplaySnapshot ?? record.state.subjectSnapshot,
        record.subjectId,
        record.domainId,
      );
      return {
        id: `resume:${record.domainId}:${record.subjectId}`,
        domainId: record.domainId,
        subjectId: record.subjectId,
        title: buildMatchTitle(subjectDisplay),
        tag: buildTopicTag(subjectDisplay, language),
        metaLabel: tr(language, 'history_workspace.meta.last_active', '上次停留', 'Last active'),
        timestampLabel: formatTimestamp(record.timestamp, language),
        reason: deriveResumeReason(record, language),
        primaryAction: buildPrimaryAction({
          language,
          subjectDisplay,
          subjectSnapshot: record.state.subjectSnapshot ?? record.state.subjectDisplaySnapshot,
          domainId: record.domainId,
          subjectId: record.subjectId,
          label: tr(language, 'history_workspace.actions.continue_topic', '继续此主题', 'Continue topic'),
        }),
      };
    });

  const savedTopicCards = savedSubjects
    .slice()
    .sort((left, right) => right.timestamp - left.timestamp)
    .filter((record) => {
      const key = buildSubjectKey(record.domainId, record.subjectId);
      if (usedSubjectKeys.has(key)) {
        return false;
      }
      usedSubjectKeys.add(key);
      return true;
    })
    .map((record) => ({
      id: `saved:${record.id}`,
      domainId: record.domainId,
      subjectId: record.subjectId,
      title: buildMatchTitle(record.subjectDisplay),
      tag: buildTopicTag(record.subjectDisplay, language),
      metaLabel: tr(language, 'history_workspace.meta.saved', '最近保存', 'Saved'),
      timestampLabel: formatTimestamp(record.timestamp, language),
      summary: deriveSavedSummary(language),
      primaryAction: buildPrimaryAction({
        language,
        subjectDisplay: record.subjectDisplay,
        subjectSnapshot: record.subjectSnapshot,
        domainId: record.domainId,
        subjectId: record.subjectId,
        label: tr(language, 'history_workspace.actions.open_topic', '打开主题', 'Open topic'),
      }),
    }));

  return {
    sections: [
      {
        id: 'summary',
        title: tr(language, 'history_workspace.sections.summary', '顶部轻量摘要', 'Summary'),
      },
      {
        id: 'recent_completed',
        title: tr(
          language,
          'history_workspace.sections.recent_completed',
          '最近完成',
          'Recent completed',
        ),
      },
      {
        id: 'resumable_topics',
        title: tr(
          language,
          'history_workspace.sections.resumable_topics',
          '可继续内容',
          'Resumable topics',
        ),
      },
      {
        id: 'saved_topics',
        title: tr(
          language,
          'history_workspace.sections.saved_topics',
          '已保存主题',
          'Saved topics',
        ),
      },
    ],
    summaryCard: {
      title: tr(language, 'history_workspace.summary_card.title', '历史', 'History'),
      description: tr(
        language,
        'history_workspace.summary_card.description',
        '先看最近产出的结果，再决定是否恢复旧主题或打开已保存主题。',
        'Start with recent completed results, then decide whether to resume an older topic or reopen a saved one.',
      ),
      metrics: [
        {
          id: 'recent_completed',
          label: tr(language, 'history_workspace.summary_card.metrics.completed', '最近完成', 'Completed'),
          value: recentCompletedCards.length,
        },
        {
          id: 'resumable_topics',
          label: tr(language, 'history_workspace.summary_card.metrics.resumable', '可继续', 'Resumable'),
          value: resumableCards.length,
        },
        {
          id: 'saved_topics',
          label: tr(language, 'history_workspace.summary_card.metrics.saved', '已保存', 'Saved'),
          value: savedTopicCards.length,
        },
      ],
    },
    recentCompletedCards,
    resumableCards,
    savedTopicCards,
  };
}
