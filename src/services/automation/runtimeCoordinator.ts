import { getSettings } from '@/src/services/settings';
import {
  detectAutomationHostType,
  resolveAutomationConcurrencyBudget,
  type AutomationHostType,
  type AutomationConcurrencyBudgetInput,
} from './concurrencyBudget';
import {
  getAutomationQueueSnapshot,
  subscribeAutomationQueue,
  type AutomationQueueSnapshot,
} from './queue';
import {
  runAutomationHeartbeat,
  type AutomationHeartbeatResult,
} from './heartbeat';

const ACTIVE_HEARTBEAT_INTERVAL_MS = 30_000;
const BACKGROUND_HEARTBEAT_INTERVAL_MS = 60_000;

export type AutomationRuntimeStatus = 'idle' | 'running' | 'paused' | 'error';

export interface AutomationRuntimeHeartbeatSummary {
  eligibleJobIds: string[];
  createdJobCount: number;
  executedJobCount: number;
  counts: AutomationHeartbeatResult['counts'];
}

export interface AutomationRuntimeSnapshot {
  status: AutomationRuntimeStatus;
  automationEnabled: boolean;
  backgroundEnabled: boolean;
  isAppActive: boolean;
  hostType: AutomationHostType;
  isDurableHost: boolean;
  nextIntervalMs: number;
  lastTrigger: string | null;
  lastStartedAt: number | null;
  lastCompletedAt: number | null;
  lastError: string | null;
  heartbeat: AutomationRuntimeHeartbeatSummary | null;
  queue: AutomationQueueSnapshot;
}

export interface AutomationRuntimePollingDecision {
  shouldPoll: boolean;
  reason: string;
  intervalMs: number;
  budgetInput: AutomationConcurrencyBudgetInput;
  hostType: AutomationHostType;
  isDurableHost: boolean;
}

const listeners = new Set<(snapshot: AutomationRuntimeSnapshot) => void>();

let queueUnsubscribe: (() => void) | null = null;
let tickTimer: ReturnType<typeof setTimeout> | null = null;
let startRequested = false;
let isAppActive = true;
let activeTick: Promise<void> | null = null;

let runtimeSnapshot: AutomationRuntimeSnapshot = {
  status: 'idle',
  automationEnabled: false,
  backgroundEnabled: false,
  isAppActive: true,
  hostType: detectAutomationHostType(),
  isDurableHost: false,
  nextIntervalMs: ACTIVE_HEARTBEAT_INTERVAL_MS,
  lastTrigger: null,
  lastStartedAt: null,
  lastCompletedAt: null,
  lastError: null,
  heartbeat: null,
  queue: getAutomationQueueSnapshot(),
};

function publishRuntimeSnapshot(snapshot: AutomationRuntimeSnapshot) {
  runtimeSnapshot = snapshot;
  listeners.forEach((listener) => listener(runtimeSnapshot));
}

function updateRuntimeSnapshot(partial: Partial<AutomationRuntimeSnapshot>) {
  publishRuntimeSnapshot({
    ...runtimeSnapshot,
    ...partial,
  });
}

function clearTickTimer() {
  if (tickTimer) {
    clearTimeout(tickTimer);
    tickTimer = null;
  }
}

function detectVisibilityActivity(): boolean {
  if (typeof document === 'undefined') {
    return true;
  }
  return document.visibilityState !== 'hidden';
}

export function getAutomationRuntimeSnapshot(): AutomationRuntimeSnapshot {
  return runtimeSnapshot;
}

export function subscribeAutomationRuntime(
  listener: (snapshot: AutomationRuntimeSnapshot) => void,
): () => void {
  listeners.add(listener);
  listener(runtimeSnapshot);
  return () => {
    listeners.delete(listener);
  };
}

export function resolveAutomationRuntimePollingDecision(input?: {
  automationEnabled?: boolean;
  backgroundEnabled?: boolean;
  isAppActive?: boolean;
  hostType?: AutomationHostType;
}): AutomationRuntimePollingDecision {
  const settings = getSettings();
  const automationEnabled =
    typeof input?.automationEnabled === 'boolean'
      ? input.automationEnabled
      : Boolean(settings.enableAutomation);
  const backgroundEnabled =
    typeof input?.backgroundEnabled === 'boolean'
      ? input.backgroundEnabled
      : Boolean(settings.enableBackgroundMode);
  const hostType = input?.hostType || detectAutomationHostType();
  const appActive =
    typeof input?.isAppActive === 'boolean'
      ? input.isAppActive
      : detectVisibilityActivity();
  const budget = resolveAutomationConcurrencyBudget({
    hostType,
    isBackground: !appActive,
  });

  if (!automationEnabled) {
    return {
      shouldPoll: false,
      reason: 'automation_disabled',
      intervalMs: ACTIVE_HEARTBEAT_INTERVAL_MS,
      budgetInput: {
        hostType,
        isBackground: !appActive,
      },
      hostType,
      isDurableHost: budget.isDurableHost,
    };
  }

  if (appActive) {
    return {
      shouldPoll: true,
      reason: 'app_active',
      intervalMs: ACTIVE_HEARTBEAT_INTERVAL_MS,
      budgetInput: {
        hostType,
        isBackground: false,
      },
      hostType,
      isDurableHost: budget.isDurableHost,
    };
  }

  if (!backgroundEnabled) {
    return {
      shouldPoll: false,
      reason: 'background_disabled',
      intervalMs: BACKGROUND_HEARTBEAT_INTERVAL_MS,
      budgetInput: {
        hostType,
        isBackground: true,
      },
      hostType,
      isDurableHost: budget.isDurableHost,
    };
  }

  if (!budget.isDurableHost) {
    return {
      shouldPoll: false,
      reason: 'host_not_durable',
      intervalMs: BACKGROUND_HEARTBEAT_INTERVAL_MS,
      budgetInput: {
        hostType,
        isBackground: true,
      },
      hostType,
      isDurableHost: budget.isDurableHost,
    };
  }

  return {
    shouldPoll: true,
    reason: 'background_host_available',
    intervalMs: BACKGROUND_HEARTBEAT_INTERVAL_MS,
    budgetInput: {
      hostType,
      isBackground: true,
    },
    hostType,
    isDurableHost: budget.isDurableHost,
  };
}

function scheduleNextTick(trigger: string) {
  if (!startRequested) {
    return;
  }

  clearTickTimer();
  const decision = resolveAutomationRuntimePollingDecision({
    isAppActive,
  });

  updateRuntimeSnapshot({
    automationEnabled: decision.reason !== 'automation_disabled',
    backgroundEnabled: Boolean(getSettings().enableBackgroundMode),
    isAppActive,
    hostType: decision.hostType,
    isDurableHost: decision.isDurableHost,
    nextIntervalMs: decision.intervalMs,
    lastTrigger: trigger,
  });

  if (!decision.shouldPoll) {
    updateRuntimeSnapshot({
      status: runtimeSnapshot.lastError ? 'error' : 'paused',
    });
    return;
  }

  tickTimer = setTimeout(() => {
    void runAutomationRuntimeTick('interval');
  }, decision.intervalMs);
}

export async function runAutomationRuntimeTick(trigger: string = 'manual'): Promise<void> {
  if (activeTick) {
    return activeTick;
  }

  const decision = resolveAutomationRuntimePollingDecision({
    isAppActive,
  });
  updateRuntimeSnapshot({
    automationEnabled: decision.reason !== 'automation_disabled',
    backgroundEnabled: Boolean(getSettings().enableBackgroundMode),
    isAppActive,
    hostType: decision.hostType,
    isDurableHost: decision.isDurableHost,
    nextIntervalMs: decision.intervalMs,
    lastTrigger: trigger,
  });

  if (!decision.shouldPoll) {
    updateRuntimeSnapshot({
      status: runtimeSnapshot.lastError ? 'error' : 'paused',
    });
    scheduleNextTick(trigger);
    return;
  }

  const startedAt = Date.now();
  updateRuntimeSnapshot({
    status: 'running',
    lastStartedAt: startedAt,
    lastError: null,
  });

  activeTick = (async () => {
    try {
      const result = await runAutomationHeartbeat({
        runQueue: true,
        budgetInput: decision.budgetInput,
      });
      updateRuntimeSnapshot({
        status: 'idle',
        lastCompletedAt: Date.now(),
        heartbeat: {
          eligibleJobIds: result.eligibleJobIds,
          createdJobCount: result.schedulerResult.createdJobs.length,
          executedJobCount: result.queueResult?.executedJobIds.length || 0,
          counts: result.counts,
        },
      });
    } catch (error) {
      updateRuntimeSnapshot({
        status: 'error',
        lastCompletedAt: Date.now(),
        lastError:
          error instanceof Error && error.message
            ? error.message
            : 'Automation runtime tick failed.',
      });
    } finally {
      activeTick = null;
      scheduleNextTick(trigger);
    }
  })();

  return activeTick;
}

export function startAutomationRuntime() {
  if (startRequested) {
    return;
  }

  startRequested = true;
  isAppActive = detectVisibilityActivity();

  queueUnsubscribe = subscribeAutomationQueue((queueSnapshot) => {
    updateRuntimeSnapshot({
      queue: queueSnapshot,
    });
  });

  void runAutomationRuntimeTick('startup');
}

export function stopAutomationRuntime() {
  startRequested = false;
  clearTickTimer();
  if (queueUnsubscribe) {
    queueUnsubscribe();
    queueUnsubscribe = null;
  }
}

export function setAutomationRuntimeAppActive(nextIsActive: boolean) {
  isAppActive = nextIsActive;
  updateRuntimeSnapshot({
    isAppActive: nextIsActive,
  });

  if (!startRequested) {
    return;
  }

  if (nextIsActive) {
    void runAutomationRuntimeTick('app_active');
    return;
  }

  scheduleNextTick('app_inactive');
}

export function kickAutomationRuntime(trigger: string = 'manual') {
  if (!startRequested) {
    startAutomationRuntime();
    return;
  }
  clearTickTimer();
  void runAutomationRuntimeTick(trigger);
}
