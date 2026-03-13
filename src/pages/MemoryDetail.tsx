import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { getActiveAnalysisDomain } from '@/src/services/domains/registry';
import { createManagerSessionStore } from '@/src/services/manager-gateway/sessionStore';
import {
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
  loadMemoryWorkspace,
  type LoadedMemoryWorkspace,
} from '@/src/services/memoryWorkspace';

function getDetailCopy(language: 'zh' | 'en') {
  return language === 'zh'
    ? {
        title: '记忆详情',
        notFound: '没有找到对应的记忆或摘要。',
        reasoning: '判断依据与来源',
        impact: '影响说明',
        preview: '记忆正文预览',
        actions: '操作区',
        summaryResult: '提炼结果',
        editEnable: '编辑后启用',
        saveBody: '保存正文',
        disable: '停用',
        notNow: '暂不使用',
        reEnable: '重新启用',
        viewExisting: '查看现有记忆',
        mergeEnable: '合并后启用',
        saveAsNew: '仍作为新记忆保存',
        generateMemory: '生成记忆',
        viewGenerated: '查看已生成记忆',
        viewExtraction: '查看提炼结果',
      }
    : {
        title: 'Memory Detail',
        notFound: 'The requested memory or summary could not be found.',
        reasoning: 'Reasoning and sources',
        impact: 'Impact',
        preview: 'Memory content preview',
        actions: 'Actions',
        summaryResult: 'Extraction result',
        editEnable: 'Save and enable',
        saveBody: 'Save content',
        disable: 'Disable',
        notNow: 'Not now',
        reEnable: 'Re-enable',
        viewExisting: 'View existing memory',
        mergeEnable: 'Merge and enable',
        saveAsNew: 'Keep as new memory',
        generateMemory: 'Generate memories',
        viewGenerated: 'View generated memories',
        viewExtraction: 'View extraction result',
      };
}

export default function MemoryDetail() {
  const { memoryId } = useParams();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const copy = getDetailCopy(language);
  const activeDomain = getActiveAnalysisDomain();
  const requestedId = decodeURIComponent(memoryId || '');
  const [workspace, setWorkspace] = React.useState<LoadedMemoryWorkspace>({
    sessionId: '',
    memories: [],
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
  const memoryMetadata = React.useMemo(() => {
    if (!memory) {
      return null;
    }
    return (
      metadataRecords.find((entry) => entry.memoryId === memory.memoryId) ||
      buildDefaultMemoryMetadata(memory)
    );
  }, [memory, metadataRecords]);
  const summaryId = requestedId.startsWith('summary:') ? requestedId.slice('summary:'.length) : null;
  const dailySummary = React.useMemo(
    () => (summaryId ? dailySummaries.find((entry) => entry.summaryId === summaryId) || null : null),
    [dailySummaries, summaryId],
  );

  React.useEffect(() => {
    if (memory) {
      setDraftContent(memory.contentText);
    }
  }, [memory]);

  const ensureMetadata = React.useCallback(async () => {
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

      const metadata = (await ensureMetadata()) || buildDefaultMemoryMetadata(memory);
      await upsertMemoryMetadata({
        ...metadata,
        title: metadata.title || memory.title,
        status: nextStatus || metadata.status,
        reasoningDetails:
          metadata.reasoningDetails.length > 0
            ? metadata.reasoningDetails
            : [draftContent],
        updatedAt: Date.now(),
      });
      await reload();
    },
    [draftContent, ensureMetadata, memory, reload],
  );

  const handleSetMemoryStatus = React.useCallback(
    async (status: 'enabled' | 'disabled') => {
      const metadata = await ensureMetadata();
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
    [ensureMetadata, memory, reload],
  );

  const handleMergeAndEnable = React.useCallback(async () => {
    if (!memoryMetadata || !memory || !memoryMetadata.similarMemoryIds?.length) {
      return;
    }

    const targetMemoryId = memoryMetadata.similarMemoryIds[0];
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
    await handleSetMemoryStatus('disabled');
    await reload();
    navigate(`/memory/${encodeURIComponent(targetMemoryId)}`);
  }, [draftContent, handleSetMemoryStatus, memory, memoryMetadata, navigate, reload, workspace.memories]);

  const handleDailySummaryAction = React.useCallback(async () => {
    if (!dailySummary || !summaryId) {
      return;
    }

    const current = (await getDailySummaryMetadata(summaryId)) || dailySummary;
    if (current.extractionStatus === 'completed' || current.extractionStatus === 'partial') {
      if (current.extractedMemoryIds[0]) {
        navigate(`/memory/${encodeURIComponent(current.extractedMemoryIds[0])}`);
      }
      return;
    }

    await upsertDailySummaryMetadata({
      ...current,
      extractionStatus: current.similarMemoryIds.length > 0 ? 'partial' : 'completed',
      updatedAt: Date.now(),
    });
    await reload();
  }, [dailySummary, navigate, reload, summaryId]);

  if (!memory && !dailySummary) {
    return (
      <WorkspaceShell language={language} section="memory" title={copy.title} subtitle="">
        <section className="rounded-[1.75rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/88 p-5 text-sm leading-6 text-[var(--mf-text-muted)] shadow-sm">
          {copy.notFound}
        </section>
      </WorkspaceShell>
    );
  }

  if (dailySummary) {
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
              {language === 'zh'
                ? `当前状态：${dailySummary.extractionStatus}`
                : `Current status: ${dailySummary.extractionStatus}`}
            </div>
            {dailySummary.extractedMemoryIds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {dailySummary.extractedMemoryIds.map((id) => (
                  <Button
                    key={id}
                    variant="outline"
                    size="sm"
                    className="rounded-2xl"
                    onClick={() => navigate(`/memory/${encodeURIComponent(id)}`)}
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

  if (!memory || !memoryMetadata) {
    return null;
  }

  return (
    <WorkspaceShell language={language} section="memory" title={memoryMetadata.title} subtitle={copy.title}>
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
            {copy.reasoning}
          </div>
          <div className="text-sm leading-6 text-[var(--mf-text)]">{memoryMetadata.reasoning}</div>
          <div className="space-y-2 text-sm text-[var(--mf-text-muted)]">
            {memoryMetadata.reasoningDetails.map((detail, index) => (
              <div key={`${detail}_${index}`}>{detail}</div>
            ))}
            {memoryMetadata.sourceChain.map((source, index) => (
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
          <div className="text-sm leading-6 text-[var(--mf-text)]">{memoryMetadata.impactSummary}</div>
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
            {memoryMetadata.status === 'pending' ? (
              <>
                <Button className="rounded-2xl" onClick={() => void handleSaveMemory('enabled')}>
                  {copy.editEnable}
                </Button>
                <Button variant="outline" className="rounded-2xl" onClick={() => void handleSetMemoryStatus('disabled')}>
                  {copy.notNow}
                </Button>
              </>
            ) : null}
            {memoryMetadata.status === 'enabled' ? (
              <>
                <Button className="rounded-2xl" onClick={() => void handleSaveMemory()}>
                  {copy.saveBody}
                </Button>
                <Button variant="outline" className="rounded-2xl" onClick={() => void handleSetMemoryStatus('disabled')}>
                  {copy.disable}
                </Button>
              </>
            ) : null}
            {memoryMetadata.status === 'disabled' ? (
              <>
                <Button className="rounded-2xl" onClick={() => void handleSetMemoryStatus('enabled')}>
                  {copy.reEnable}
                </Button>
                <Button variant="outline" className="rounded-2xl" onClick={() => void handleSaveMemory()}>
                  {copy.saveBody}
                </Button>
              </>
            ) : null}
          </div>

          {memoryMetadata.similarMemoryIds?.length ? (
            <div className="space-y-3 rounded-[1.2rem] border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] p-3">
              <div className="text-sm text-[var(--mf-text-muted)]">
                {language === 'zh'
                  ? '检测到相近记忆，启用前可以先查看或合并。'
                  : 'A similar memory was found. Review or merge it before enabling.'}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-2xl"
                  onClick={() => navigate(`/memory/${encodeURIComponent(memoryMetadata.similarMemoryIds![0])}`)}
                >
                  {copy.viewExisting}
                </Button>
                <Button size="sm" className="rounded-2xl" onClick={() => void handleMergeAndEnable()}>
                  {copy.mergeEnable}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-2xl"
                  onClick={() => void handleSaveMemory('enabled')}
                >
                  {copy.saveAsNew}
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </WorkspaceShell>
  );
}
