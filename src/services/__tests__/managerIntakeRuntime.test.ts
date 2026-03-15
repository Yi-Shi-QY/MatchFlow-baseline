import { describe, expect, it } from 'vitest';
import { footballTaskIntakeCapability } from '@/src/domains/runtime/football/taskIntake';
import { projectOpsTaskIntakeCapability } from '@/src/domains/runtime/projectOps/taskIntake';
import type { AutomationDraft } from '@/src/services/automation/types';
import { buildManagerIntakePrompt } from '@/src/services/manager-intake/promptBuilder';
import {
  applyManagerIntakeAnswer,
  buildManagerIntakeStepStates,
  createManagerIntakeWorkflowState,
} from '@/src/services/manager-intake/runtime';

function createDraft(domainId: string, sourceText: string): AutomationDraft {
  return {
    id: `${domainId}_draft_1`,
    domainId,
    sourceText,
    title: sourceText,
    status: 'ready',
    intentType: 'one_time',
    activationMode: 'run_now',
    executionPolicy: {
      targetExpansion: 'single',
      recoveryWindowMinutes: 30,
      maxRetries: 1,
    },
    notificationPolicy: {
      notifyOnClarification: true,
      notifyOnStart: true,
      notifyOnComplete: true,
      notifyOnFailure: true,
    },
    clarificationState: {
      roundsUsed: 0,
    },
    createdAt: 100,
    updatedAt: 100,
  };
}

describe('manager generic intake runtime', () => {
  it('creates and advances the football intake workflow through domain-owned semantics', async () => {
    const initialState = await createManagerIntakeWorkflowState({
      capability: footballTaskIntakeCapability,
      domainId: 'football',
      sourceText: 'Tonight at 20:00 analyze Real Madrid vs Barcelona',
      composerMode: 'smart',
      drafts: [createDraft('football', 'Analyze Real Madrid vs Barcelona')],
      language: 'en',
      workflowId: 'football_intake_1',
      createdAt: 100,
      updatedAt: 100,
    });

    expect(initialState.activeStepId).toBe('analysis_dimensions');
    expect(initialState.missingSlotIds).toEqual([
      'analysis_dimensions',
      'analysis_sequence',
    ]);

    const firstPrompt = buildManagerIntakePrompt({
      capability: footballTaskIntakeCapability,
      state: initialState,
      language: 'en',
    });
    expect(firstPrompt.body).toContain('which factors to prioritize');

    const nextState = await applyManagerIntakeAnswer({
      capability: footballTaskIntakeCapability,
      state: initialState,
      answer: 'fundamentals and market',
      language: 'en',
      updatedAt: 200,
    });

    expect(nextState.slotValues.analysis_dimensions).toEqual([
      'fundamental',
      'market',
    ]);
    expect(nextState.activeStepId).toBe('analysis_sequence');
    expect(nextState.missingSlotIds).toEqual(['analysis_sequence']);

    const secondPrompt = buildManagerIntakePrompt({
      capability: footballTaskIntakeCapability,
      state: nextState,
      language: 'en',
    });
    expect(secondPrompt.body).toContain('analysis order');
    expect(
      buildManagerIntakeStepStates({
        definition: footballTaskIntakeCapability.definition,
        missingSlotIds: nextState.missingSlotIds,
        activeStepId: nextState.activeStepId,
      }).map((step) => step.status),
    ).toEqual(['completed', 'active']);
  });

  it('supports a structurally different project ops intake without football wording', async () => {
    const state = await createManagerIntakeWorkflowState({
      capability: projectOpsTaskIntakeCapability,
      domainId: 'project_ops',
      sourceText: 'Analyze Q2 Mobile Launch now',
      composerMode: 'smart',
      drafts: [createDraft('project_ops', 'Analyze Q2 Mobile Launch')],
      language: 'en',
      workflowId: 'project_ops_intake_1',
      createdAt: 100,
      updatedAt: 100,
    });

    expect(state.slotValues.target_subject).toMatchObject({
      subjectId: 'project_mobile_launch',
      label: 'Q2 Mobile Launch',
    });
    expect(state.activeStepId).toBe('focus_dimensions');

    const prompt = buildManagerIntakePrompt({
      capability: projectOpsTaskIntakeCapability,
      state,
      language: 'en',
    });
    expect(prompt.title).toBe('Choose focus areas');
    expect(prompt.body).toContain('delivery and milestones');
    expect(prompt.body).not.toContain('odds and market');
  });
});
