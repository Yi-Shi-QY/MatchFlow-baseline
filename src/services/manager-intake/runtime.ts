import type {
  RuntimeTaskIntakeCapability,
  RuntimeTaskIntakeDefinition,
  RuntimeTaskIntakeStepDefinition,
  RuntimeTaskIntakeValue,
} from '@/src/domains/runtime/types';
import type { AutomationCommandComposerMode } from '@/src/services/automation/commandCenter';
import type { AutomationDraft } from '@/src/services/automation/types';
import { createAutomationId } from '@/src/services/automation/utils';
import type { ManagerIntakeStepState, ManagerIntakeWorkflowState } from './types';

function cloneRuntimeValue<T extends RuntimeTaskIntakeValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function cloneSlotValues(
  slotValues: Record<string, RuntimeTaskIntakeValue> | undefined,
): Record<string, RuntimeTaskIntakeValue> {
  if (!slotValues) {
    return {};
  }

  return Object.entries(slotValues).reduce<Record<string, RuntimeTaskIntakeValue>>((acc, [key, value]) => {
    acc[key] = cloneRuntimeValue(value);
    return acc;
  }, {});
}

function hasMeaningfulValue(value: RuntimeTaskIntakeValue | undefined): boolean {
  if (value === null || typeof value === 'undefined') {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return Object.keys(value).length > 0;
}

function resolveMissingSlotIds(
  definition: RuntimeTaskIntakeDefinition,
  slotValues: Record<string, RuntimeTaskIntakeValue>,
): string[] {
  return definition.slots
    .filter((slot) => slot.required && !hasMeaningfulValue(slotValues[slot.slotId]))
    .map((slot) => slot.slotId);
}

function resolveActiveStepId(
  definition: RuntimeTaskIntakeDefinition,
  missingSlotIds: string[],
): string | null {
  for (const step of definition.steps) {
    if (step.slotIds.some((slotId) => missingSlotIds.includes(slotId))) {
      return step.stepId;
    }
  }

  return null;
}

export function buildManagerIntakeStepStates(input: {
  definition: RuntimeTaskIntakeDefinition;
  missingSlotIds: string[];
  activeStepId: string | null;
}): ManagerIntakeStepState[] {
  return input.definition.steps.map((step) => {
    const hasMissing = step.slotIds.some((slotId) => input.missingSlotIds.includes(slotId));
    const status: ManagerIntakeStepState['status'] =
      step.stepId === input.activeStepId
        ? 'active'
        : hasMissing
          ? 'pending'
          : 'completed';

    return {
      stepId: step.stepId,
      title: step.title,
      description: step.description,
      slotIds: [...step.slotIds],
      status,
    };
  });
}

function mergeSlotValues(input: {
  definition: RuntimeTaskIntakeDefinition;
  previous: Record<string, RuntimeTaskIntakeValue>;
  next: Record<string, RuntimeTaskIntakeValue> | undefined;
}): Record<string, RuntimeTaskIntakeValue> {
  const merged = cloneSlotValues(input.previous);
  const nextValues = input.next || {};

  input.definition.slots.forEach((slot) => {
    if (Object.prototype.hasOwnProperty.call(nextValues, slot.slotId)) {
      merged[slot.slotId] = cloneRuntimeValue(nextValues[slot.slotId] as RuntimeTaskIntakeValue);
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(merged, slot.slotId) && input.definition.defaultSlotValues) {
      const defaultValue = input.definition.defaultSlotValues[slot.slotId];
      if (typeof defaultValue !== 'undefined') {
        merged[slot.slotId] = cloneRuntimeValue(defaultValue);
      }
    }
  });

  return merged;
}

function buildManagerIntakeState(input: {
  workflowId: string;
  domainId: string;
  sourceText: string;
  composerMode: AutomationCommandComposerMode;
  drafts: AutomationDraft[];
  definition: RuntimeTaskIntakeDefinition;
  slotValues: Record<string, RuntimeTaskIntakeValue>;
  recognizedSlotIds: string[];
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}): ManagerIntakeWorkflowState {
  const missingSlotIds = resolveMissingSlotIds(input.definition, input.slotValues);
  const activeStepId = resolveActiveStepId(input.definition, missingSlotIds);

  return {
    schemaVersion: 'manager_intake_v1',
    workflowId: input.workflowId,
    workflowType: input.definition.workflowType,
    domainId: input.domainId,
    sourceText: input.sourceText,
    composerMode: input.composerMode,
    drafts: input.drafts.map((draft) => ({ ...draft })),
    slotValues: cloneSlotValues(input.slotValues),
    recognizedSlotIds: Array.from(new Set(input.recognizedSlotIds)),
    missingSlotIds,
    activeStepId,
    completed: missingSlotIds.length === 0,
    metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) as Record<string, unknown> : undefined,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

export async function createManagerIntakeWorkflowState(input: {
  capability: RuntimeTaskIntakeCapability;
  domainId: string;
  sourceText: string;
  composerMode: AutomationCommandComposerMode;
  drafts: AutomationDraft[];
  language: 'zh' | 'en';
  workflowId?: string;
  createdAt?: number;
  updatedAt?: number;
  signal?: AbortSignal;
}): Promise<ManagerIntakeWorkflowState> {
  const createdAt = typeof input.createdAt === 'number' ? input.createdAt : Date.now();
  const definition = input.capability.definition;
  const baseSlotValues = cloneSlotValues(definition.defaultSlotValues);
  const parseResult = await input.capability.parseInput({
    input: input.sourceText,
    language: input.language,
    slotValues: baseSlotValues,
    activeStepId: definition.steps[0]?.stepId || null,
    signal: input.signal,
  });
  const slotValues = mergeSlotValues({
    definition,
    previous: baseSlotValues,
    next: parseResult.slotValues,
  });

  return buildManagerIntakeState({
    workflowId: input.workflowId || createAutomationId('manager_intake'),
    domainId: input.domainId,
    sourceText: input.sourceText,
    composerMode: input.composerMode,
    drafts: input.drafts,
    definition,
    slotValues,
    recognizedSlotIds: parseResult.recognizedSlotIds || [],
    metadata: parseResult.metadata,
    createdAt,
    updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : createdAt,
  });
}

export async function applyManagerIntakeAnswer(input: {
  capability: RuntimeTaskIntakeCapability;
  state: ManagerIntakeWorkflowState;
  answer: string;
  language: 'zh' | 'en';
  updatedAt?: number;
  signal?: AbortSignal;
}): Promise<ManagerIntakeWorkflowState> {
  const definition = input.capability.definition;
  const parseResult = await input.capability.parseInput({
    input: input.answer,
    language: input.language,
    slotValues: cloneSlotValues(input.state.slotValues),
    activeStepId: input.state.activeStepId,
    signal: input.signal,
  });
  const slotValues = mergeSlotValues({
    definition,
    previous: input.state.slotValues,
    next: parseResult.slotValues,
  });

  return buildManagerIntakeState({
    workflowId: input.state.workflowId,
    domainId: input.state.domainId,
    sourceText: input.state.sourceText,
    composerMode: input.state.composerMode,
    drafts: input.state.drafts,
    definition,
    slotValues,
    recognizedSlotIds: [
      ...input.state.recognizedSlotIds,
      ...(parseResult.recognizedSlotIds || []),
    ],
    metadata: parseResult.metadata || input.state.metadata,
    createdAt: input.state.createdAt,
    updatedAt: typeof input.updatedAt === 'number' ? input.updatedAt : Date.now(),
  });
}

export function findManagerIntakeActiveStep(
  definition: RuntimeTaskIntakeDefinition,
  activeStepId: string | null,
): RuntimeTaskIntakeStepDefinition | null {
  if (!activeStepId) {
    return null;
  }

  return definition.steps.find((step) => step.stepId === activeStepId) || null;
}
