import { translateText } from '@/src/i18n/translate';
import type { HistoryRecord } from '@/src/services/history';
import type { SavedSubjectRecord } from '@/src/services/savedSubjects';
import type { SubjectDisplay } from '@/src/services/subjectDisplay';

type AnalysisDataSectionId =
  | 'status_summary'
  | 'analyzable_objects'
  | 'data_availability'
  | 'recent_updates';

interface AnalysisDataSection {
  id: AnalysisDataSectionId;
  title: string;
}

interface AnalysisDataMetric {
  id: string;
  label: string;
  value: number;
}

export interface AnalysisDataStatusCardModel {
  title: string;
  description: string;
  metrics: AnalysisDataMetric[];
}

export interface AnalysisObjectCardModel {
  id: string;
  domainId: string;
  subjectId: string;
  title: string;
  subtitle: string;
  league: string;
  statusLabel: string;
  subjectDisplay: SubjectDisplay;
  primaryAction: {
    label: string;
    route: string;
    state: {
      importedData: SubjectDisplay;
      subjectType: string;
    };
  };
}

export interface DataAvailabilityCardModel {
  kind: 'summary';
  title: string;
  statusLabel: string;
  description: string;
  primaryAction: {
    label: string;
    route: string;
  };
}

export interface RecentUpdateItemModel {
  id: string;
  title: string;
  timestampLabel: string;
  context: string;
  route?: string;
}

export interface AnalysisDataWorkspaceModel {
  sections: AnalysisDataSection[];
  statusCard: AnalysisDataStatusCardModel;
  objectCards: AnalysisObjectCardModel[];
  dataAvailabilityCard: DataAvailabilityCardModel;
  recentUpdates: RecentUpdateItemModel[];
}

interface SubjectCandidate {
  domainId: string;
  subjectId: string;
  subjectDisplay: SubjectDisplay;
  sourcePriority: number;
  timestamp: number;
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

function formatDate(value: string, language: 'zh' | 'en'): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: '2-digit',
    day: '2-digit',
  });
}

function buildSubjectTitle(subjectDisplay: SubjectDisplay): string {
  if (typeof subjectDisplay.title === 'string' && subjectDisplay.title.trim().length > 0) {
    return subjectDisplay.title.trim();
  }

  if (subjectDisplay.homeTeam?.name && subjectDisplay.awayTeam?.name) {
    return `${subjectDisplay.homeTeam.name} vs ${subjectDisplay.awayTeam.name}`;
  }

  return subjectDisplay.id;
}

function buildMatchTitle(subjectDisplay: SubjectDisplay): string {
  return buildSubjectTitle(subjectDisplay);
}

function getStatusLabel(status: SubjectDisplay['status'], language: 'zh' | 'en'): string {
  if (status === 'live') {
    return tr(language, 'analysis_data.match_status.live', '进行中', 'Live');
  }
  if (status === 'finished') {
    return tr(language, 'analysis_data.match_status.finished', '已结束', 'Finished');
  }
  return tr(language, 'analysis_data.match_status.upcoming', '待开始', 'Upcoming');
}

function collectSubjectCandidates(input: {
  activeDomainId: string;
  liveSubjectDisplays: SubjectDisplay[];
  savedSubjects: SavedSubjectRecord[];
  recentHistory: HistoryRecord[];
}): SubjectCandidate[] {
  const map = new Map<string, SubjectCandidate>();

  const register = (candidate: SubjectCandidate) => {
    const key = buildSubjectKey(candidate.domainId, candidate.subjectId);
    const previous = map.get(key);
    if (
      !previous ||
      candidate.sourcePriority < previous.sourcePriority ||
      (candidate.sourcePriority === previous.sourcePriority && candidate.timestamp > previous.timestamp)
    ) {
      map.set(key, candidate);
    }
  };

  input.liveSubjectDisplays.forEach((subjectDisplay) => {
    register({
      domainId: input.activeDomainId,
      subjectId: subjectDisplay.id,
      subjectDisplay,
      sourcePriority: 0,
      timestamp: new Date(subjectDisplay.date).getTime() || 0,
    });
  });

  input.savedSubjects.forEach((record) => {
    register({
      domainId: record.domainId,
      subjectId: record.subjectId,
      subjectDisplay: record.subjectDisplay,
      sourcePriority: 1,
      timestamp: record.timestamp,
    });
  });

  input.recentHistory.forEach((record) => {
    register({
      domainId: record.domainId,
      subjectId: record.subjectId,
      subjectDisplay: record.subjectDisplay,
      sourcePriority: 2,
      timestamp: record.timestamp,
    });
  });

  return [...map.values()].sort((left, right) => {
    if (left.sourcePriority !== right.sourcePriority) {
      return left.sourcePriority - right.sourcePriority;
    }
    return right.timestamp - left.timestamp;
  });
}

function buildRecentUpdates(input: {
  liveSubjectDisplays: SubjectDisplay[];
  recentHistory: HistoryRecord[];
  language: 'zh' | 'en';
}): RecentUpdateItemModel[] {
  const updates: RecentUpdateItemModel[] = [];

  if (input.liveSubjectDisplays.length > 0) {
    updates.push({
      id: 'live_sync',
      title: tr(
        input.language,
        'analysis_data.recent.synced_objects',
        '已同步 {{count}} 个可分析对象',
        'Synced {{count}} analyzable objects',
        { count: input.liveSubjectDisplays.length },
      ),
      timestampLabel: formatDate(input.liveSubjectDisplays[0].date, input.language),
      context: tr(
        input.language,
        'analysis_data.recent.live_feed',
        '实时对象',
        'Live feed',
      ),
    });
  }

  input.recentHistory.slice(0, 3).forEach((record) => {
    updates.push({
      id: `history:${record.id}`,
      title: buildSubjectTitle(record.subjectDisplay),
      timestampLabel: formatTimestamp(record.timestamp, input.language),
      context: tr(
        input.language,
        'analysis_data.recent.recent_result',
        '最近结果',
        'Recent result',
      ),
      route: `/subject/${record.domainId}/${record.subjectId}`,
    });
  });

  return updates.slice(0, 4);
}

export function deriveAnalysisDataWorkspaceModel(input: {
  activeDomainId: string;
  liveSubjectDisplays: SubjectDisplay[];
  savedSubjects: SavedSubjectRecord[];
  recentHistory: HistoryRecord[];
  isRefreshing: boolean;
  refreshError: string | null;
  language: 'zh' | 'en';
}): AnalysisDataWorkspaceModel {
  const { activeDomainId, liveSubjectDisplays, savedSubjects, recentHistory, isRefreshing, refreshError, language } =
    input;
  const objectCandidates = collectSubjectCandidates({
    activeDomainId,
    liveSubjectDisplays,
    savedSubjects,
    recentHistory,
  });
  const objectCards = objectCandidates.slice(0, 8).map((candidate) => ({
    id: buildSubjectKey(candidate.domainId, candidate.subjectId),
    domainId: candidate.domainId,
    subjectId: candidate.subjectId,
    title: buildSubjectTitle(candidate.subjectDisplay),
    subtitle: `${candidate.subjectDisplay.league} · ${formatDate(candidate.subjectDisplay.date, language)}`,
    league: candidate.subjectDisplay.league,
    statusLabel: getStatusLabel(candidate.subjectDisplay.status, language),
    subjectDisplay: candidate.subjectDisplay,
    primaryAction: {
      label: tr(language, 'analysis_data.object.open_analysis', '进入分析', 'Open analysis'),
      route: `/subject/${candidate.domainId}/${candidate.subjectId}`,
      state: {
        importedData: candidate.subjectDisplay,
        subjectType: candidate.subjectDisplay.subjectType || 'match',
      },
    },
  }));

  const latestUpdateTimestamp = Math.max(
    0,
    ...savedSubjects.map((entry) => entry.timestamp),
    ...recentHistory.map((entry) => entry.timestamp),
    ...liveSubjectDisplays.map((entry) => new Date(entry.date).getTime() || 0),
  );

  return {
    sections: [
      {
        id: 'status_summary',
        title: tr(language, 'analysis_data.sections.status_summary', '顶部状态摘要', 'Status summary'),
      },
      {
        id: 'analyzable_objects',
        title: tr(
          language,
          'analysis_data.sections.analyzable_objects',
          '当前可分析对象',
          'Analyzable objects',
        ),
      },
      {
        id: 'data_availability',
        title: tr(
          language,
          'analysis_data.sections.data_availability',
          '数据可用性',
          'Data availability',
        ),
      },
      {
        id: 'recent_updates',
        title: tr(language, 'analysis_data.sections.recent_updates', '最近更新', 'Recent updates'),
      },
    ],
    statusCard: {
      title: tr(language, 'analysis_data.status_card.title', '分析与数据', 'Analysis & Data'),
      description: tr(
        language,
        'analysis_data.status_card.description',
        '先看可分析对象，再确认当前数据是否可用。',
        'Check analyzable objects first, then confirm whether data is currently available.',
      ),
      metrics: [
        {
          id: 'objects',
          label: tr(language, 'analysis_data.status_card.metrics.objects', '可分析对象', 'Objects'),
          value: objectCards.length,
        },
        {
          id: 'saved',
          label: tr(language, 'analysis_data.status_card.metrics.saved', '已保存主题', 'Saved topics'),
          value: savedSubjects.length,
        },
        {
          id: 'recent',
          label: tr(language, 'analysis_data.status_card.metrics.recent', '最近结果', 'Recent results'),
          value: recentHistory.length,
        },
      ],
    },
    objectCards,
    dataAvailabilityCard: {
      kind: 'summary',
      title: tr(language, 'analysis_data.availability.title', '数据可用性', 'Data availability'),
      statusLabel: refreshError
        ? tr(language, 'analysis_data.availability.needs_attention', '需要处理', 'Needs attention')
        : isRefreshing
          ? tr(language, 'analysis_data.availability.refreshing', '刷新中', 'Refreshing')
          : liveSubjectDisplays.length > 0
            ? tr(language, 'analysis_data.availability.data_available', '数据可用', 'Data available')
            : tr(language, 'analysis_data.availability.no_live_objects', '暂无实时对象', 'No live objects'),
      description: refreshError
        ? refreshError
        : isRefreshing
          ? tr(
              language,
              'analysis_data.availability.refreshing_description',
              '正在刷新可分析对象与数据状态。',
              'Refreshing analyzable objects and data state.',
            )
          : latestUpdateTimestamp > 0
            ? tr(
                language,
                'analysis_data.availability.last_updated',
                '最近更新：{{timestamp}}',
                'Last updated: {{timestamp}}',
                { timestamp: formatTimestamp(latestUpdateTimestamp, language) },
              )
            : tr(
                language,
                'analysis_data.availability.no_timestamp',
                '还没有可用的数据更新时间。',
                'No data update timestamp is available yet.',
              ),
      primaryAction: {
        label: tr(language, 'analysis_data.availability.view_details', '查看详情', 'View details'),
        route: '/settings/connections',
      },
    },
    recentUpdates: buildRecentUpdates({
      liveSubjectDisplays,
      recentHistory,
      language,
    }),
  };
}
