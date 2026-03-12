import type { AutomationDraft } from '@/src/services/automation/types';
import type {
  AutomationCommandComposerMode,
  ImmediateAnalysisNavigationTarget,
} from '@/src/services/automation/commandCenter';

export type ManagerLanguage = 'zh' | 'en';
export type ManagerSourcePreferenceId = 'fundamental' | 'market' | 'custom';
export type ManagerSequenceStepId = ManagerSourcePreferenceId | 'prediction';

export interface ManagerPendingTask {
  id: string;
  sourceText: string;
  composerMode: AutomationCommandComposerMode;
  drafts: AutomationDraft[];
  stage: 'await_factors' | 'await_sequence';
  selectedSourceIds?: ManagerSourcePreferenceId[];
  sequencePreference?: ManagerSequenceStepId[];
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
}

export interface ManagerSessionResult extends ManagerSessionSnapshot {
  feedbackMessage?: string;
  shouldRefreshTaskState: boolean;
  navigation?: ImmediateAnalysisNavigationTarget;
}
