import {
  getSettings,
  saveSettings,
  type AppSettings,
} from '@/src/services/settings';
import { detectAutomationHostType, type AutomationHostType } from './concurrencyBudget';
import { listAutomationJobs } from './jobStore';
import { listAutomationRules } from './ruleStore';
import type { AutomationDraft, AutomationJob, AutomationRule } from './types';

const LEGACY_AUTOMATION_SETTINGS_REPAIR_KEY =
  'matchflow_automation_execution_settings_repair_v1';

export interface AutomationExecutionSettingsRepairResult {
  changed: boolean;
  autoEnabledAutomation: boolean;
  autoEnabledBackground: boolean;
  settings: AppSettings;
}

function isDurableBackgroundHost(hostType: AutomationHostType): boolean {
  return hostType === 'android_native' || hostType === 'desktop_shell';
}

function hasRepairMarker(): boolean {
  if (typeof localStorage === 'undefined') {
    return false;
  }

  return localStorage.getItem(LEGACY_AUTOMATION_SETTINGS_REPAIR_KEY) === '1';
}

function persistRepairMarker(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(LEGACY_AUTOMATION_SETTINGS_REPAIR_KEY, '1');
}

function applyExecutionSettingsPatch(input: {
  enableAutomation: boolean;
  enableBackground: boolean;
}): AutomationExecutionSettingsRepairResult {
  const current = getSettings();
  const next: AppSettings = {
    ...current,
  };

  let autoEnabledAutomation = false;
  let autoEnabledBackground = false;

  if (input.enableAutomation && !current.enableAutomation) {
    next.enableAutomation = true;
    autoEnabledAutomation = true;
  }

  if (input.enableBackground && !current.enableBackgroundMode) {
    next.enableBackgroundMode = true;
    autoEnabledBackground = true;
  }

  const changed = autoEnabledAutomation || autoEnabledBackground;
  if (changed) {
    saveSettings(next);
  }

  return {
    changed,
    autoEnabledAutomation,
    autoEnabledBackground,
    settings: changed ? next : current,
  };
}

function shouldEnableBackgroundForDraft(
  draft: AutomationDraft,
  hostType: AutomationHostType,
): boolean {
  if (!isDurableBackgroundHost(hostType)) {
    return false;
  }

  return draft.activationMode !== 'run_now' || draft.intentType === 'recurring';
}

function hasActiveAutomationWorkload(input: {
  jobs: AutomationJob[];
  rules: AutomationRule[];
}): boolean {
  return (
    input.jobs.some(
      (job) =>
        job.state === 'pending' ||
        job.state === 'eligible' ||
        job.state === 'running' ||
        job.state === 'failed_retryable',
    ) || input.rules.some((rule) => rule.enabled)
  );
}

export function ensureAutomationExecutionSettingsForDraft(
  draft: AutomationDraft,
  input: {
    hostType?: AutomationHostType;
  } = {},
): AutomationExecutionSettingsRepairResult {
  const hostType = input.hostType || detectAutomationHostType();
  return applyExecutionSettingsPatch({
    enableAutomation: true,
    enableBackground: shouldEnableBackgroundForDraft(draft, hostType),
  });
}

export async function repairLegacyAutomationExecutionSettings(
  input: {
    hostType?: AutomationHostType;
    jobs?: AutomationJob[];
    rules?: AutomationRule[];
    force?: boolean;
  } = {},
): Promise<AutomationExecutionSettingsRepairResult> {
  if (!input.force && hasRepairMarker()) {
    return {
      changed: false,
      autoEnabledAutomation: false,
      autoEnabledBackground: false,
      settings: getSettings(),
    };
  }

  const hostType = input.hostType || detectAutomationHostType();
  const [jobs, rules] = await Promise.all([
    input.jobs ||
      listAutomationJobs({
        states: ['pending', 'eligible', 'running', 'failed_retryable'],
      }),
    input.rules || listAutomationRules({ enabled: true }),
  ]);

  const result = hasActiveAutomationWorkload({
    jobs,
    rules,
  })
    ? applyExecutionSettingsPatch({
        enableAutomation: true,
        enableBackground: isDurableBackgroundHost(hostType),
      })
    : {
        changed: false,
        autoEnabledAutomation: false,
        autoEnabledBackground: false,
        settings: getSettings(),
      };

  persistRepairMarker();
  return result;
}
