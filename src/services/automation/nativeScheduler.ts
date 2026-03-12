import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from '@capacitor/core';
import { getSettings } from '@/src/services/settings';
import { listAutomationJobs } from './jobStore';
import { listAutomationRules } from './ruleStore';
import { parseAutomationTimestamp } from './time';
import type { AutomationJob, AutomationRule } from './types';

export type NativeAutomationScheduleKind =
  | 'job_due'
  | 'job_retry'
  | 'rule_expand';

export type NativeAutomationPermissionState =
  | 'granted'
  | 'denied'
  | 'not_required'
  | 'unsupported';

export interface NativeAutomationScheduleEntry {
  id: string;
  kind: NativeAutomationScheduleKind;
  sourceId: string;
  title: string;
  domainId: string;
  route: string;
  triggerAtEpochMs: number;
}

export interface NativeAutomationWakeEvent extends NativeAutomationScheduleEntry {
  firedAtEpochMs: number;
}

export interface NativeAutomationSchedulerCapabilities {
  supported: boolean;
  platform: string;
  durableHost: boolean;
  canScheduleExactAlarms: boolean;
  exactAlarmPermissionState: NativeAutomationPermissionState;
}

export interface NativeAutomationSyncResult {
  status: 'unsupported' | 'disabled' | 'scheduled';
  scheduledCount: number;
  entries: NativeAutomationScheduleEntry[];
  capabilities: NativeAutomationSchedulerCapabilities;
  reason: string;
}

interface NativeAutomationSchedulerPlugin {
  getCapabilities(): Promise<NativeAutomationSchedulerCapabilities>;
  replaceSchedules(options: {
    entries: NativeAutomationScheduleEntry[];
  }): Promise<{ scheduledCount: number; cancelledCount: number }>;
  cancelSchedules(options: { ids: string[] }): Promise<{ cancelledCount: number }>;
  cancelAll(): Promise<{ cancelledCount: number }>;
  listSchedules(): Promise<{ entries: NativeAutomationScheduleEntry[] }>;
  consumePendingWakeEvents(): Promise<{ events: NativeAutomationWakeEvent[] }>;
  addListener(
    eventName: 'automationWake',
    listenerFunc: (event: NativeAutomationWakeEvent) => void,
  ): Promise<PluginListenerHandle>;
}

const MIN_NATIVE_WAKE_LEAD_MS = 1_000;

const AutomationScheduler = registerPlugin<NativeAutomationSchedulerPlugin>(
  'AutomationScheduler',
);

let queuedSyncReason = 'manual';
let queuedSyncTimer: ReturnType<typeof setTimeout> | null = null;
let syncChain: Promise<void> = Promise.resolve();

function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function getUnsupportedCapabilities(): NativeAutomationSchedulerCapabilities {
  return {
    supported: false,
    platform: Capacitor.getPlatform(),
    durableHost: false,
    canScheduleExactAlarms: false,
    exactAlarmPermissionState: 'unsupported',
  };
}

function clampNativeTriggerAtEpochMs(triggerAtEpochMs: number, nowMs: number): number {
  return Math.max(triggerAtEpochMs, nowMs + MIN_NATIVE_WAKE_LEAD_MS);
}

function buildJobNativeScheduleEntry(
  job: AutomationJob,
  kind: NativeAutomationScheduleKind,
  triggerAtEpochMs: number,
  nowMs: number,
): NativeAutomationScheduleEntry {
  return {
    id: `${kind}:${job.id}`,
    kind,
    sourceId: job.id,
    title: job.title,
    domainId: job.domainId,
    route: '/automation',
    triggerAtEpochMs: clampNativeTriggerAtEpochMs(triggerAtEpochMs, nowMs),
  };
}

export function deriveNativeAutomationScheduleEntries(args: {
  jobs: AutomationJob[];
  rules: AutomationRule[];
  nowMs?: number;
}): NativeAutomationScheduleEntry[] {
  const nowMs = args.nowMs ?? Date.now();
  const entries: NativeAutomationScheduleEntry[] = [];

  args.jobs.forEach((job) => {
    if (job.state === 'pending') {
      const scheduledForMs = parseAutomationTimestamp(job.scheduledFor);
      if (scheduledForMs !== null) {
        entries.push(buildJobNativeScheduleEntry(job, 'job_due', scheduledForMs, nowMs));
      }
      return;
    }

    if (job.state === 'failed_retryable') {
      const retryAfterMs = parseAutomationTimestamp(job.retryAfter);
      if (retryAfterMs !== null) {
        entries.push(buildJobNativeScheduleEntry(job, 'job_retry', retryAfterMs, nowMs));
      }
    }
  });

  args.rules.forEach((rule) => {
    if (!rule.enabled || !rule.nextPlannedAt) {
      return;
    }
    const nextPlannedAtMs = parseAutomationTimestamp(rule.nextPlannedAt);
    if (nextPlannedAtMs === null) {
      return;
    }
    entries.push({
      id: `rule_expand:${rule.id}`,
      kind: 'rule_expand',
      sourceId: rule.id,
      title: rule.title,
      domainId: rule.domainId,
      route: '/automation',
      triggerAtEpochMs: clampNativeTriggerAtEpochMs(nextPlannedAtMs, nowMs),
    });
  });

  return entries.sort((left, right) => {
    if (left.triggerAtEpochMs !== right.triggerAtEpochMs) {
      return left.triggerAtEpochMs - right.triggerAtEpochMs;
    }
    return left.id.localeCompare(right.id);
  });
}

export async function getNativeAutomationSchedulerCapabilities(): Promise<NativeAutomationSchedulerCapabilities> {
  if (!isNativeAndroid()) {
    return getUnsupportedCapabilities();
  }

  try {
    return await AutomationScheduler.getCapabilities();
  } catch (error) {
    console.warn('Failed to read Android automation scheduler capabilities', error);
    return getUnsupportedCapabilities();
  }
}

export async function listNativeAutomationSchedules(): Promise<NativeAutomationScheduleEntry[]> {
  if (!isNativeAndroid()) {
    return [];
  }

  try {
    const result = await AutomationScheduler.listSchedules();
    return Array.isArray(result.entries) ? result.entries : [];
  } catch (error) {
    console.warn('Failed to list Android automation schedules', error);
    return [];
  }
}

export async function consumePendingNativeAutomationWakeEvents(): Promise<
  NativeAutomationWakeEvent[]
> {
  if (!isNativeAndroid()) {
    return [];
  }

  try {
    const result = await AutomationScheduler.consumePendingWakeEvents();
    return Array.isArray(result.events) ? result.events : [];
  } catch (error) {
    console.warn('Failed to consume Android automation wake events', error);
    return [];
  }
}

export async function addNativeAutomationWakeListener(
  listener: (event: NativeAutomationWakeEvent) => void,
): Promise<PluginListenerHandle> {
  if (!isNativeAndroid()) {
    return {
      remove: async () => {},
    };
  }

  try {
    return await AutomationScheduler.addListener('automationWake', listener);
  } catch (error) {
    console.warn('Failed to subscribe to Android automation wake events', error);
    return {
      remove: async () => {},
    };
  }
}

export async function syncNativeAutomationSchedule(args: {
  reason?: string;
  jobs?: AutomationJob[];
  rules?: AutomationRule[];
} = {}): Promise<NativeAutomationSyncResult> {
  const reason = args.reason || 'manual';
  const capabilities = await getNativeAutomationSchedulerCapabilities();

  if (!capabilities.supported || !isNativeAndroid()) {
    return {
      status: 'unsupported',
      scheduledCount: 0,
      entries: [],
      capabilities,
      reason,
    };
  }

  const settings = getSettings();
  if (!settings.enableAutomation || !settings.enableBackgroundMode) {
    try {
      await AutomationScheduler.cancelAll();
    } catch (error) {
      console.warn('Failed to clear Android automation schedules', error);
    }

    return {
      status: 'disabled',
      scheduledCount: 0,
      entries: [],
      capabilities,
      reason,
    };
  }

  const [jobs, rules] = await Promise.all([
    args.jobs || listAutomationJobs({ states: ['pending', 'failed_retryable'] }),
    args.rules || listAutomationRules({ enabled: true }),
  ]);

  const entries = deriveNativeAutomationScheduleEntries({
    jobs,
    rules,
  });

  try {
    const result = await AutomationScheduler.replaceSchedules({
      entries,
    });
    return {
      status: 'scheduled',
      scheduledCount: typeof result.scheduledCount === 'number' ? result.scheduledCount : 0,
      entries,
      capabilities,
      reason,
    };
  } catch (error) {
    console.warn('Failed to replace Android automation schedules', error);
    return {
      status: 'scheduled',
      scheduledCount: 0,
      entries: [],
      capabilities,
      reason,
    };
  }
}

export function scheduleNativeAutomationSync(reason: string = 'manual') {
  queuedSyncReason = reason;
  if (!isNativeAndroid()) {
    return;
  }
  if (queuedSyncTimer) {
    return;
  }

  queuedSyncTimer = setTimeout(() => {
    queuedSyncTimer = null;
    const nextReason = queuedSyncReason;
    syncChain = syncChain
      .catch(() => {})
      .then(async () => {
        await syncNativeAutomationSchedule({
          reason: nextReason,
        });
      });
  }, 0);
}

export async function cancelNativeAutomationSchedules(ids: string[]): Promise<number> {
  if (!isNativeAndroid() || ids.length === 0) {
    return 0;
  }

  try {
    const result = await AutomationScheduler.cancelSchedules({ ids });
    return typeof result.cancelledCount === 'number' ? result.cancelledCount : 0;
  } catch (error) {
    console.warn('Failed to cancel Android automation schedules', error);
    return 0;
  }
}
