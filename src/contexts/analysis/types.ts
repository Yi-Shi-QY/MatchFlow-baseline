import type { Match } from '@/src/data/matches';
import type { MatchAnalysis } from '@/src/services/ai';
import type {
  AnalysisRequestPayload,
  NormalizedPlanSegment,
} from '@/src/services/ai/contracts';
import type { AgentResult } from '@/src/services/agentParser';
import type { PlannerRuntimeState } from '@/src/services/planner/runtime';

export type AnalysisRunTokenSource = 'none' | 'provider' | 'estimated' | 'mixed';

export interface AnalysisRunMetrics {
  runId: string;
  startedAt: number;
  endedAt?: number;
  elapsedMs: number;
  currentProvider: string;
  currentModel: string;
  modelsUsed: string[];
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  tokenSource: AnalysisRunTokenSource;
  toolCallTotal: number;
  toolCallSuccess: number;
  toolCallFailed: number;
  updatedAt: number;
}

export interface AnalysisSubjectRef {
  domainId: string;
  subjectId: string;
  subjectType: string;
}

export function buildAnalysisSubjectKey(
  subjectRef: Pick<AnalysisSubjectRef, 'domainId' | 'subjectId'>,
): string {
  return `${subjectRef.domainId}::${subjectRef.subjectId}`;
}

export interface ActiveAnalysis {
  subjectRef: AnalysisSubjectRef;
  domainId: string;
  subjectId: string;
  subjectType: string;
  subjectSnapshot?: unknown;
  subjectDisplay?: Match;
  match: Match;
  dataToAnalyze: AnalysisRequestPayload;
  plan: NormalizedPlanSegment[];
  includeAnimations: boolean;
  thoughts: string;
  parsedStream: AgentResult | null;
  collapsedSegments: Record<string, boolean>;
  isAnalyzing: boolean;
  analysis: MatchAnalysis | null;
  error: string | null;
  planTotalSegments: number;
  planCompletedSegments: number;
  runtimeStatus: PlannerRuntimeState | null;
  runMetrics: AnalysisRunMetrics | null;
}
