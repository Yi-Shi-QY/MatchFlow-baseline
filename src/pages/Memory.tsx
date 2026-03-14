import React from 'react';
import { useTranslation } from 'react-i18next';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';
import { getActiveAnalysisDomain } from '@/src/services/domains/registry';
import {
  buildDefaultMemoryMetadata,
  listDailySummaryMetadata,
  listMemoryMetadata,
  setMemoryMetadataStatus,
  upsertMemoryMetadata,
  type DailySummaryMetadataRecord,
  type MemoryMetadataRecord,
} from '@/src/services/memoryMetadata';
import {
  dismissMemoryCandidate,
  enableMemoryCandidate,
} from '@/src/services/memoryCandidateStore';
import {
  loadMemoryWorkspace,
  type LoadedMemoryWorkspace,
} from '@/src/services/memoryWorkspace';
import { DailySummaryCard } from '@/src/pages/memory/DailySummaryCard';
import { MemoryCard } from '@/src/pages/memory/MemoryCard';
import { MemorySection } from '@/src/pages/memory/MemorySection';
import { deriveMemoryWorkspaceModel } from '@/src/pages/memory/memoryWorkspaceModel';
import { useWorkspaceNavigation } from '@/src/services/navigation/useWorkspaceNavigation';
import { withWorkspaceBackContext } from '@/src/services/navigation/workspaceBackNavigation';

export default function Memory() {
  const { openRoute } = useWorkspaceNavigation();
  const { t, i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const activeDomain = getActiveAnalysisDomain();
  const [workspace, setWorkspace] = React.useState<LoadedMemoryWorkspace>({
    sessionId: '',
    memories: [],
    candidates: [],
  });
  const [metadataRecords, setMetadataRecords] = React.useState<MemoryMetadataRecord[]>([]);
  const [dailySummaries, setDailySummaries] = React.useState<DailySummaryMetadataRecord[]>([]);

  const reload = React.useCallback(async () => {
    const [nextWorkspace, nextMetadata, nextDailySummaries] = await Promise.all([
      loadMemoryWorkspace({
        domainId: activeDomain.id,
      }),
      listMemoryMetadata(),
      listDailySummaryMetadata(),
    ]);
    setWorkspace(nextWorkspace);
    setMetadataRecords(nextMetadata);
    setDailySummaries(nextDailySummaries);
  }, [activeDomain.id]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const model = React.useMemo(
    () =>
      deriveMemoryWorkspaceModel({
        candidates: workspace.candidates,
        memories: workspace.memories,
        metadataRecords,
        dailySummaries,
        language,
      }),
    [dailySummaries, language, metadataRecords, workspace.candidates, workspace.memories],
  );

  const sectionTitles = Object.fromEntries(
    model.sections.map((section) => [section.id, section.title]),
  ) as Record<string, string>;

  const copy = {
    title: t('memory_workspace.page.title', {
      defaultValue: language === 'zh' ? '记忆' : 'Memory',
    }),
    subtitle: t('memory_workspace.page.subtitle', {
      defaultValue:
        language === 'zh'
          ? '在这里查看候选记忆、已启用偏好、每日摘要和已停用记忆。'
          : 'Review pending memories, enabled preferences, daily summaries, and disabled memories here.',
    }),
    emptyPending: t('memory_workspace.page.empty_pending', {
      defaultValue: language === 'zh' ? '当前没有待确认记忆。' : 'No pending memories right now.',
    }),
    emptyEnabled: t('memory_workspace.page.empty_enabled', {
      defaultValue: language === 'zh' ? '当前还没有已启用记忆。' : 'No enabled memories yet.',
    }),
    emptyDailySummary: t('memory_workspace.page.empty_daily_summary', {
      defaultValue: language === 'zh' ? '当前还没有每日摘要。' : 'No daily summaries yet.',
    }),
    emptyDisabled: t('memory_workspace.page.empty_disabled', {
      defaultValue: language === 'zh' ? '当前还没有已停用记忆。' : 'No disabled memories yet.',
    }),
    actionViewReason: t('memory_workspace.actions.view_reason', {
      defaultValue: language === 'zh' ? '查看理由' : 'View reason',
    }),
    actionViewDetail: t('memory_workspace.actions.view_detail', {
      defaultValue: language === 'zh' ? '查看详情' : 'View detail',
    }),
    actionEnable: t('memory_workspace.actions.enable', {
      defaultValue: language === 'zh' ? '确认启用' : 'Enable',
    }),
    actionReEnable: t('memory_workspace.actions.re_enable', {
      defaultValue: language === 'zh' ? '重新启用' : 'Re-enable',
    }),
    actionNotNow: t('memory_workspace.actions.not_now', {
      defaultValue: language === 'zh' ? '暂不使用' : 'Not now',
    }),
    actionDisable: t('memory_workspace.actions.disable', {
      defaultValue: language === 'zh' ? '停用' : 'Disable',
    }),
  };

  const ensureMemoryMetadata = React.useCallback(
    async (memoryId: string) => {
      const existing = metadataRecords.find((record) => record.memoryId === memoryId);
      if (existing) {
        return existing;
      }

      const memory = workspace.memories.find((entry) => entry.memoryId === memoryId);
      if (!memory) {
        return null;
      }

      const created = await upsertMemoryMetadata(buildDefaultMemoryMetadata(memory));
      setMetadataRecords((current) => [
        created,
        ...current.filter((entry) => entry.memoryId !== created.memoryId),
      ]);
      return created;
    },
    [metadataRecords, workspace.memories],
  );

  const handleMemoryStatusChange = React.useCallback(
    async (memoryId: string, status: 'enabled' | 'disabled') => {
      const metadata = await ensureMemoryMetadata(memoryId);
      if (!metadata) {
        return;
      }
      await setMemoryMetadataStatus(memoryId, status);
      await reload();
    },
    [ensureMemoryMetadata, reload],
  );

  const handleMemoryAction = React.useCallback(
    async (memoryId: string, action: string) => {
      if (action === copy.actionViewReason || action === copy.actionViewDetail) {
        openRoute(`/memory/${encodeURIComponent(memoryId)}`, {
          state: withWorkspaceBackContext(undefined, '/memory'),
        });
        return;
      }

      const candidate = workspace.candidates.find((entry) => entry.candidateId === memoryId);
      if (candidate) {
        if (action === copy.actionEnable || action === copy.actionReEnable) {
          await enableMemoryCandidate({
            candidateId: candidate.candidateId,
          });
          await reload();
          return;
        }

        if (action === copy.actionNotNow || action === copy.actionDisable) {
          await dismissMemoryCandidate(candidate.candidateId);
          await reload();
        }
        return;
      }

      if (action === copy.actionEnable || action === copy.actionReEnable) {
        await handleMemoryStatusChange(memoryId, 'enabled');
        return;
      }

      if (action === copy.actionNotNow || action === copy.actionDisable) {
        await handleMemoryStatusChange(memoryId, 'disabled');
      }
    },
    [
      copy.actionDisable,
      copy.actionEnable,
      copy.actionNotNow,
      copy.actionReEnable,
      copy.actionViewDetail,
      copy.actionViewReason,
      handleMemoryStatusChange,
      openRoute,
      reload,
      workspace.candidates,
    ],
  );

  return (
    <WorkspaceShell language={language} section="memory" title={copy.title} subtitle={copy.subtitle}>
      <section className="rounded-[1.6rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-4 shadow-sm">
        <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
          {model.summaryCard.title}
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--mf-text-muted)]">
          {model.summaryCard.description}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {model.summaryCard.metrics.map((metric) => (
            <div
              key={metric.id}
              className="rounded-[1.2rem] border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-3 py-3"
            >
              <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">
                {metric.label}
              </div>
              <div className="mt-2 text-xl font-semibold text-[var(--mf-text)]">{metric.value}</div>
            </div>
          ))}
        </div>
      </section>

      <MemorySection
        title={sectionTitles.pending}
        emptyText={copy.emptyPending}
        hasItems={model.pendingCards.length > 0}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {model.pendingCards.map((card) => (
            <MemoryCard key={card.memoryId} card={card} onAction={handleMemoryAction} />
          ))}
        </div>
      </MemorySection>

      <MemorySection
        title={sectionTitles.enabled}
        emptyText={copy.emptyEnabled}
        hasItems={model.enabledCards.length > 0}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {model.enabledCards.map((card) => (
            <MemoryCard key={card.memoryId} card={card} onAction={handleMemoryAction} />
          ))}
        </div>
      </MemorySection>

      <MemorySection
        title={sectionTitles.daily_summary}
        emptyText={copy.emptyDailySummary}
        hasItems={model.dailySummaryCards.length > 0}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {model.dailySummaryCards.map((card) => (
            <DailySummaryCard
              key={card.summaryId}
              card={card}
              onOpen={(summaryId) =>
                openRoute(`/memory/${encodeURIComponent(`summary:${summaryId}`)}`, {
                  state: withWorkspaceBackContext(undefined, '/memory'),
                })
              }
            />
          ))}
        </div>
      </MemorySection>

      <MemorySection
        title={sectionTitles.disabled}
        emptyText={copy.emptyDisabled}
        hasItems={model.disabledCards.length > 0}
      >
        <div className="grid gap-3 md:grid-cols-2">
          {model.disabledCards.map((card) => (
            <MemoryCard key={card.memoryId} card={card} onAction={handleMemoryAction} />
          ))}
        </div>
      </MemorySection>
    </WorkspaceShell>
  );
}
