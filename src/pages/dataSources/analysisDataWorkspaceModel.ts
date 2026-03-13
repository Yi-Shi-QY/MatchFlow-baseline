import type { Match } from '@/src/data/matches';
import type { HistoryRecord } from '@/src/services/history';
import type { SavedSubjectRecord } from '@/src/services/savedSubjects';

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
  subjectDisplay: Match;
  primaryAction: {
    label: string;
    route: string;
    state: {
      importedData: Match;
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
  subjectDisplay: Match;
  sourcePriority: number;
  timestamp: number;
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

function buildMatchTitle(match: Match): string {
  return `${match.homeTeam.name} vs ${match.awayTeam.name}`;
}

function getStatusLabel(status: Match['status'], language: 'zh' | 'en'): string {
  if (language === 'zh') {
    if (status === 'live') return '进行中';
    if (status === 'finished') return '已结束';
    return '待开始';
  }

  if (status === 'live') return 'Live';
  if (status === 'finished') return 'Finished';
  return 'Upcoming';
}

function collectSubjectCandidates(input: {
  activeDomainId: string;
  liveSubjectDisplays: Match[];
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
  activeDomainId: string;
  liveSubjectDisplays: Match[];
  recentHistory: HistoryRecord[];
  language: 'zh' | 'en';
}): RecentUpdateItemModel[] {
  const updates: RecentUpdateItemModel[] = [];

  if (input.liveSubjectDisplays.length > 0) {
    updates.push({
      id: 'live_sync',
      title:
        input.language === 'zh'
          ? `已同步 ${input.liveSubjectDisplays.length} 个可分析对象`
          : `Synced ${input.liveSubjectDisplays.length} analyzable objects`,
      timestampLabel: formatDate(input.liveSubjectDisplays[0].date, input.language),
      context: input.language === 'zh' ? '实时对象' : 'Live feed',
    });
  }

  input.recentHistory.slice(0, 3).forEach((record) => {
    updates.push({
      id: `history:${record.id}`,
      title: buildMatchTitle(record.subjectDisplay),
      timestampLabel: formatTimestamp(record.timestamp, input.language),
      context: input.language === 'zh' ? '最近结果' : 'Recent result',
      route: `/subject/${record.domainId}/${record.subjectId}`,
    });
  });

  return updates.slice(0, 4);
}

export function deriveAnalysisDataWorkspaceModel(input: {
  activeDomainId: string;
  liveSubjectDisplays: Match[];
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
    title: buildMatchTitle(candidate.subjectDisplay),
    subtitle: `${candidate.subjectDisplay.league} · ${formatDate(candidate.subjectDisplay.date, language)}`,
    league: candidate.subjectDisplay.league,
    statusLabel: getStatusLabel(candidate.subjectDisplay.status, language),
    subjectDisplay: candidate.subjectDisplay,
    primaryAction: {
      label: language === 'zh' ? '进入分析' : 'Open analysis',
      route: `/subject/${candidate.domainId}/${candidate.subjectId}`,
      state: {
        importedData: candidate.subjectDisplay,
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
        title: language === 'zh' ? '顶部状态摘要' : 'Status summary',
      },
      {
        id: 'analyzable_objects',
        title: language === 'zh' ? '当前可分析对象' : 'Analyzable objects',
      },
      {
        id: 'data_availability',
        title: language === 'zh' ? '数据可用性' : 'Data availability',
      },
      {
        id: 'recent_updates',
        title: language === 'zh' ? '最近更新' : 'Recent updates',
      },
    ],
    statusCard: {
      title: language === 'zh' ? '分析与数据' : 'Analysis & Data',
      description:
        language === 'zh'
          ? '先看可分析对象，再判断当前数据是否可用。'
          : 'Check analyzable objects first, then confirm whether data is currently available.',
      metrics: [
        {
          id: 'objects',
          label: language === 'zh' ? '可分析对象' : 'Objects',
          value: objectCards.length,
        },
        {
          id: 'saved',
          label: language === 'zh' ? '已保存主题' : 'Saved topics',
          value: savedSubjects.length,
        },
        {
          id: 'recent',
          label: language === 'zh' ? '最近结果' : 'Recent results',
          value: recentHistory.length,
        },
      ],
    },
    objectCards,
    dataAvailabilityCard: {
      kind: 'summary',
      title: language === 'zh' ? '数据可用性' : 'Data availability',
      statusLabel: refreshError
        ? language === 'zh'
          ? '需要处理'
          : 'Needs attention'
        : isRefreshing
          ? language === 'zh'
            ? '刷新中'
            : 'Refreshing'
          : liveSubjectDisplays.length > 0
            ? language === 'zh'
              ? '数据可用'
              : 'Data available'
            : language === 'zh'
              ? '暂无实时对象'
              : 'No live objects',
      description: refreshError
        ? refreshError
        : isRefreshing
          ? language === 'zh'
            ? '正在刷新可分析对象与数据状态。'
            : 'Refreshing analyzable objects and data state.'
          : latestUpdateTimestamp > 0
            ? language === 'zh'
              ? `最近更新：${formatTimestamp(latestUpdateTimestamp, language)}`
              : `Last updated: ${formatTimestamp(latestUpdateTimestamp, language)}`
            : language === 'zh'
              ? '还没有可用的数据更新时间。'
              : 'No data update timestamp is available yet.',
      primaryAction: {
        label: language === 'zh' ? '查看详情' : 'View details',
        route: '/settings/connections',
      },
    },
    recentUpdates: buildRecentUpdates({
      activeDomainId,
      liveSubjectDisplays,
      recentHistory,
      language,
    }),
  };
}
