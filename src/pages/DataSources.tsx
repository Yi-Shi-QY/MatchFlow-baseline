import React from 'react';
import { useTranslation } from 'react-i18next';
import { Database, RefreshCw, ScanLine, Sparkles } from 'lucide-react';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { AnalysisDataStatusCard } from '@/src/pages/dataSources/AnalysisDataStatusCard';
import { AnalyzableObjectCard } from '@/src/pages/dataSources/AnalyzableObjectCard';
import { DataAvailabilityCard } from '@/src/pages/dataSources/DataAvailabilityCard';
import { RecentSyncCard } from '@/src/pages/dataSources/RecentSyncCard';
import { useAnalysisDataWorkspaceState } from '@/src/pages/dataSources/useAnalysisDataWorkspaceState';
import { useWorkspaceNavigation } from '@/src/services/navigation/useWorkspaceNavigation';
import { withWorkspaceBackContext } from '@/src/services/navigation/workspaceBackNavigation';

export default function DataSources() {
  const { openRoute } = useWorkspaceNavigation();
  const { t, i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const state = useAnalysisDataWorkspaceState(language);
  const sectionTitles = Object.fromEntries(
    state.model.sections.map((section) => [section.id, section.title]),
  ) as Record<string, string>;

  const copy = {
    title: t('analysis_data.page.title', {
      defaultValue: language === 'zh' ? '分析与数据' : 'Analysis & Data',
    }),
    subtitle: t('analysis_data.page.subtitle', {
      defaultValue:
        language === 'zh'
          ? '先确认现在能分析什么，再快速判断数据是否可用以及最近是否更新。'
          : 'Start with what can be analyzed right now, then confirm whether the data is available and recently updated.',
    }),
    emptyObjects: t('analysis_data.page.empty_objects', {
      defaultValue:
        language === 'zh'
          ? '当前还没有可进入分析的对象。'
          : 'No analyzable objects are available right now.',
    }),
    emptyRecent: t('analysis_data.page.empty_recent', {
      defaultValue:
        language === 'zh'
          ? '最近还没有同步或更新记录。'
          : 'No recent sync or update events yet.',
    }),
    refresh: t('analysis_data.page.refresh', {
      defaultValue: language === 'zh' ? '刷新' : 'Refresh',
    }),
    scan: t('analysis_data.page.scan', {
      defaultValue: language === 'zh' ? '扫描' : 'Scan',
    }),
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
            onClick={() =>
              openRoute('/scan', {
                state: withWorkspaceBackContext(undefined, '/sources'),
              })
            }
            title={copy.scan}
            aria-label={copy.scan}
          >
            <ScanLine className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-2xl"
            onClick={() => void state.reload()}
            disabled={state.isRefreshing}
            title={copy.refresh}
            aria-label={copy.refresh}
          >
            <RefreshCw className={`h-4 w-4 ${state.isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      }
    >
      <AnalysisDataStatusCard model={state.model.statusCard} />

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--mf-text)]">
          <Sparkles className="h-4 w-4 text-[var(--mf-accent)]" />
          {sectionTitles.analyzable_objects}
        </div>
        {state.model.objectCards.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-[var(--mf-text-muted)]">
              {copy.emptyObjects}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {state.model.objectCards.map((card) => (
              <AnalyzableObjectCard
                key={card.id}
                model={card}
                onOpen={(route, routeState) =>
                  openRoute(route, {
                    state: withWorkspaceBackContext(routeState, '/sources'),
                  })
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--mf-text)]">
          <Database className="h-4 w-4 text-[var(--mf-accent)]" />
          {sectionTitles.data_availability}
        </div>
        <DataAvailabilityCard model={state.model.dataAvailabilityCard} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--mf-text)]">
          <RefreshCw className="h-4 w-4 text-[var(--mf-accent)]" />
          {sectionTitles.recent_updates}
        </div>
        <RecentSyncCard items={state.model.recentUpdates} emptyText={copy.emptyRecent} />
      </section>
    </WorkspaceShell>
  );
}
