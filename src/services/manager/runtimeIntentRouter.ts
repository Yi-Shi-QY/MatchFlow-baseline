import {
  getDefaultRuntimeDomainPack,
  getRuntimeDomainPackById,
  listRuntimeDomainPacks,
} from '@/src/domains/runtime/registry';
import type {
  DomainRuntimePack,
  RuntimeManagerCapability,
  RuntimeManagerLegacyEffectInput,
  RuntimeLocalizedText,
  RuntimeConversationTurn,
  RuntimeToolExecutionResult,
  SessionWorkflowStateSnapshot,
} from '@/src/domains/runtime/types';
import { parseManagerIntakeWorkflowSnapshot } from '@/src/services/manager-intake/workflowProjection';
import { resolveManagerRoutingResult } from '@/src/services/manager-orchestration/router';
import type { ManagerRoutingResult } from '@/src/services/manager-orchestration/types';
import type {
  ManagerConversationEffect,
  ManagerLanguage,
  ManagerPendingTask,
} from './types';

function resolveRuntimePack(
  runtimePack?: DomainRuntimePack | null,
  domainId?: string | null,
): DomainRuntimePack | null {
  return runtimePack || getRuntimeDomainPackById(domainId) || getDefaultRuntimeDomainPack();
}

function isPendingTaskStage(value: unknown): value is ManagerPendingTask['stage'] {
  return value === 'await_factors' || value === 'await_sequence';
}

function isManagerPendingTask(input: unknown): input is ManagerPendingTask {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return false;
  }

  const value = input as Record<string, unknown>;
  return (
    typeof value.id === 'string' &&
    typeof value.sourceText === 'string' &&
    Array.isArray(value.drafts) &&
    isPendingTaskStage(value.stage)
  );
}

export function getRuntimeManagerCapability(input: {
  runtimePack?: DomainRuntimePack | null;
  domainId?: string | null;
}): RuntimeManagerCapability | null {
  return resolveRuntimePack(input.runtimePack, input.domainId)?.manager || null;
}

export function runtimeManagerSupportsTool(input: {
  runtimePack?: DomainRuntimePack | null;
  domainId?: string | null;
  toolId: string;
}): boolean {
  const capability = getRuntimeManagerCapability(input);
  return Array.isArray(capability?.skillIds) && capability.skillIds.includes(input.toolId);
}

export function runtimePackSupportsManagerLlm(input: {
  runtimePack?: DomainRuntimePack | null;
  domainId?: string | null;
}): boolean {
  const capability = getRuntimeManagerCapability(input);
  return Boolean(capability?.parsePendingTask && capability?.mapLegacyEffect);
}

export function parseRuntimeManagerPendingTask(input: {
  runtimePack?: DomainRuntimePack | null;
  domainId?: string | null;
  workflow: SessionWorkflowStateSnapshot | null | undefined;
}): ManagerPendingTask | null {
  const capability = getRuntimeManagerCapability(input);
  const raw = capability?.parsePendingTask?.(input.workflow);
  return isManagerPendingTask(raw) ? raw : null;
}

export interface RuntimeManagerTaskIntakeSummary {
  workflowType: string;
  sourceText: string;
  activeStepId: string | null;
  activeStepTitle?: string | null;
  recognizedSlotIds: string[];
  missingSlotIds: string[];
  completed: boolean;
}

function readLocalizedRuntimeText(
  text: RuntimeLocalizedText | undefined,
  language: ManagerLanguage,
): string | null {
  if (!text) {
    return null;
  }

  const preferred = language === 'zh' ? text.zh : text.en;
  if (typeof preferred === 'string' && preferred.trim().length > 0) {
    return preferred.trim();
  }

  const fallback = language === 'zh' ? text.en : text.zh;
  return typeof fallback === 'string' && fallback.trim().length > 0 ? fallback.trim() : null;
}

export function parseRuntimeManagerTaskIntakeSummary(input: {
  runtimePack?: DomainRuntimePack | null;
  domainId?: string | null;
  workflow: SessionWorkflowStateSnapshot | null | undefined;
  language: ManagerLanguage;
}): RuntimeManagerTaskIntakeSummary | null {
  const capability = getRuntimeManagerCapability(input);
  const taskIntake = capability?.taskIntake;
  if (!taskIntake || !input.workflow) {
    return null;
  }

  const workflowState = parseManagerIntakeWorkflowSnapshot(
    input.workflow,
    taskIntake.definition.workflowType,
  );
  if (!workflowState) {
    return null;
  }

  const activeStep = taskIntake.definition.steps.find(
    (step) => step.stepId === workflowState.activeStepId,
  );

  return {
    workflowType: workflowState.workflowType,
    sourceText: workflowState.sourceText,
    activeStepId: workflowState.activeStepId,
    activeStepTitle: readLocalizedRuntimeText(activeStep?.title, input.language),
    recognizedSlotIds: [...workflowState.recognizedSlotIds],
    missingSlotIds: [...workflowState.missingSlotIds],
    completed: workflowState.completed,
  };
}

export function mapRuntimeManagerEffect(input: {
  runtimePack?: DomainRuntimePack | null;
  domainId?: string | null;
  effect: ManagerConversationEffect;
}): RuntimeToolExecutionResult | null {
  const capability = getRuntimeManagerCapability(input);
  const mapper = capability?.mapLegacyEffect;
  if (!mapper) {
    return null;
  }

  return mapper(input.effect as unknown as RuntimeManagerLegacyEffectInput);
}

function readLocalizedText(
  capability: RuntimeManagerCapability | null,
  language: ManagerLanguage,
  key: 'helpText' | 'factorsText' | 'sequenceText',
): string | null {
  const text = capability?.plannerHints?.[key]?.[language];
  return typeof text === 'string' && text.trim().length > 0 ? text.trim() : null;
}

function readTaskIntakeTopicText(
  capability: RuntimeManagerCapability | null,
  language: ManagerLanguage,
  topic: 'help' | 'factors' | 'sequence',
): string | null {
  const text = capability?.taskIntake?.describeTopic?.({
    topic,
    language,
  });
  return typeof text === 'string' && text.trim().length > 0 ? text.trim() : null;
}

function buildGenericHelpText(language: ManagerLanguage): string {
  return language === 'zh'
    ? '你可以直接告诉我想分析什么、什么时候执行；如果当前领域支持，我也可以先查询本地数据，再生成任务卡片。'
    : 'Tell me what you want to analyze and when to run it. If this domain supports it, I can also query local data first and then create task cards.';
}

export function resolveRuntimeManagerHelpText(input: {
  runtimePack?: DomainRuntimePack | null;
  domainId?: string | null;
  language: ManagerLanguage;
}): string {
  const capability = getRuntimeManagerCapability(input);
  return (
    readTaskIntakeTopicText(capability, input.language, 'help') ||
    readLocalizedText(capability, input.language, 'helpText') ||
    buildGenericHelpText(input.language)
  );
}

export function resolveRuntimeManagerCapabilityText(input: {
  runtimePack?: DomainRuntimePack | null;
  domainId?: string | null;
  language: ManagerLanguage;
  topic: 'factors' | 'sequence' | 'help';
}): string {
  const capability = getRuntimeManagerCapability(input);
  const taskIntakeText = readTaskIntakeTopicText(capability, input.language, input.topic);
  const directText =
    input.topic === 'factors'
      ? readLocalizedText(capability, input.language, 'factorsText')
      : input.topic === 'sequence'
        ? readLocalizedText(capability, input.language, 'sequenceText')
        : readLocalizedText(capability, input.language, 'helpText');

  return taskIntakeText || directText || resolveRuntimeManagerHelpText(input);
}

export function resolveRuntimeManagerWorkflowType(input: {
  runtimePack?: DomainRuntimePack | null;
  domainId?: string | null;
}): string | null {
  const capability = getRuntimeManagerCapability(input);
  const workflowType = capability?.plannerHints?.defaultWorkflowType;
  return typeof workflowType === 'string' && workflowType.trim().length > 0
    ? workflowType.trim()
    : null;
}

export async function resolveRuntimeManagerRoutingResult(input: {
  input: string;
  language: ManagerLanguage;
  runtimePacks?: DomainRuntimePack[];
  sessionId?: string;
  activeDomainId?: string | null;
  recentMessages?: RuntimeConversationTurn[];
  activeWorkflow?: SessionWorkflowStateSnapshot | null;
  signal?: AbortSignal;
}): Promise<ManagerRoutingResult> {
  return resolveManagerRoutingResult({
    text: input.input,
    language: input.language,
    runtimePacks:
      Array.isArray(input.runtimePacks) && input.runtimePacks.length > 0
        ? input.runtimePacks
        : listRuntimeDomainPacks(),
    sessionId: input.sessionId,
    activeDomainId: input.activeDomainId,
    recentMessages: input.recentMessages,
    activeWorkflow: input.activeWorkflow,
    signal: input.signal,
  });
}
