import React from 'react';
import { Activity, Bell, Cpu, TimerReset } from 'lucide-react';
import { Card, CardContent } from '@/src/components/ui/Card';
import {
  getAutomationRuntimeSnapshot,
  subscribeAutomationRuntime,
  type AutomationRuntimeSnapshot,
} from '@/src/services/automation';

interface AutomationDiagnosticsCardProps {
  language: 'zh' | 'en';
}

function formatTimestamp(value: number | null, language: 'zh' | 'en'): string {
  if (!value) {
    return language === 'zh' ? '暂无' : 'Not yet';
  }
  return new Date(value).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatHostLabel(snapshot: AutomationRuntimeSnapshot, language: 'zh' | 'en'): string {
  if (snapshot.hostType === 'android_native') {
    return language === 'zh' ? 'Android 原生' : 'Android Native';
  }
  if (snapshot.hostType === 'desktop_shell') {
    return language === 'zh' ? '桌面壳宿主' : 'Desktop Shell';
  }
  return language === 'zh' ? '浏览器 Web' : 'Browser Web';
}

function formatStatusLabel(snapshot: AutomationRuntimeSnapshot, language: 'zh' | 'en'): string {
  if (!snapshot.automationEnabled) {
    return language === 'zh' ? '已关闭' : 'Disabled';
  }
  if (snapshot.status === 'running') {
    return language === 'zh' ? '扫描中' : 'Running';
  }
  if (snapshot.status === 'paused') {
    return language === 'zh'
      ? snapshot.isAppActive
        ? '待机'
        : '后台暂停'
      : snapshot.isAppActive
        ? 'Idle'
        : 'Paused';
  }
  if (snapshot.status === 'error') {
    return language === 'zh' ? '异常' : 'Error';
  }
  return language === 'zh' ? '待机' : 'Idle';
}

export function AutomationDiagnosticsCard({
  language,
}: AutomationDiagnosticsCardProps) {
  const [snapshot, setSnapshot] = React.useState<AutomationRuntimeSnapshot>(
    getAutomationRuntimeSnapshot(),
  );

  React.useEffect(() => subscribeAutomationRuntime(setSnapshot), []);

  const copy =
    language === 'zh'
      ? {
          title: '运行诊断',
          subtitle: '显示当前自动化协调器、队列与宿主可用性。',
          runtime: '协调器',
          host: '宿主',
          lastHeartbeat: '最近心跳',
          queue: '队列',
          durable: '可持续后台',
          yes: '可用',
          no: '不可用',
          queued: '待执行',
          running: '运行中',
          executed: '本轮执行',
          created: '本轮创建',
          disabledHint: '定时自动化当前关闭。可在设置里开启自动化执行。',
        }
      : {
          title: 'Runtime Diagnostics',
          subtitle: 'Shows coordinator, queue, and host availability for automation.',
          runtime: 'Coordinator',
          host: 'Host',
          lastHeartbeat: 'Last heartbeat',
          queue: 'Queue',
          durable: 'Durable background',
          yes: 'Available',
          no: 'Unavailable',
          queued: 'Queued',
          running: 'Running',
          executed: 'Executed',
          created: 'Created',
          disabledHint: 'Scheduled automation is off. Enable automation execution in Settings.',
        };

  const queueQueued = snapshot.queue.queuedJobIds.length;
  const queueRunning = snapshot.queue.runningJobIds.length;
  const executed = snapshot.heartbeat?.executedJobCount || 0;
  const created = snapshot.heartbeat?.createdJobCount || 0;

  return (
    <Card className="border-[var(--mf-border)] bg-[var(--mf-surface)]">
      <CardContent className="p-4 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--mf-text)]">
            <Activity className="w-4 h-4 text-[var(--mf-accent)]" />
            {copy.title}
          </div>
          <p className="text-xs leading-relaxed text-[var(--mf-text-muted)]">
            {copy.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-[var(--mf-border)] bg-[var(--mf-surface-muted)] p-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--mf-text-muted)]">
              {copy.runtime}
            </div>
            <div className="mt-1 text-sm font-semibold text-[var(--mf-text)]">
              {formatStatusLabel(snapshot, language)}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--mf-border)] bg-[var(--mf-surface-muted)] p-3">
            <div className="text-[10px] uppercase tracking-wider text-[var(--mf-text-muted)]">
              {copy.host}
            </div>
            <div className="mt-1 text-sm font-semibold text-[var(--mf-text)]">
              {formatHostLabel(snapshot, language)}
            </div>
            <div className="mt-1 text-[10px] text-[var(--mf-text-muted)]">
              {copy.durable}: {snapshot.isDurableHost ? copy.yes : copy.no}
            </div>
          </div>
        </div>

        {!snapshot.automationEnabled ? (
          <div className="rounded-xl border border-[var(--mf-border)] bg-[var(--mf-surface-muted)] p-3 text-xs text-[var(--mf-text-muted)]">
            {copy.disabledHint}
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <TimerReset className="mt-0.5 h-4 w-4 text-[var(--mf-accent)]" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-[var(--mf-text)]">{copy.lastHeartbeat}</div>
              <div className="text-[11px] text-[var(--mf-text-muted)]">
                {formatTimestamp(snapshot.lastCompletedAt, language)}
              </div>
              {snapshot.lastError ? (
                <div className="mt-1 text-[11px] text-red-400">{snapshot.lastError}</div>
              ) : null}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-4 w-4 text-[var(--mf-accent)]" />
            <div className="min-w-0 text-[11px] text-[var(--mf-text-muted)]">
              {copy.created}: {created} · {copy.executed}: {executed}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Cpu className="mt-0.5 h-4 w-4 text-[var(--mf-accent)]" />
            <div className="min-w-0 text-[11px] text-[var(--mf-text-muted)]">
              {copy.queue}: {copy.queued} {queueQueued} · {copy.running} {queueRunning}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
