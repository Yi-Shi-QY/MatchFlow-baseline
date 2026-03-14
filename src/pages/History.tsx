import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookmarkCheck, History as HistoryIcon, RotateCcw } from 'lucide-react';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';
import { Card, CardContent } from '@/src/components/ui/Card';
import { HistoryResultCard } from '@/src/pages/history/HistoryResultCard';
import { HistoryResumeCard } from '@/src/pages/history/HistoryResumeCard';
import { HistorySavedTopicCard } from '@/src/pages/history/HistorySavedTopicCard';
import { HistorySummaryCard } from '@/src/pages/history/HistorySummaryCard';
import { useHistoryWorkspaceState } from '@/src/pages/history/useHistoryWorkspaceState';
import { useWorkspaceNavigation } from '@/src/services/navigation/useWorkspaceNavigation';
import { withWorkspaceBackContext } from '@/src/services/navigation/workspaceBackNavigation';

export default function History() {
  const { openRoute } = useWorkspaceNavigation();
  const { t, i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const state = useHistoryWorkspaceState(language);
  const sectionTitles = Object.fromEntries(
    state.model.sections.map((section) => [section.id, section.title]),
  ) as Record<string, string>;

  const copy = {
    title: t('history_workspace.page.title', {
      defaultValue: language === 'zh' ? '历史' : 'History',
    }),
    subtitle: t('history_workspace.page.subtitle', {
      defaultValue:
        language === 'zh'
          ? '从这里回看最近完成的结果、恢复旧主题，或重新打开已保存的长期主题。'
          : 'Review recent completed results, resume older topics, or reopen long-lived saved topics from here.',
    }),
    emptyCompleted: t('history_workspace.page.empty_completed', {
      defaultValue: language === 'zh' ? '最近还没有已完成的结果。' : 'No completed results yet.',
    }),
    emptyResumable: t('history_workspace.page.empty_resumable', {
      defaultValue:
        language === 'zh'
          ? '当前没有可恢复的历史主题。'
          : 'No resumable topics are available right now.',
    }),
    emptySaved: t('history_workspace.page.empty_saved', {
      defaultValue: language === 'zh' ? '还没有已保存主题。' : 'No saved topics yet.',
    }),
  };

  return (
    <WorkspaceShell
      language={language}
      section="history"
      title={copy.title}
      subtitle={copy.subtitle}
    >
      <HistorySummaryCard model={state.model.summaryCard} />

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--mf-text)]">
          <HistoryIcon className="h-4 w-4 text-[var(--mf-accent)]" />
          {sectionTitles.recent_completed}
        </div>
        {state.model.recentCompletedCards.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-[var(--mf-text-muted)]">
              {copy.emptyCompleted}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {state.model.recentCompletedCards.map((card) => (
              <HistoryResultCard
                key={card.id}
                model={card}
                onOpen={(route, routeState) =>
                  openRoute(route, {
                    state: withWorkspaceBackContext(routeState, '/history'),
                  })
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--mf-text)]">
          <RotateCcw className="h-4 w-4 text-[var(--mf-accent)]" />
          {sectionTitles.resumable_topics}
        </div>
        {state.model.resumableCards.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-[var(--mf-text-muted)]">
              {copy.emptyResumable}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {state.model.resumableCards.map((card) => (
              <HistoryResumeCard
                key={card.id}
                model={card}
                onOpen={(route, routeState) =>
                  openRoute(route, {
                    state: withWorkspaceBackContext(routeState, '/history'),
                  })
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--mf-text)]">
          <BookmarkCheck className="h-4 w-4 text-[var(--mf-accent)]" />
          {sectionTitles.saved_topics}
        </div>
        {state.model.savedTopicCards.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-[var(--mf-text-muted)]">
              {copy.emptySaved}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {state.model.savedTopicCards.map((card) => (
              <HistorySavedTopicCard
                key={card.id}
                model={card}
                onOpen={(route, routeState) =>
                  openRoute(route, {
                    state: withWorkspaceBackContext(routeState, '/history'),
                  })
                }
              />
            ))}
          </div>
        )}
      </section>
    </WorkspaceShell>
  );
}
