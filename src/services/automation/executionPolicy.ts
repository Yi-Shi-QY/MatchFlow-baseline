import { DEFAULT_AUTOMATION_EXECUTION_POLICY } from './constants';
import type {
  AutomationExecutionPolicy,
  AutomationExecutionTargetExpansion,
} from './types';

export type AutomationExecutionTargetScope = 'single' | 'collection';

const AUTOMATION_COLLECTION_TARGET_SCOPE_PATTERNS = [
  /\b(all|all matches|all fixtures)\b/i,
  /(全部|全量)/i,
];

export function getAutomationExecutionTargetScope(
  policy?: Pick<AutomationExecutionPolicy, 'targetExpansion'> | null,
): AutomationExecutionTargetScope {
  return policy?.targetExpansion === 'all_matches' ? 'collection' : 'single';
}

export function isAutomationExpandedTargetPolicy(
  policy?: Pick<AutomationExecutionPolicy, 'targetExpansion'> | null,
): boolean {
  return getAutomationExecutionTargetScope(policy) === 'collection';
}

export function detectAutomationExecutionTargetScope(
  input: string,
): AutomationExecutionTargetScope {
  return AUTOMATION_COLLECTION_TARGET_SCOPE_PATTERNS.some((pattern) => pattern.test(input))
    ? 'collection'
    : 'single';
}

export function toAutomationExecutionTargetExpansion(
  scope: AutomationExecutionTargetScope,
): AutomationExecutionTargetExpansion {
  return scope === 'collection' ? 'all_matches' : 'single';
}

export function createAutomationExecutionPolicyForScope(
  scope: AutomationExecutionTargetScope,
  basePolicy: AutomationExecutionPolicy = DEFAULT_AUTOMATION_EXECUTION_POLICY,
): AutomationExecutionPolicy {
  return {
    ...basePolicy,
    targetExpansion: toAutomationExecutionTargetExpansion(scope),
  };
}

export function createExpandedAutomationExecutionPolicy(
  basePolicy: AutomationExecutionPolicy = DEFAULT_AUTOMATION_EXECUTION_POLICY,
): AutomationExecutionPolicy {
  return createAutomationExecutionPolicyForScope('collection', basePolicy);
}

export function normalizeAutomationExecutionTargetExpansion(
  input: unknown,
  fallback: AutomationExecutionTargetExpansion = DEFAULT_AUTOMATION_EXECUTION_POLICY.targetExpansion,
): AutomationExecutionTargetExpansion {
  return input === 'all_matches' ? 'all_matches' : fallback;
}
