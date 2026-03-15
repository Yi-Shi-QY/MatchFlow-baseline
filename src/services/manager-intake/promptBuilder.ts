import type { RuntimeLocalizedText, RuntimeTaskIntakeCapability } from '@/src/domains/runtime/types';
import { buildManagerIntakeStepStates, findManagerIntakeActiveStep } from './runtime';
import type {
  ManagerIntakePromptModel,
  ManagerIntakeStepState,
  ManagerIntakeWorkflowState,
} from './types';

export function resolveLocalizedText(
  value: RuntimeLocalizedText | string | undefined,
  language: 'zh' | 'en',
): string {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  const preferred = value[language];
  if (typeof preferred === 'string' && preferred.trim().length > 0) {
    return preferred.trim();
  }

  const fallback = language === 'zh' ? value.en : value.zh;
  return typeof fallback === 'string' ? fallback.trim() : '';
}

export function deriveManagerIntakeStepStates(input: {
  capability: RuntimeTaskIntakeCapability;
  state: ManagerIntakeWorkflowState;
}): ManagerIntakeStepState[] {
  return buildManagerIntakeStepStates({
    definition: input.capability.definition,
    missingSlotIds: input.state.missingSlotIds,
    activeStepId: input.state.activeStepId,
  });
}

export function buildManagerIntakePrompt(input: {
  capability: RuntimeTaskIntakeCapability;
  state: ManagerIntakeWorkflowState;
  language: 'zh' | 'en';
  isRetry?: boolean;
}): ManagerIntakePromptModel {
  const prompt = input.capability.buildPrompt({
    language: input.language,
    definition: input.capability.definition,
    activeStepId: input.state.activeStepId,
    slotValues: input.state.slotValues,
    recognizedSlotIds: input.state.recognizedSlotIds,
    missingSlotIds: input.state.missingSlotIds,
    metadata: input.state.metadata,
    isRetry: input.isRetry,
  });
  const activeStep = findManagerIntakeActiveStep(
    input.capability.definition,
    input.state.activeStepId,
  );
  const fallbackTitle = activeStep
    ? resolveLocalizedText(activeStep.title, input.language)
    : resolveLocalizedText(input.capability.definition.title, input.language);

  return {
    stepId: input.state.activeStepId,
    title:
      typeof prompt.title === 'string' && prompt.title.trim().length > 0
        ? prompt.title.trim()
        : fallbackTitle,
    body: prompt.body,
    tone: input.state.completed ? 'complete' : input.isRetry ? 'retry' : 'ask',
  };
}
