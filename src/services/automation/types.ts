export type AutomationDraftStatus =
  | 'ready'
  | 'needs_clarification'
  | 'rejected';

export type AutomationIntentType = 'one_time' | 'recurring';

export type AutomationDraftActivationMode = 'save_only' | 'run_now';

export type AutomationClarificationField =
  | 'time'
  | 'date'
  | 'target'
  | 'domain'
  | 'intent';

export type AutomationTargetSelectorMode =
  | 'fixed_subject'
  | 'league_query'
  | 'server_resolve';

export type AutomationJobState =
  | 'pending'
  | 'eligible'
  | 'running'
  | 'completed'
  | 'failed_retryable'
  | 'failed_terminal'
  | 'cancelled'
  | 'expired';

export type AutomationRunState =
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AutomationClarificationQuestion {
  id: string;
  field: AutomationClarificationField;
  prompt: string;
  placeholder?: string;
}

export interface AutomationClarificationState {
  roundsUsed: number;
  lastQuestion?: AutomationClarificationQuestion;
}

export interface AutomationNotificationPolicy {
  notifyOnClarification: boolean;
  notifyOnStart: boolean;
  notifyOnComplete: boolean;
  notifyOnFailure: boolean;
}

export type AutomationExecutionTargetExpansion = 'single' | 'all_matches';

export interface AutomationExecutionPolicy {
  targetExpansion: AutomationExecutionTargetExpansion;
  recoveryWindowMinutes: number;
  maxRetries: number;
}

export interface AutomationDomainPin {
  domainId: string;
  domainPackVersion?: string;
  templateId?: string;
}

export interface AutomationOneTimeSchedule {
  type: 'one_time';
  runAt: string;
  timezone: string;
}

export interface AutomationDailySchedule {
  type: 'daily';
  time: string;
  timezone: string;
}

export type AutomationSchedule =
  | AutomationOneTimeSchedule
  | AutomationDailySchedule;

export interface AutomationFixedSubjectSelector {
  mode: 'fixed_subject';
  subjectId: string;
  subjectLabel: string;
}

export interface AutomationLeagueQuerySelector {
  mode: 'league_query';
  leagueKey: string;
  leagueLabel: string;
}

export interface AutomationServerResolveSelector {
  mode: 'server_resolve';
  queryText: string;
  displayLabel: string;
}

export type AutomationTargetSelector =
  | AutomationFixedSubjectSelector
  | AutomationLeagueQuerySelector
  | AutomationServerResolveSelector;

export interface AutomationTargetSnapshotItem {
  domainId: string;
  subjectId: string;
  subjectType: string;
  title: string;
}

export type AutomationTargetSnapshot =
  | AutomationTargetSnapshotItem
  | AutomationTargetSnapshotItem[];

export interface AutomationAnalysisProfile {
  selectedSourceIds: Array<'fundamental' | 'market' | 'custom'>;
  sequencePreference: Array<'fundamental' | 'market' | 'custom' | 'prediction'>;
}

export interface AutomationDraft extends AutomationDomainPin {
  id: string;
  sourceText: string;
  title: string;
  status: AutomationDraftStatus;
  intentType: AutomationIntentType;
  activationMode: AutomationDraftActivationMode;
  schedule?: AutomationSchedule;
  targetSelector?: AutomationTargetSelector;
  executionPolicy: AutomationExecutionPolicy;
  notificationPolicy: AutomationNotificationPolicy;
  analysisProfile?: AutomationAnalysisProfile;
  clarificationState: AutomationClarificationState;
  rejectionReason?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AutomationRule extends AutomationDomainPin {
  id: string;
  title: string;
  enabled: boolean;
  sourceDraftId?: string;
  schedule: AutomationSchedule;
  targetSelector: AutomationTargetSelector;
  executionPolicy: AutomationExecutionPolicy;
  notificationPolicy: AutomationNotificationPolicy;
  analysisProfile?: AutomationAnalysisProfile;
  nextPlannedAt: string | null;
  timezone: string;
  createdAt: number;
  updatedAt: number;
}

export interface AutomationJob extends AutomationDomainPin {
  id: string;
  title: string;
  sourceDraftId?: string;
  sourceRuleId?: string;
  triggerType: 'one_time' | 'schedule' | 'retry' | 'recovery';
  targetSelector: AutomationTargetSelector;
  targetSnapshot?: AutomationTargetSnapshot;
  notificationPolicy: AutomationNotificationPolicy;
  analysisProfile?: AutomationAnalysisProfile;
  scheduledFor: string;
  state: AutomationJobState;
  retryCount: number;
  maxRetries: number;
  retryAfter: string | null;
  recoveryWindowEndsAt: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface AutomationRun extends AutomationDomainPin {
  id: string;
  jobId: string;
  title: string;
  state: AutomationRunState;
  startedAt: number;
  endedAt?: number;
  provider?: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  tokenSource?: string;
  resultHistoryId?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AutomationParserOptions {
  defaultDomainId: string;
  now?: Date;
}

export interface AutomationDraftQueryOptions {
  statuses?: AutomationDraftStatus[];
}

export interface AutomationRuleQueryOptions {
  enabled?: boolean;
}

export interface AutomationJobQueryOptions {
  states?: AutomationJobState[];
}

export interface AutomationRunQueryOptions {
  states?: AutomationRunState[];
  limit?: number;
}
