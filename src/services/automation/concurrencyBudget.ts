import { Capacitor } from '@capacitor/core';
import { getSettings } from '@/src/services/settings';
import { DEFAULT_AUTOMATION_CONCURRENCY_CAPS } from './constants';

export type AutomationHostType = 'browser_web' | 'android_native' | 'desktop_shell';
export type AutomationNetworkMode = 'offline' | 'metered' | 'normal' | 'favorable';

export interface AutomationConcurrencyBudgetInput {
  hostType?: AutomationHostType;
  isBackground?: boolean;
  batterySaving?: boolean;
  networkMode?: AutomationNetworkMode;
  preferredMaxParallelJobs?: number;
}

export interface AutomationConcurrencyBudget {
  hostType: AutomationHostType;
  maxParallelJobs: number;
  isDurableHost: boolean;
  reasonTags: string[];
}

function detectDesktopShell(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const globalWindow = window as Window & {
    __MATCHFLOW_DESKTOP__?: boolean;
    __TAURI__?: unknown;
    electronAPI?: unknown;
  };

  if (globalWindow.__MATCHFLOW_DESKTOP__ || globalWindow.__TAURI__ || globalWindow.electronAPI) {
    return true;
  }

  return false;
}

export function detectAutomationHostType(): AutomationHostType {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    return 'android_native';
  }
  if (detectDesktopShell()) {
    return 'desktop_shell';
  }
  return 'browser_web';
}

export function resolveAutomationConcurrencyBudget(
  input: AutomationConcurrencyBudgetInput = {},
): AutomationConcurrencyBudget {
  const hostType = input.hostType || detectAutomationHostType();
  const reasonTags: string[] = [hostType];
  const settings = getSettings();
  const networkMode = input.networkMode || 'normal';
  const isBackground = Boolean(input.isBackground);
  const batterySaving = Boolean(input.batterySaving);
  const autonomousBackgroundEnabled = Boolean(settings.enableBackgroundMode);

  let maxParallelJobs = 1;

  if (hostType === 'android_native') {
    maxParallelJobs = isBackground
      ? DEFAULT_AUTOMATION_CONCURRENCY_CAPS.androidBackground
      : DEFAULT_AUTOMATION_CONCURRENCY_CAPS.androidForeground;
    reasonTags.push(isBackground ? 'background' : 'foreground');
  } else if (hostType === 'desktop_shell') {
    maxParallelJobs =
      networkMode === 'favorable' && !batterySaving
        ? DEFAULT_AUTOMATION_CONCURRENCY_CAPS.desktopShellFavorable
        : DEFAULT_AUTOMATION_CONCURRENCY_CAPS.desktopShell;
    reasonTags.push('desktop');
  } else {
    maxParallelJobs = DEFAULT_AUTOMATION_CONCURRENCY_CAPS.browserWeb;
    reasonTags.push('browser');
  }

  if (networkMode === 'offline') {
    maxParallelJobs = 0;
    reasonTags.push('offline');
  } else if (networkMode === 'metered') {
    maxParallelJobs = Math.max(1, maxParallelJobs - 1);
    reasonTags.push('metered');
  } else if (networkMode === 'favorable') {
    reasonTags.push('favorable-network');
  }

  if (batterySaving) {
    maxParallelJobs = Math.max(1, maxParallelJobs - 1);
    reasonTags.push('battery-saving');
  }

  if (hostType === 'browser_web' && isBackground && !autonomousBackgroundEnabled) {
    maxParallelJobs = 0;
    reasonTags.push('browser-background-disabled');
  }

  if (
    typeof input.preferredMaxParallelJobs === 'number' &&
    Number.isFinite(input.preferredMaxParallelJobs)
  ) {
    maxParallelJobs = Math.min(
      maxParallelJobs,
      Math.max(0, Math.floor(input.preferredMaxParallelJobs)),
    );
    reasonTags.push('preferred-cap');
  }

  return {
    hostType,
    maxParallelJobs,
    isDurableHost: hostType === 'android_native' || hostType === 'desktop_shell',
    reasonTags,
  };
}
