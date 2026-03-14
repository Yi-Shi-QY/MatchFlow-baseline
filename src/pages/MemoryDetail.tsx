import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { getActiveAnalysisDomain } from '@/src/services/domains/registry';
import { createManagerSessionStore } from '@/src/services/manager-gateway/sessionStore';
import {
  buildDefaultCandidateMetadata,
  buildDefaultMemoryMetadata,
  getDailySummaryMetadata,
  getMemoryMetadata,
  listDailySummaryMetadata,
  listMemoryMetadata,
  setMemoryMetadataStatus,
  upsertDailySummaryMetadata,
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
import { useWorkspaceNavigation } from '@/src/services/navigation/useWorkspaceNavigation';
import { withWorkspaceBackContext } from '@/src/services/navigation/workspaceBackNavigation';

function buildMemoryKey(input: {
  scopeType: 'global' | 'domain' | 'session';
  scopeId: string;
  memoryType: string;
  keyText: string;
}): string {
  return `${input.scopeType}:${input.scopeId}:${input.memoryType}:${input.keyText}`;
}

export default function MemoryDetail() {
  const { memoryId } = useParams();
  const { navigate, openRoute } = useWorkspaceNavigation();
  const { t, i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const copy = {
    title: t('memory_detail.title', {
      defaultValue: language === 'zh' ? '记忆详情' : 'Memory Detail',
    }),
    notFound: t('memory_detail.not_found', {
      defaultValue:
        language === 'zh'
          ? '没有找到对应的记忆、候选记忆或摘要。'
          : 'The requested memory, candidate, or summary could not be found.',
    }),
    reasoning: t('memory_detail.reasoning', {
      defaultValue: language === 'zh' ? '判断依据与来源' : 'Reasoning and sources',
    }),
    impact: t('memory_detail.impact', {
      defaultValue: language === 'zh' ? '影响说明' : 'Impact',
    }),
    preview: t('memory_detail.preview', {
      defaultValue: language === 'zh' ? '内容预览' : 'Content preview',
    }),
    actions: t('memory_detail.actions', {
      defaultValue: language === 'zh' ? '操作区' : 'Actions',
    }),
    summaryResult: t('memory_detail.summary_result', {
      defaultValue: language === 'zh' ? '提炼结果' : 'Extraction result',
    }),
    editEnable: t('memory_detail.edit_enable', {
      defaultValue: language === 'zh' ? '编辑后启用' : 'Save and enable',
    }),
    saveBody: t('memory_detail.save_body', {
      defaultValue: language === 'zh' ? '保存内容' : 'Save content',
    }),
    disable: t('memory_detail.disable', {
      defaultValue: language === 'zh' ? '停用' : 'Disable',
    }),
    notNow: t('memory_detail.not_now', {
      defaultValue: language === 'zh' ? '暂不使用' : 'Not now',
    }),
    reEnable: t('memory_detail.re_enable', {
      defaultValue: language === 'zh' ? '重新启用' : 'Re-enable',
    }),
    viewExisting: t('memory_detail.view_existing', {
      defaultValue: language === 'zh' ? '查看现有记忆' : 'View existing memory',
    }),
    mergeEnable: t('memory_detail.merge_enable', {
      defaultValue: language === 'zh' ? '合并后启用' : 'Merge and enable',
    }),
    saveAsNew: t('memory_detail.save_as_new', {
      defaultValue: language === 'zh' ? '仍作为新记忆保存' : 'Keep as new memory',
    }),
    generateMemory: t('memory_detail.generate_memory', {
      defaultValue: language === 'zh' ? '生成记忆' : 'Generate memories',
    }),
    viewGenerated: t('memory_detail.view_generated', {
      defaultValue: language === 'zh' ? '查看已生成记忆' : 'View generated memories',
    }),
    viewExtraction: t('memory_detail.view_extraction', {
      defaultValue: language === 'zh' ? '查看提炼结果' : 'View extraction result',
    }),
    similarMemoryNotice: t('memory_detail.similar_memory_notice', {
      defaultValue:
        language === 'zh'
          ? '检测到相近记忆，启用前可以先查看或合并。'
          : 'A similar memory was found. Review or merge it before enabling.',
    }),
  };
  const activeDomain = getActiveAnalysisDomain();
  const requestedId = decodeURIComponent(memoryId || '');
  const [workspace, setWorkspace] = React.useState<LoadedMemoryWorkspace>({
    sessionId: '',
    memories: [],
    candidates: [],
  });
  const [metadataRecords, setMetadataRecords] = React.useState<MemoryMetadataRecord[]>([]);
  const [dailySummaries, setDailySummaries] = React.useState<DailySummaryMetadataRecord[]>([]);
  const [draftContent, setDraftContent] = React.useState('');

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

  const memory = React.useMemo(
    () => workspace.memories.find((entry) => entry.memoryId === requestedId) || null,
    [requestedId, workspace.memories],
  );
  const candidate = React.useMemo(
    () => workspace.candidates.find((entry) => entry.candidateId === requestedId) || null,
    [requestedId, workspace.candidates],
  );
  const memoryMetadata = React.useMemo(() => {
    if (!memory) {
      return null;
    }
    return (
      metadataRecords.find((entry) => entry.memoryId === memory.memoryId) ||
      buildDefaultMemoryMetadata(memory)
    );
  }, [memory, metadataRecords]);
  const candidateMetadata = React.useMemo(() => {
    if (!candidate) {
      return null;
    }
    return (
      metadataRecords.find((entry) => entry.memoryId === candidate.candidateId) ||
      buildDefaultCandidateMetadata(candidate)
    );
  }, [candidate, metadataRecords]);
  const summaryId = requestedId.startsWith('summary:') ? requestedId.slice('summary:'.length) : null;
  const dailySummary = React.useMemo(
    () => (summaryId ? dailySummaries.find((entry) => entry.summaryId === summaryId) || null : null),
    [dailySummaries, summaryId],
  );

  React.useEffect(() => {
    if (memory) {
      setDraftContent(memory.contentText);
      return;
    }
    if (candidate) {
      setDraftContent(candidate.contentText);
    }
  }, [candidate, memory]);

  const ensureMemoryMetadata = React.useCallback(async () => {
    if (!memory) {
      return null;
    }

    const existing = await getMemoryMetadata(memory.memoryId);
    if (existing) {
      return existing;
    }

    const created = await upsertMemoryMetadata(buildDefaultMemoryMetadata(memory));
    await reload();
    return created;
  }, [memory, reload]);

  const handleSaveMemory = React.useCallback(
    async (nextStatus?: 'enabled' | 'disabled') => {
      if (!memory) {
        return;
      }

      const store = createManagerSessionStore();
      await store.upsertMemory?.({
        scopeType: memory.scopeType,
        scopeId: memory.scopeId,
        memoryType: memory.memoryType,
        keyText: memory.keyText,
        contentText: draftContent,
        importance: memory.importance,
        source: memory.source,
        createdAt: memory.createdAt,
        updatedAt: Date.now(),
      });

      const metadata = (await ensureMemoryMetadata()) || buildDefaultMemoryMetadata(memory);
      await upsertMemoryMetadata({
        ...metadata,
        title: metadata.title || memory.title,
        status: nextStatus || metadata.status,
        reasoningDetails:
          metadata.reasoningDetails.length > 0 ? metadata.reasoningDetails : [draftContent],
        updatedAt: Date.now(),
      });
      await reload();
    },
    [draftContent, ensureMemoryMetadata, memory, reload],
  );

  const handleSetMemoryStatus = React.useCallback(
    async (status: 'enabled' | 'disabled') => {
      const metadata = await ensureMemoryMetadata();
      if (!metadata || !memory) {
        return;
      }

      await upsertMemoryMetadata({
        ...metadata,
        status,
        updatedAt: Date.now(),
      });
      await setMemoryMetadataStatus(memory.memoryId, status);
      await reload();
    },
    [ensureMemoryMetadata, memory, reload],
  );

  const handleEnableCandidate = React.useCallback(async () => {
    if (!candidate || !candidateMetadata) {
      return;
    }

    const result = await enableMemoryCandidate({
      candidateId: candidate.candidateId,
      contentText: draftContent,
      title: candidateMetadata.title || candidate.title,
    });
    if (!result.memory) {
      return;
    }

    await upsertMemoryMetadata({
      memoryId: result.memory.id,
      memoryKey: buildMemoryKey(result.memory),
      title: candidateMetadata.title || candidate.title,
      status: 'enabled',
      reasoning: candidateMetadata.reasoning,
      reasoningDetails:
        candidateMetadata.reasoningDetails.length > 0
          ? candidateMetadata.reasoningDetails
          : [draftContent],
      impactSummary: candidateMetadata.impactSummary,
      sourceChain: candidateMetadata.sourceChain,
      similarMemoryIds: candidateMetadata.similarMemoryIds,
      structuredKey: candidateMetadata.structuredKey,
      createdAt: result.memory.createdAt,
      updatedAt: Date.now(),
    });

    await reload();
    openRoute(`/memory/${encodeURIComponent(result.memory.id)}`, {
      replace: true,
      state: withWorkspaceBackContext(undefined, '/memory'),
    });
  }, [candidate, candidateMetadata, draftContent, openRoute, reload]);

  const handleDismissCandidate = React.useCallback(async () => {
    if (!candidate) {
      return;
    }

    await dismissMemoryCandidate(candidate.candidateId);
    await reload();
  }, [candidate, reload]);

  const handleMergeCandidateAndEnable = React.useCallback(async () => {
    if (!candidate || !candidateMetadata?.similarMemoryIds?.length) {
      return;
    }

    const targetMemoryId = candidateMetadata.similarMemoryIds[0];
    const targetMemory = workspace.memories.find((entry) => entry.memoryId === targetMemoryId);
    if (!targetMemory) {
      return;
    }

    const mergedContent = [targetMemory.contentText, draftContent]
      .filter((entry) => entry.trim().length > 0)
      .join('\n\n');
    const store = createManagerSessionStore();
    await store.upsertMemory?.({
      scopeType: targetMemory.scopeType,
      scopeId: targetMemory.scopeId,
      memoryType: targetMemory.memoryType,
      keyText: targetMemory.keyText,
      contentText: mergedContent,
      importance: targetMemory.importance,
      source: targetMemory.source,
      createdAt: targetMemory.createdAt,
      updatedAt: Date.now(),
    });
    await upsertMemoryMetadata({
      ...(metadataRecords.find((entry) => entry.memoryId === targetMemory.memoryId) ||
        buildDefaultMemoryMetadata(targetMemory)),
      memoryId: targetMemory.memoryId,
      memoryKey: targetMemory.memoryKey,
      title: targetMemory.title,
      status: 'enabled',
      reasoningDetails: [mergedContent],
      updatedAt: Date.now(),
    });
    await dismissMemoryCandidate(candidate.candidateId);
    await reload();
    openRoute(`/memory/${encodeURIComponent(targetMemoryId)}`, {
      replace: true,
      state: withWorkspaceBackContext(undefined, '/memory'),
    });
  }, [candidate, candidateMetadata, draftContent, metadataRecords, openRoute, reload, workspace.memories]);

  const handleDailySummaryAction = React.useCallback(async () => {
    if (!dailySummary || !summaryId) {
      return;
    }

    const current = (await getDailySummaryMetadata(summaryId)) || dailySummary;
    if (current.extractionStatus === 'completed' || current.extractionStatus === 'partial') {
      if (current.extractedMemoryIds[0]) {
        openRoute(`/memory/${encodeURIComponent(current.extractedMemoryIds[0])}`, {
          state: withWorkspaceBackContext(undefined, '/memory'),
        });
      }
      return;
    }

    await upsertDailySummaryMetadata({
      ...current,
      extractionStatus: current.similarMemoryIds.length > 0 ? 'partial' : 'completed',
      updatedAt: Date.now(),
    });
    await reload();
  }, [dailySummary, openRoute, reload, summaryId]);

  if (!memory && !candidate && !dailySummary) {
    return (
      <WorkspaceShell language={language} section="memory" title={copy.title} subtitle="">
        <section className="rounded-[1.75rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/88 p-5 text-sm leading-6 text-[var(--mf-text-muted)] shadow-sm">
          {copy.notFound}
        </section>
      </WorkspaceShell>
    );
  }

  if (dailySummary) {
    const dailySummaryStatusLabel =
      dailySummary.extractionStatus === 'completed'
        ? t('memory_workspace.daily_summary_status.completed', {
            defaultValue: language === 'zh' ? '已提炼' : 'Generated',
          })
        : dailySummary.extractionStatus === 'partial'
          ? t('memory_workspace.daily_summary_status.partial', {
              defaultValue: language === 'zh' ? '部分提炼' : 'Partially generated',
            })
          : t('memory_workspace.daily_summary_status.pending', {
              defaultValue: language === 'zh' ? '未提炼' : 'Not generated',
            });
    const actionLabel =
      dailySummary.extractionStatus === 'completed'
        ? copy.viewGenerated
        : dailySummary.extractionStatus === 'partial'
          ? copy.viewExtraction
          : copy.generateMemory;

    return (
      <WorkspaceShell
        language={language}
        section="memory"
        title={dailySummary.title}
        subtitle={copy.title}
      >
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
              {copy.preview}
            </div>
            <div className="whitespace-pre-wrap text-sm leading-6 text-[var(--mf-text)]">
              {dailySummary.contentText}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
              {copy.summaryResult}
            </div>
            <div className="text-sm text-[var(--mf-text-muted)]">
              {t('memory_detail.current_status', {
                defaultValue:
                  language === 'zh' ? '当前状态：{{status}}' : 'Current status: {{status}}',
                status: dailySummaryStatusLabel,
              })}
            </div>
            {dailySummary.extractedMemoryIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {dailySummary.extractedMemoryIds.map((id) => (
                  <Button
                    key={id}
                    variant="outline"
                    size="sm"
                    className="rounded-2xl"
                    onClick={() =>
                      openRoute(`/memory/${encodeURIComponent(id)}`, {
                        state: withWorkspaceBackContext(undefined, '/memory'),
                      })
                    }
                  >
                    {id}
                  </Button>
                ))}
              </div>
            ) : null}
            <Button className="rounded-2xl" onClick={() => void handleDailySummaryAction()}>
              {actionLabel}
            </Button>
          </CardContent>
        </Card>
      </WorkspaceShell>
    );
  }

  const detailMetadata = memoryMetadata || candidateMetadata;
  const pageTitle = memoryMetadata?.title || candidateMetadata?.title || copy.title;
  const similarMemoryIds = detailMetadata?.similarMemoryIds || [];

  if (!detailMetadata) {
    return null;
  }

  return (
    <WorkspaceShell language={language} section="memory" title={pageTitle} subtitle={copy.title}>
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
            {copy.reasoning}
          </div>
          <div className="text-sm leading-6 text-[var(--mf-text)]">{detailMetadata.reasoning}</div>
          <div className="space-y-2 text-sm text-[var(--mf-text-muted)]">
            {detailMetadata.reasoningDetails.map((detail, index) => (
              <div key={`${detail}_${index}`}>{detail}</div>
            ))}
            {detailMetadata.sourceChain.map((source, index) => (
              <div key={`${source}_${index}`}>{source}</div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
            {copy.impact}
          </div>
          <div className="text-sm leading-6 text-[var(--mf-text)]">{detailMetadata.impactSummary}</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
            {copy.preview}
          </div>
          <textarea
            value={draftContent}
            onChange={(event) => setDraftContent(event.target.value)}
            className="min-h-[220px] w-full rounded-[1.2rem] border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-3 py-3 text-sm leading-6 text-[var(--mf-text)] focus:outline-none"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
            {copy.actions}
          </div>
          <div className="flex flex-wrap gap-2">
            {candidate && detailMetadata.status === 'pending' ? (
              <>
                <Button className="rounded-2xl" onClick={() => void handleEnableCandidate()}>
                  {copy.editEnable}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => void handleDismissCandidate()}
                >
                  {copy.notNow}
                </Button>
              </>
            ) : null}
            {candidate && detailMetadata.status === 'disabled' ? (
              <>
                <Button className="rounded-2xl" onClick={() => void handleEnableCandidate()}>
                  {copy.reEnable}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => void handleDismissCandidate()}
                >
                  {copy.notNow}
                </Button>
              </>
            ) : null}
            {memory && detailMetadata.status === 'pending' ? (
              <>
                <Button className="rounded-2xl" onClick={() => void handleSaveMemory('enabled')}>
                  {copy.editEnable}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => void handleSetMemoryStatus('disabled')}
                >
                  {copy.notNow}
                </Button>
              </>
            ) : null}
            {memory && detailMetadata.status === 'enabled' ? (
              <>
                <Button className="rounded-2xl" onClick={() => void handleSaveMemory()}>
                  {copy.saveBody}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => void handleSetMemoryStatus('disabled')}
                >
                  {copy.disable}
                </Button>
              </>
            ) : null}
            {memory && detailMetadata.status === 'disabled' ? (
              <>
                <Button className="rounded-2xl" onClick={() => void handleSetMemoryStatus('enabled')}>
                  {copy.reEnable}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => void handleSaveMemory()}
                >
                  {copy.saveBody}
                </Button>
              </>
            ) : null}
          </div>

          {similarMemoryIds.length ? (
            <div className="space-y-3 rounded-[1.2rem] border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] p-3">
              <div className="text-sm text-[var(--mf-text-muted)]">{copy.similarMemoryNotice}</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-2xl"
                  onClick={() =>
                    openRoute(`/memory/${encodeURIComponent(similarMemoryIds[0])}`, {
                      state: withWorkspaceBackContext(undefined, '/memory'),
                    })
                  }
                >
                  {copy.viewExisting}
                </Button>
                {candidate ? (
                  <>
                    <Button
                      size="sm"
                      className="rounded-2xl"
                      onClick={() => void handleMergeCandidateAndEnable()}
                    >
                      {copy.mergeEnable}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-2xl"
                      onClick={() => void handleEnableCandidate()}
                    >
                      {copy.saveAsNew}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </WorkspaceShell>
  );
}
