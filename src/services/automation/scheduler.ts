import { listAutomationJobs } from './jobStore';
import { listAutomationRules } from './ruleStore';
import {
  expandAutomationRules,
  persistRuleExpansionResult,
  type RuleExpansionOptions,
  type RuleExpansionResult,
} from './ruleExpansion';
import type { AutomationJob, AutomationRule } from './types';

export interface AutomationSchedulerCycleOptions extends RuleExpansionOptions {
  rules?: AutomationRule[];
  existingJobs?: AutomationJob[];
  persist?: boolean;
}

export interface AutomationSchedulerCycleResult extends RuleExpansionResult {
  scannedRuleCount: number;
  existingJobCount: number;
}

export async function runAutomationSchedulerCycle(
  options: AutomationSchedulerCycleOptions = {},
): Promise<AutomationSchedulerCycleResult> {
  const rules = options.rules || (await listAutomationRules({ enabled: true }));
  const existingJobs = options.existingJobs || (await listAutomationJobs());
  const result = expandAutomationRules(rules, existingJobs, options);

  if (options.persist !== false) {
    await persistRuleExpansionResult(result);
  }

  return {
    ...result,
    scannedRuleCount: rules.length,
    existingJobCount: existingJobs.length,
  };
}
