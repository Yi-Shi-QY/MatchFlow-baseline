import type { AutomationJob, AutomationRun } from './types';

export type AutomationExecutionPhase =
  | 'started'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AutomationJobExecutionState {
  phase: AutomationExecutionPhase;
  job: AutomationJob;
  run: AutomationRun;
}

export interface AutomationJobExecutionContext {
  includeAnimations?: boolean;
  signal?: AbortSignal;
  resumeMode?: 'enabled' | 'disabled';
  onStateChange?: (state: AutomationJobExecutionState) => void | Promise<void>;
}
