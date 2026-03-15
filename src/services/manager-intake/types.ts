import type { RuntimeLocalizedText, RuntimeTaskIntakeValue } from '@/src/domains/runtime/types';
import type { AutomationCommandComposerMode } from '@/src/services/automation/commandCenter';
import type { AutomationDraft } from '@/src/services/automation/types';

export type ManagerIntakeStepStatus = 'pending' | 'active' | 'completed';

export interface ManagerIntakeWorkflowState {
  schemaVersion: 'manager_intake_v1';
  workflowId: string;
  workflowType: string;
  domainId: string;
  sourceText: string;
  composerMode: AutomationCommandComposerMode;
  drafts: AutomationDraft[];
  slotValues: Record<string, RuntimeTaskIntakeValue>;
  recognizedSlotIds: string[];
  missingSlotIds: string[];
  activeStepId: string | null;
  completed: boolean;
  metadata?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface ManagerIntakeStepState {
  stepId: string;
  title: RuntimeLocalizedText;
  description?: RuntimeLocalizedText;
  slotIds: string[];
  status: ManagerIntakeStepStatus;
}

export interface ManagerIntakePromptModel {
  stepId: string | null;
  title: string;
  body: string;
  tone: 'ask' | 'retry' | 'complete';
}
