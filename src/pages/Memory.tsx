import React from 'react';
import { useNavigate } from 'react-router-dom';
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
  loadMemoryWorkspace,
  type LoadedMemoryWorkspace,
} from '@/src/services/memoryWorkspace';
import { DailySummaryCard } from '@/src/pages/memory/DailySummaryCard';
import { MemoryCard } from '@/src/pages/memory/MemoryCard';
import { MemorySection } from '@/src/pages/memory/MemorySection';
import { deriveMemoryWorkspaceModel } from '@/src/pages/memory/memoryWorkspaceModel';

export default function Memory() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const activeDomain = getActiveAnalysisDomain();
  const [workspace, setWorkspace] = React.useState<LoadedMemoryWorkspace>({
    sessionId: '',
    memories: [],
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
        memories: workspace.memories,
        metadataRecords,
        dailySummaries,
        language,
      }),
    [dailySummaries, language, metadataRecords, workspace.memories],
  );

  const sectionTitles = Object.fromEntries(
    model.sections.map((section) => [section.id, section.title]),
  ) as Record<string, string>;

  const copy =
    language === 'zh'
      ? {
          title: '记忆',
          subtitle: '在这里查看候选记忆、已启用偏好、每日摘要和已停用记忆。',
          emptyPending: '当前没有待确认记忆。',
          emptyEnabled: '当前还没有已启用记忆。',
          emptyDailySummary: '当前还没有每日摘要。',
          emptyDisabled: '当前还没有已停用记忆。',
        }
      : {
          title: 'Memory',
          subtitle:
            'Review pending memories, enabled preferences, daily summaries, and disabled memories here.',
          emptyPending: 'No pending memories right now.',
          emptyEnabled: 'No enabled memories yet.',
          emptyDailySummary: 'No daily summaries yet.',
          emptyDisabled: 'No disabled memories yet.',
        };

  const ensureMetadata = React.useCallback(
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
      setMetadataRecords((current) => [created, ...current.filter((entry) => entry.memoryId !== created.memoryId)]);
      return created;
    },
    [metadataRecords, workspace.memories],
  );

  const handleStatusChange = React.useCallback(
    async (memoryId: string, status: 'enabled' | 'disabled') => {
      const metadata = await ensureMetadata(memoryId);
      if (!metadata) {
        return;
      }
      await setMemoryMetadataStatus(memoryId, status);
      await reload();
    },
    [ensureMetadata, reload],
  );

  const handleMemoryAction = React.useCallback(
    async (memoryId: string, action: string) => {
      if (
        action === '查看理由' ||
        action === '查看详情' ||
        action === 'View reason' ||
        action === 'View detail'
      ) {
        navigate(`/memory/${encodeURIComponent(memoryId)}`);
        return;
      }

      if (action === '确认启用' || action === '重新启用' || action === 'Enable' || action === 'Re-enable') {
        await handleStatusChange(memoryId, 'enabled');
        return;
      }

      if (action === '暂不使用' || action === '停用' || action === 'Not now' || action === 'Disable') {
        await handleStatusChange(memoryId, 'disabled');
      }
    },
    [handleStatusChange, navigate],
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
              onOpen={(summaryId) => navigate(`/memory/${encodeURIComponent(`summary:${summaryId}`)}`)}
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
