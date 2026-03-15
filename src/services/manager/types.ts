import type { AutomationDraft } from '@/src/services/automation/types';
import type {
  AutomationCommandComposerMode,
  ImmediateAnalysisNavigationTarget,
} from '@/src/services/automation/commandCenter';
import type { MemoryCandidateInput } from '@/src/services/memoryCandidateTypes';
import type { ManagerIntakeWorkflowState } from '@/src/services/manager-intake/types';

export type ManagerLanguage = 'zh' | 'en';
export type ManagerSourcePreferenceId = 'fundamental' | 'market' | 'custom';
export type ManagerSequenceStepId = ManagerSourcePreferenceId | 'prediction';
export type ManagerClarificationField = 'factors' | 'sequence';

export interface ManagerClarificationSnapshot {
  recognizedSourceIds: ManagerSourcePreferenceId[];
  recognizedSequence: ManagerSequenceStepId[] | null;
  missingFields: ManagerClarificationField[];
}

export interface ManagerPendingTask {
  id: string;
  sourceText: string;
  composerMode: AutomationCommandComposerMode;
  drafts: AutomationDraft[];
  stage: 'await_factors' | 'await_sequence';
  selectedSourceIds?: ManagerSourcePreferenceId[];
  sequencePreference?: ManagerSequenceStepId[];
  clarificationSummary?: ManagerClarificationSnapshot;
  createdAt: number;
}

export interface ManagerConversationMessage {
  id: string;
  role: 'user' | 'agent';
  kind: 'text' | 'draft_bundle';
  text: string;
  createdAt: number;
  draftIds?: string[];
  action?: ManagerConversationAction;
}

export interface ManagerConversationAction {
  type: 'open_settings';
  label: string;
}

export interface ManagerSessionSnapshot {
  messages: ManagerConversationMessage[];
  pendingTask: ManagerPendingTask | null;
  intakeWorkflow?: ManagerIntakeWorkflowState | null;
}

export interface ManagerConversationEffect {
  userText?: string;
  agentText: string;
  messageKind: ManagerConversationMessage['kind'];
  draftIds?: string[];
  action?: ManagerConversationAction;
  draftsToSave?: AutomationDraft[];
  pendingTask?: ManagerPendingTask | null;
  shouldRefreshTaskState?: boolean;
  feedbackMessage?: string;
  navigation?: ImmediateAnalysisNavigationTarget;
  memoryCandidates?: MemoryCandidateInput[];
  intakeWorkflow?: ManagerIntakeWorkflowState | null;
}

export interface ManagerSessionResult extends ManagerSessionSnapshot {
  feedbackMessage?: string;
  shouldRefreshTaskState: boolean;
  navigation?: ImmediateAnalysisNavigationTarget;
}
