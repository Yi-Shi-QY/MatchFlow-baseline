import type { Match } from '@/src/data/matches';
import type { MatchAnalysis } from '@/src/services/ai';
import type {
  AnalysisRequestPayload,
  NormalizedPlanSegment,
} from '@/src/services/ai/contracts';
import type { AgentResult } from '@/src/services/agentParser';
import type { PlannerRuntimeState } from '@/src/services/planner/runtime';

export interface ActiveAnalysis {
  matchId: string;
  domainId: string;
  subjectId: string;
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
}
