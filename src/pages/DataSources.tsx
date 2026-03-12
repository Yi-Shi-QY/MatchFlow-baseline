import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Database, RefreshCw, ScanLine, Star } from 'lucide-react';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { getHistory, type HistoryRecord } from '@/src/services/history';
import {
  getSavedSubjects,
  type SavedSubjectRecord,
} from '@/src/services/savedSubjects';
import { getActiveAnalysisDomain } from '@/src/services/domains/registry';
import {
  getDomainUiPresenter,
  resolveHomeEntityDisplay,
  type HomeCenterDisplay,
  type HomeEntityDisplay,
  type HomePresenterContext,
  type ResultPresenterContext,
} from '@/src/services/domains/ui/presenter';
import { buildSubjectRoute } from '@/src/services/navigation/subjectRoute';
import { resolveDomainMatchFeed } from '@/src/services/domainMatchFeed';
import type { SubjectDisplayMatch } from '@/src/services/subjectDisplayMatch';

function renderEntityAvatar(entity: { name: string; logo?: string }) {
  if (entity.logo) {
    return (
      <img
        src={entity.logo}
        alt={entity.name}
        className="h-10 w-10 rounded-full bg-white/5 object-contain p-1"
      />
    );
  }

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-zinc-800 text-sm font-semibold text-zinc-300">
      {(entity.name || '?').slice(0, 1).toUpperCase()}
    </div>
  );
}

function renderCompactEntityDisplay(display: HomeEntityDisplay) {
  if (display.kind === 'pair') {
    return (
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex w-[42%] flex-col items-center gap-2 text-center">
          {renderEntityAvatar(display.primary)}
          <span className="text-sm font-medium text-[var(--mf-text)]">
            {display.primary.name}
          </span>
        </div>
        <div className="text-[10px] font-mono text-[var(--mf-text-muted)]">
          {display.connector}
        </div>
        <div className="flex w-[42%] flex-col items-center gap-2 text-center">
          {renderEntityAvatar(display.secondary)}
          <span className="text-sm font-medium text-[var(--mf-text)]">
            {display.secondary.name}
          </span>
        </div>
      </div>
    );
  }

  if (display.kind === 'single') {
    return (
      <div className="mt-3 flex flex-col items-center gap-2 text-center">
        {renderEntityAvatar(display.entity)}
        <span className="text-sm font-medium text-[var(--mf-text)]">
          {display.entity.name}
        </span>
        {display.caption ? (
          <span className="text-[10px] font-mono text-[var(--mf-text-muted)]">
            {display.caption}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
      {display.entities.slice(0, 6).map((entity, index) => (
        <span
          key={`${entity.id}_${index}`}
          className="rounded-full border border-[var(--mf-border)] bg-[var(--mf-surface-muted)] px-2 py-1 text-[10px] text-[var(--mf-text)]"
        >
          {entity.name}
        </span>
      ))}
    </div>
  );
}

function renderCenterDisplay(display: HomeCenterDisplay) {
  if (display.kind === 'score') {
    return (
      <div className="text-lg font-semibold text-[var(--mf-text)]">
        {display.home} : {display.away}
      </div>
    );
  }

  if (display.kind === 'metrics') {
    return (
      <div className="space-y-1 text-center">
        {display.items.map((item, index) => (
          <div key={`${item.label}_${index}`} className="text-[10px] text-[var(--mf-text-muted)]">
            {item.label}: {item.value}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="text-[10px] font-mono text-[var(--mf-text-muted)]">
      {display.value}
    </div>
  );
}

export default function DataSources() {
  const navigate = useNavigate();
  const { i18n, t } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const activeDomain = getActiveAnalysisDomain();
  const domainUiPresenter = getDomainUiPresenter(activeDomain);
  const homePresenter = domainUiPresenter.home;
  const resultPresenter = domainUiPresenter.result;
  const [savedSubjects, setSavedSubjects] = React.useState<SavedSubjectRecord[]>([]);
  const [recentHistory, setRecentHistory] = React.useState<HistoryRecord[]>([]);
  const [liveSubjectDisplays, setLiveSubjectDisplays] = React.useState<SubjectDisplayMatch[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const translate = React.useCallback(
    (key: string, options?: Record<string, unknown>) => String(t(key, options as never)),
    [t],
  );
  const presenterContext = React.useMemo<HomePresenterContext>(() => {
    const formatTime = (isoDate: string) => {
      const parsed = new Date(isoDate);
      if (Number.isNaN(parsed.getTime())) return '--:--';
      return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (isoDate: string) => {
      const parsed = new Date(isoDate);
      if (Number.isNaN(parsed.getTime())) return '--';
      return parsed.toLocaleDateString();
    };

    return {
      t: translate,
      formatTime,
      formatDate,
    };
  }, [translate]);
  const resultPresenterContext = React.useMemo<ResultPresenterContext>(
    () => ({
      t: translate,
      language,
    }),
    [language, translate],
  );

  const loadData = React.useCallback(async () => {
    setIsRefreshing(true);
    const [saved, history] = await Promise.all([
      getSavedSubjects({ domainId: activeDomain.id }),
      getHistory({ domainId: activeDomain.id }),
    ]);

    const nextSubjectDisplays = await resolveDomainMatchFeed({
      domainId: activeDomain.id,
    });

    setSavedSubjects(saved.slice(0, 6));
    setRecentHistory(history.slice(0, 4));
    setLiveSubjectDisplays(nextSubjectDisplays.slice(0, 12));
    setIsRefreshing(false);
  }, [activeDomain.id]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const copy =
    language === 'zh'
      ? {
          title: '数据源卡片',
          subtitle: '这里专门浏览可分析对象和最近的数据卡片，避免和任务编排混在一起。',
          saved: '已保存对象',
          recent: '最近结果',
          feed: '数据卡片流',
          refresh: '刷新',
          open: '打开分析',
          emptySaved: '还没有已保存对象。',
          emptyRecent: '还没有最近结果。',
          emptyFeed: '当前没有可用数据卡片。',
        }
      : {
          title: 'Source Cards',
          subtitle:
            'Browse analyzable subjects and the latest cards here without mixing them with task orchestration.',
          saved: 'Saved Subjects',
          recent: 'Recent Results',
          feed: 'Source Feed',
          refresh: 'Refresh',
          open: 'Open analysis',
          emptySaved: 'No saved subjects yet.',
          emptyRecent: 'No recent results yet.',
          emptyFeed: 'No source cards are available right now.',
        };

  return (
    <WorkspaceShell
      language={language}
      section="sources"
      title={copy.title}
      subtitle={copy.subtitle}
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-2xl"
            onClick={() => navigate('/scan')}
          >
            <ScanLine className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-2xl"
            onClick={() => void loadData()}
            disabled={isRefreshing}
            title={copy.refresh}
            aria-label={copy.refresh}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      }
    >
      <section className="grid grid-cols-3 gap-3">
        <div className="rounded-[1.5rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/90 p-3 shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--mf-text-muted)]">
            {copy.saved}
          </div>
          <div className="mt-3 text-2xl font-semibold text-[var(--mf-text)]">
            {savedSubjects.length}
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/90 p-3 shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--mf-text-muted)]">
            {copy.recent}
          </div>
          <div className="mt-3 text-2xl font-semibold text-[var(--mf-text)]">
            {recentHistory.length}
          </div>
        </div>
        <div className="rounded-[1.5rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/90 p-3 shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--mf-text-muted)]">
            {copy.feed}
          </div>
          <div className="mt-3 text-2xl font-semibold text-[var(--mf-text)]">
            {liveSubjectDisplays.length}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--mf-text)]">
          <Star className="h-4 w-4 text-[var(--mf-accent)]" />
          {copy.saved}
        </div>
        {savedSubjects.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-[var(--mf-text-muted)]">
              {copy.emptySaved}
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
            {savedSubjects.map((record) => {
              const subjectDisplay = record.subjectDisplay;
              const entityDisplay = resolveHomeEntityDisplay(
                homePresenter,
                subjectDisplay,
                presenterContext,
                record.subjectSnapshot,
              );
              return (
                <Card
                  key={record.subjectId}
                  className="w-52 shrink-0 cursor-pointer overflow-hidden bg-[var(--mf-surface)]/92"
                  onClick={() => navigate(buildSubjectRoute(record.domainId, record.subjectId))}
                >
                  <CardContent className="p-4">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--mf-text-muted)]">
                      {subjectDisplay.league}
                    </div>
                    {renderCompactEntityDisplay(entityDisplay)}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--mf-text)]">
          <Database className="h-4 w-4 text-[var(--mf-accent)]" />
          {copy.feed}
        </div>
        {liveSubjectDisplays.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-[var(--mf-text-muted)]">
              {copy.emptyFeed}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {liveSubjectDisplays.map((subjectDisplay) => {
              const entityDisplay = resolveHomeEntityDisplay(
                homePresenter,
                subjectDisplay,
                presenterContext,
              );
              const centerDisplay = homePresenter.getCenterDisplay(
                subjectDisplay,
                presenterContext,
              );
              return (
                <Card
                  key={subjectDisplay.id}
                  className="cursor-pointer bg-[var(--mf-surface)]/92"
                  onClick={() =>
                    navigate(buildSubjectRoute(activeDomain.id, subjectDisplay.id), {
                      state: { importedData: subjectDisplay },
                    })
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--mf-text-muted)]">
                        {subjectDisplay.league}
                      </div>
                      <div
                        className={`rounded-full border border-[var(--mf-border)] px-2 py-1 text-[10px] ${homePresenter.getStatusClassName(subjectDisplay.status)}`}
                      >
                        {homePresenter.getStatusLabel(subjectDisplay.status, presenterContext)}
                      </div>
                    </div>

                    <div className="mt-4">
                      {renderCompactEntityDisplay(entityDisplay)}
                      <div className="mt-4 flex items-center justify-center">
                        {renderCenterDisplay(centerDisplay)}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[var(--mf-border)] pt-3 text-xs text-[var(--mf-text-muted)]">
                      <span>{copy.open}</span>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="text-sm font-semibold text-[var(--mf-text)]">{copy.recent}</div>
        {recentHistory.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-[var(--mf-text-muted)]">
              {copy.emptyRecent}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentHistory.map((record) => {
              const subjectDisplay = record.subjectDisplay;
              const header = resultPresenter.getHeader(
                subjectDisplay,
                null,
                resultPresenterContext,
                record.subjectSnapshot,
              );
              return (
                <Card
                  key={record.id}
                  className="cursor-pointer bg-[var(--mf-surface)]/92"
                  onClick={() => navigate(buildSubjectRoute(record.domainId, record.subjectId))}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-[var(--mf-text)]">
                          {header.title}
                        </div>
                        <div className="mt-1 text-xs text-[var(--mf-text-muted)]">
                          {header.subtitle || subjectDisplay.league}
                        </div>
                      </div>
                      <div className="text-[10px] font-mono text-[var(--mf-text-muted)]">
                        {new Date(record.timestamp).toLocaleString(
                          language === 'zh' ? 'zh-CN' : 'en-US',
                          {
                            hour12: false,
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          },
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </WorkspaceShell>
  );
}
