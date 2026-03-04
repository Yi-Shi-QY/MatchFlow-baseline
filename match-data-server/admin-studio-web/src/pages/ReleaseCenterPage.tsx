import React, { useEffect, useMemo, useState } from 'react';
import { History, Loader2, RefreshCw, RotateCcw, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Select } from '@/src/components/ui/Select';
import { useI18n } from '@/src/i18n';
import {
  type AdminCatalogDomain,
  AdminStudioApiError,
  type CatalogEntry,
  type CatalogRevision,
  type ReleaseRecord,
  listCatalogEntries,
  listCatalogRevisions,
  listReleaseHistory,
  publishCatalogRevision,
  rollbackCatalogRevision,
} from '@/src/services/adminStudio';

type FeedbackTone = 'success' | 'error' | 'info';
type CatalogChannel = 'internal' | 'beta' | 'stable';
type HistoryDomainFilter = 'all' | AdminCatalogDomain;
type HistoryChannelFilter = 'all' | CatalogChannel;

interface FeedbackState {
  tone: FeedbackTone;
  message: string;
}

const DOMAIN_OPTIONS: Array<{ value: AdminCatalogDomain; label: string }> = [
  { value: 'datasource', label: 'datasource' },
  { value: 'planning_template', label: 'planning_template' },
  { value: 'animation_template', label: 'animation_template' },
  { value: 'agent', label: 'agent' },
  { value: 'skill', label: 'skill' },
  { value: 'domain_pack', label: 'domain_pack' },
];

const CHANNEL_OPTIONS: Array<{ value: CatalogChannel; label: string }> = [
  { value: 'internal', label: 'internal' },
  { value: 'beta', label: 'beta' },
  { value: 'stable', label: 'stable' },
];

const DOMAIN_WORKSPACE_PATH: Record<AdminCatalogDomain, string> = {
  datasource: '/app/datasources/design',
  planning_template: '/app/planning-templates/design',
  animation_template: '/app/animation-templates/design',
  agent: '/app/agents/design',
  skill: '/app/skills/design',
  domain_pack: '/app/domain-packs/design',
};

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function describeError(error: unknown) {
  if (error instanceof AdminStudioApiError) {
    return `${error.code ? `${error.code}: ` : ''}${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected request error';
}

function formatTime(iso: string | null | undefined) {
  if (!iso) {
    return '-';
  }
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return iso;
  }
  return new Date(timestamp).toLocaleString();
}

function actionBadgeClass(action: string) {
  if (action === 'publish') {
    return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
  }
  if (action === 'rollback') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  }
  return 'border-white/20 bg-white/5 text-zinc-300';
}

function statusBadgeClass(status: string) {
  if (status === 'succeeded') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }
  if (status === 'failed') {
    return 'border-red-500/30 bg-red-500/10 text-red-300';
  }
  return 'border-white/20 bg-white/5 text-zinc-300';
}

export default function ReleaseCenterPage() {
  const { t } = useI18n();
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [historyDomainFilter, setHistoryDomainFilter] = useState<HistoryDomainFilter>('all');
  const [historyChannelFilter, setHistoryChannelFilter] = useState<HistoryChannelFilter>('all');
  const [historyItemSearch, setHistoryItemSearch] = useState('');
  const [historyRecords, setHistoryRecords] = useState<ReleaseRecord[]>([]);
  const [selectedReleaseId, setSelectedReleaseId] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [actionDomain, setActionDomain] = useState<AdminCatalogDomain>('datasource');
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [revisions, setRevisions] = useState<CatalogRevision[]>([]);
  const [actionItemId, setActionItemId] = useState('');
  const [publishVersion, setPublishVersion] = useState('');
  const [rollbackTargetVersion, setRollbackTargetVersion] = useState('');
  const [actionChannel, setActionChannel] = useState<CatalogChannel>('internal');
  const [actionValidationRunId, setActionValidationRunId] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const domainOptions = useMemo(
    () => DOMAIN_OPTIONS.map((item) => ({ ...item, label: item.value })),
    [],
  );
  const domainFilterOptions = useMemo(
    () => [
      { value: 'all' as HistoryDomainFilter, label: t('all domains', '全部领域') },
      ...domainOptions,
    ],
    [domainOptions, t],
  );
  const channelOptions = useMemo(
    () =>
      CHANNEL_OPTIONS.map((item) => ({
        ...item,
        label:
          item.value === 'internal'
            ? t('internal', '内部')
            : item.value === 'beta'
              ? t('beta', '测试')
              : t('stable', '稳定'),
      })),
    [t],
  );
  const channelFilterOptions = useMemo(
    () => [{ value: 'all' as HistoryChannelFilter, label: t('all channels', '全部通道') }, ...channelOptions],
    [channelOptions, t],
  );

  const entryOptions = useMemo(() => {
    if (entries.length === 0) {
      return [{ value: '', label: t('no items', '无条目') }];
    }
    return entries.map((entry) => ({
      value: entry.itemId,
      label: `${entry.itemId} (${entry.latestVersion})`,
    }));
  }, [entries, t]);

  const revisionOptions = useMemo(() => {
    if (revisions.length === 0) {
      return [{ value: '', label: t('no revisions', '无修订') }];
    }
    return revisions.map((revision) => ({
      value: revision.version,
      label: `${revision.version} [${revision.status}]`,
    }));
  }, [revisions, t]);

  const filteredHistory = useMemo(() => {
    const query = historyItemSearch.trim().toLowerCase();
    if (!query) {
      return historyRecords;
    }
    return historyRecords.filter((record) => record.itemId.toLowerCase().includes(query));
  }, [historyRecords, historyItemSearch]);

  const selectedRecord = useMemo(
    () => filteredHistory.find((record) => record.id === selectedReleaseId) || null,
    [filteredHistory, selectedReleaseId],
  );

  async function loadHistory() {
    setIsLoadingHistory(true);
    try {
      const response = await listReleaseHistory({
        ...(historyDomainFilter !== 'all' ? { domain: historyDomainFilter } : {}),
        ...(historyChannelFilter !== 'all' ? { channel: historyChannelFilter } : {}),
        limit: 150,
      });
      const records = [...response.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setHistoryRecords(records);
      setSelectedReleaseId(records[0]?.id || '');
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: describeError(error),
      });
    } finally {
      setIsLoadingHistory(false);
    }
  }

  async function loadEntries(targetDomain: AdminCatalogDomain, preferredItemId = '') {
    setIsLoadingEntries(true);
    try {
      const response = await listCatalogEntries(targetDomain, { limit: 120 });
      const records = [...response.data].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      setEntries(records);
      const preferred =
        preferredItemId && records.some((item) => item.itemId === preferredItemId)
          ? preferredItemId
          : records[0]?.itemId || '';
      setActionItemId(preferred);
      if (!preferred) {
        setRevisions([]);
        setPublishVersion('');
        setRollbackTargetVersion('');
      }
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: describeError(error),
      });
    } finally {
      setIsLoadingEntries(false);
    }
  }

  async function loadRevisions(targetDomain: AdminCatalogDomain, itemId: string) {
    if (!itemId) {
      setRevisions([]);
      setPublishVersion('');
      setRollbackTargetVersion('');
      return;
    }
    setIsLoadingRevisions(true);
    try {
      const response = await listCatalogRevisions(targetDomain, itemId, { limit: 120 });
      const records = [...response.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setRevisions(records);
      const latestVersion = records[0]?.version || '';
      setPublishVersion(latestVersion);
      setRollbackTargetVersion(latestVersion);
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: describeError(error),
      });
    } finally {
      setIsLoadingRevisions(false);
    }
  }

  async function handlePublish() {
    if (!actionItemId) {
      setFeedback({ tone: 'error', message: t('Select itemId before publish.', '发布前请先选择 itemId。') });
      return;
    }
    if (!publishVersion) {
      setFeedback({ tone: 'error', message: t('Select publish version.', '请选择发布版本。') });
      return;
    }
    setIsPublishing(true);
    try {
      await publishCatalogRevision(actionDomain, actionItemId, {
        version: publishVersion,
        channel: actionChannel,
        ...(asText(actionNotes) ? { notes: asText(actionNotes) } : {}),
        ...(asText(actionValidationRunId) ? { validationRunId: asText(actionValidationRunId) } : {}),
      });
      setFeedback({
        tone: 'success',
        message: t(
          `Published ${actionDomain}:${actionItemId}@${publishVersion} to ${actionChannel}.`,
          `已发布 ${actionDomain}:${actionItemId}@${publishVersion} 到 ${actionChannel}。`,
        ),
      });
      await loadHistory();
      await loadRevisions(actionDomain, actionItemId);
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: describeError(error),
      });
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleRollback() {
    if (!actionItemId) {
      setFeedback({ tone: 'error', message: t('Select itemId before rollback.', '回滚前请先选择 itemId。') });
      return;
    }
    if (!rollbackTargetVersion) {
      setFeedback({ tone: 'error', message: t('Select rollback target version.', '请选择回滚目标版本。') });
      return;
    }
    setIsRollingBack(true);
    try {
      await rollbackCatalogRevision(actionDomain, actionItemId, {
        targetVersion: rollbackTargetVersion,
        channel: actionChannel,
        ...(asText(actionNotes) ? { notes: asText(actionNotes) } : {}),
        ...(asText(actionValidationRunId) ? { validationRunId: asText(actionValidationRunId) } : {}),
      });
      setFeedback({
        tone: 'success',
        message: t(`Rollback completed to ${rollbackTargetVersion}.`, `回滚完成，目标版本 ${rollbackTargetVersion}。`),
      });
      await loadHistory();
      await loadRevisions(actionDomain, actionItemId);
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: describeError(error),
      });
    } finally {
      setIsRollingBack(false);
    }
  }

  function useRecordForAction(record: ReleaseRecord) {
    setActionItemId(record.itemId);
    setActionDomain(record.domain);
    setActionChannel(record.channel);
    setPublishVersion(record.toVersion || '');
    setRollbackTargetVersion(record.toVersion || '');
    if (record.validationRunId) {
      setActionValidationRunId(record.validationRunId);
    }
  }

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyDomainFilter, historyChannelFilter]);

  useEffect(() => {
    setEntries([]);
    setRevisions([]);
    setPublishVersion('');
    setRollbackTargetVersion('');
    void loadEntries(actionDomain, actionItemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionDomain]);

  useEffect(() => {
    if (!actionItemId) {
      setRevisions([]);
      setPublishVersion('');
      setRollbackTargetVersion('');
      return;
    }
    void loadRevisions(actionDomain, actionItemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionDomain, actionItemId]);

  useEffect(() => {
    if (filteredHistory.length === 0) {
      setSelectedReleaseId('');
      return;
    }
    if (!filteredHistory.some((record) => record.id === selectedReleaseId)) {
      setSelectedReleaseId(filteredHistory[0]?.id || '');
    }
  }, [filteredHistory, selectedReleaseId]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-base font-bold text-white">{t('Release Center', '发布中心')}</h1>
        <p className="text-xs text-zinc-500">
          {t(
            'Manage publish/rollback actions and inspect release history across all domains.',
            '管理发布/回滚动作，并查看所有领域的发布历史。',
          )}
        </p>
      </div>

      {feedback && (
        <div
          data-testid="release-center-feedback"
          className={`rounded-lg border px-3 py-2 text-xs ${
            feedback.tone === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : feedback.tone === 'error'
                ? 'border-red-500/30 bg-red-500/10 text-red-300'
                : 'border-blue-500/30 bg-blue-500/10 text-blue-300'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">{t('Release Action', '发布动作')}</h2>
            <Link className="text-xs text-emerald-300 underline" to={DOMAIN_WORKSPACE_PATH[actionDomain]}>
              {t('Open', '打开')} {actionDomain} {t('workspace', '工作区')}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">{t('domain', '领域')}</div>
              <Select
                value={actionDomain}
                onChange={(value) => setActionDomain(value as AdminCatalogDomain)}
                options={domainOptions}
                testId="release-center-action-domain-select"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">itemId</div>
              <Select
                value={actionItemId}
                onChange={setActionItemId}
                options={entryOptions}
                testId="release-center-action-item-select"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">{t('channel', '通道')}</div>
              <Select
                value={actionChannel}
                onChange={(value) => setActionChannel(value as CatalogChannel)}
                options={channelOptions}
                testId="release-center-action-channel-select"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                {t('publish version', '发布版本')}
              </div>
              <Select
                value={publishVersion}
                onChange={setPublishVersion}
                options={revisionOptions}
                testId="release-center-publish-version-select"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                {t('rollback target version', '回滚目标版本')}
              </div>
              <Select
                value={rollbackTargetVersion}
                onChange={setRollbackTargetVersion}
                options={revisionOptions}
                testId="release-center-rollback-version-select"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                {t('validationRunId (optional)', 'validationRunId（可选）')}
              </div>
              <input
                type="text"
                value={actionValidationRunId}
                onChange={(event) => setActionValidationRunId(event.target.value)}
                placeholder={t('validation run id', '验证任务 id')}
                data-testid="release-center-validation-run-id-input"
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-zinc-500">
              {t('notes (optional)', '备注（可选）')}
            </div>
            <textarea
              value={actionNotes}
              onChange={(event) => setActionNotes(event.target.value)}
              placeholder={t('release notes', '发布备注')}
              data-testid="release-center-notes-input"
              className="min-h-[72px] w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span>{t('entries', '条目')}: {entries.length}</span>
            <span>|</span>
            <span>{t('revisions', '修订')}: {revisions.length}</span>
            {(isLoadingEntries || isLoadingRevisions) && (
              <span className="inline-flex items-center gap-1 text-blue-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('loading catalog', '正在加载目录')}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="gap-2"
              onClick={() => void handlePublish()}
              disabled={isPublishing || isRollingBack || !actionItemId || !publishVersion}
              data-testid="release-center-publish"
            >
              {isPublishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {t('Publish', '发布')}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => void handleRollback()}
              disabled={isPublishing || isRollingBack || !actionItemId || !rollbackTargetVersion}
              data-testid="release-center-rollback"
            >
              {isRollingBack ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              {t('Rollback', '回滚')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950">
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">{t('History Filters', '历史筛选')}</h2>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => void loadHistory()}
              disabled={isLoadingHistory}
              data-testid="release-center-history-refresh"
            >
              <RefreshCw className="h-4 w-4" />
              {t('Refresh', '刷新')}
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-4">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">{t('domain', '领域')}</div>
              <Select
                value={historyDomainFilter}
                onChange={(value) => setHistoryDomainFilter(value as HistoryDomainFilter)}
                options={domainFilterOptions}
                testId="release-center-history-domain-select"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">{t('channel', '通道')}</div>
              <Select
                value={historyChannelFilter}
                onChange={(value) => setHistoryChannelFilter(value as HistoryChannelFilter)}
                options={channelFilterOptions}
                testId="release-center-history-channel-select"
              />
            </div>
            <div className="space-y-1 lg:col-span-2">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">
                {t('itemId search', 'itemId 搜索')}
              </div>
              <input
                type="text"
                value={historyItemSearch}
                onChange={(event) => setHistoryItemSearch(event.target.value)}
                placeholder={t('search by itemId', '按 itemId 搜索')}
                data-testid="release-center-history-item-search"
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="text-[11px] text-zinc-500">
            {isLoadingHistory ? t('loading history...', '正在加载历史...') : `${t('records', '记录')}: ${filteredHistory.length}`}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="space-y-2 p-4">
            <h2 className="text-sm font-semibold text-white">{t('Release Timeline', '发布时间线')}</h2>
            <div className="max-h-[620px] space-y-2 overflow-auto" data-testid="release-center-history-list">
              {filteredHistory.map((record, index) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setSelectedReleaseId(record.id)}
                  data-testid={`release-center-history-item-${index}`}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selectedReleaseId === record.id
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-white/10 bg-zinc-900/80 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[11px] text-zinc-200">{record.id}</div>
                      <div className="mt-1 text-[11px] text-zinc-400">
                        {record.domain}:{record.itemId}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${actionBadgeClass(record.action)}`}>
                        {record.action}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusBadgeClass(record.status)}`}>
                        {record.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-zinc-500">
                    <History className="h-3 w-3" />
                    {formatTime(record.createdAt)} | {record.channel} | {record.fromVersion || '-'} -&gt; {record.toVersion}
                  </div>
                </button>
              ))}
              {filteredHistory.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/15 bg-zinc-900/50 px-3 py-3 text-xs text-zinc-500">
                  {t('No release records in current filter.', '当前筛选条件下没有发布记录。')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-white">{t('Record Details', '记录详情')}</h2>
            {!selectedRecord && (
              <div className="rounded-lg border border-dashed border-white/15 bg-zinc-900/50 px-3 py-3 text-xs text-zinc-500">
                {t('Select a release record from timeline.', '请从时间线中选择一条发布记录。')}
              </div>
            )}
            {selectedRecord && (
              <div className="space-y-2 text-xs">
                <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3">
                  <div className="font-mono text-zinc-200">{selectedRecord.id}</div>
                  <div className="mt-1 text-zinc-400">
                    {selectedRecord.domain}:{selectedRecord.itemId}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3">
                    <div className="text-zinc-500">action</div>
                    <div className="mt-1 text-zinc-300">{selectedRecord.action}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3">
                    <div className="text-zinc-500">channel</div>
                    <div className="mt-1 text-zinc-300">{selectedRecord.channel}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3">
                    <div className="text-zinc-500">version change</div>
                    <div className="mt-1 text-zinc-300">{selectedRecord.fromVersion || '-'} -&gt; {selectedRecord.toVersion}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3">
                    <div className="text-zinc-500">validationRunId</div>
                    <div className="mt-1 break-all text-zinc-300">{selectedRecord.validationRunId || '-'}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3">
                    <div className="text-zinc-500">createdAt</div>
                    <div className="mt-1 text-zinc-300">{formatTime(selectedRecord.createdAt)}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-3">
                    <div className="text-zinc-500">notes</div>
                    <div className="mt-1 whitespace-pre-wrap text-zinc-300">{selectedRecord.notes || '-'}</div>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => useRecordForAction(selectedRecord)}
                >
                  {t('Use This Record For Action Form', '将此记录用于动作表单')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
