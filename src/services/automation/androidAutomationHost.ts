import { Capacitor } from '@capacitor/core';
import { getSettings } from '@/src/services/settings';
import {
  startOrUpdateAndroidForegroundExecution,
  stopAndroidForegroundExecution,
} from '@/src/services/background/androidForegroundExecution';
import {
  getAutomationRuntimeSnapshot,
  subscribeAutomationRuntime,
  type AutomationRuntimeSnapshot,
} from './runtimeCoordinator';

function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
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

function shouldRunAutomationForegroundHost(snapshot: AutomationRuntimeSnapshot): boolean {
  if (!isNativeAndroid()) return false;
  if (snapshot.hostType !== 'android_native') return false;
  if (!snapshot.automationEnabled) return false;
  if (!snapshot.backgroundEnabled) return false;
  if (snapshot.isAppActive) return false;
  if (!snapshot.isDurableHost) return false;
  return true;
}

function buildAutomationForegroundPayload(snapshot: AutomationRuntimeSnapshot) {
  const settings = getSettings();
  const language = settings.language === 'zh' ? 'zh' : 'en';

  const running = snapshot.queue.runningJobIds.length;
  const queued = snapshot.queue.queuedJobIds.length;
  const title =
    language === 'zh'
      ? `MatchFlow 自动化后台运行中`
      : 'MatchFlow automation running';

  const statusLabel =
    snapshot.status === 'running'
      ? language === 'zh'
        ? '扫描中'
        : 'Running'
      : snapshot.status === 'paused'
        ? language === 'zh'
          ? '暂停'
          : 'Paused'
        : snapshot.status === 'error'
          ? language === 'zh'
            ? '异常'
            : 'Error'
          : language === 'zh'
            ? '待机'
            : 'Idle';

  const lines = [
    language === 'zh'
      ? `状态: ${statusLabel}`
      : `Status: ${statusLabel}`,
    language === 'zh'
      ? `队列: ${running} 运行中 · ${queued} 排队中`
      : `Queue: ${running} running · ${queued} queued`,
    language === 'zh'
      ? `最近心跳: ${formatTimestamp(snapshot.lastCompletedAt, language)}`
      : `Last heartbeat: ${formatTimestamp(snapshot.lastCompletedAt, language)}`,
    snapshot.lastError
      ? language === 'zh'
        ? `错误: ${snapshot.lastError}`
        : `Error: ${snapshot.lastError}`
      : '',
  ].filter((line) => line.length > 0);

  const text = lines.join('\n');
  const dedupeKey = [
    snapshot.status,
    running,
    queued,
    snapshot.lastCompletedAt ?? 0,
    snapshot.lastError ?? '',
  ].join('|');

  return {
    title,
    text,
    useWakeLock: true,
    dedupeKey,
    ttlMs: 5 * 60 * 1000,
  };
}

export function startAndroidAutomationForegroundHost(): () => void {
  if (!isNativeAndroid()) {
    return () => {};
  }

  let lastDedupeKey = '';
  let active = false;

  const sync = (snapshot: AutomationRuntimeSnapshot) => {
    if (!shouldRunAutomationForegroundHost(snapshot)) {
      lastDedupeKey = '';
      if (active) {
        active = false;
        void stopAndroidForegroundExecution('automation');
      }
      return;
    }

    const payload = buildAutomationForegroundPayload(snapshot);
    if (active && payload.dedupeKey === lastDedupeKey) {
      return;
    }

    lastDedupeKey = payload.dedupeKey;
    active = true;
    void startOrUpdateAndroidForegroundExecution(
      {
        title: payload.title,
        text: payload.text,
        useWakeLock: payload.useWakeLock,
      },
      { scope: 'automation', ttlMs: payload.ttlMs },
    );
  };

  const unsubscribe = subscribeAutomationRuntime((snapshot) => {
    sync(snapshot);
  });

  sync(getAutomationRuntimeSnapshot());

  return () => {
    unsubscribe();
    lastDedupeKey = '';
    active = false;
    void stopAndroidForegroundExecution('automation');
  };
}
