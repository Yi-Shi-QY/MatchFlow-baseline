import type {
  AIProvider,
} from '@/src/services/settings';
import type {
  AutomationExecutionPolicy,
  AutomationNotificationPolicy,
} from './types';

export const AUTOMATION_DRAFTS_STORAGE_KEY = 'matchflow_automation_drafts_v1';
export const AUTOMATION_RULES_STORAGE_KEY = 'matchflow_automation_rules_v1';
export const AUTOMATION_JOBS_STORAGE_KEY = 'matchflow_automation_jobs_v1';
export const AUTOMATION_RUNS_STORAGE_KEY = 'matchflow_automation_runs_v1';

export const MAX_AUTOMATION_DRAFT_COUNT = 24;
export const MAX_AUTOMATION_RULE_COUNT = 64;
export const MAX_AUTOMATION_JOB_COUNT = 256;
export const MAX_AUTOMATION_RUN_COUNT = 256;

export const MAX_AUTOMATION_CLARIFICATION_ROUNDS = 3;

export const DEFAULT_AUTOMATION_NOTIFICATION_POLICY: AutomationNotificationPolicy = {
  notifyOnClarification: true,
  notifyOnStart: false,
  notifyOnComplete: true,
  notifyOnFailure: true,
};

export const DEFAULT_AUTOMATION_EXECUTION_POLICY: AutomationExecutionPolicy = {
  targetExpansion: 'single',
  recoveryWindowMinutes: 30,
  maxRetries: 2,
};

export const DEFAULT_AUTOMATION_CONCURRENCY_CAPS = {
  browserWeb: 1,
  androidBackground: 2,
  androidForeground: 3,
  desktopShell: 4,
  desktopShellFavorable: 6,
} as const;

export const DEFAULT_AUTOMATION_PROVIDER_CAPS: Record<AIProvider, number> = {
  gemini: 2,
  deepseek: 2,
  openai_compatible: 3,
};

export const DEFAULT_AUTOMATION_STALE_RUN_TIMEOUT_MS = 90 * 60 * 1000;
export const DEFAULT_AUTOMATION_RETRY_BACKOFF_MS = 5 * 60 * 1000;
