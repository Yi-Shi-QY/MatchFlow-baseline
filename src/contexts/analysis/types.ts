import type { Match } from '@/src/data/matches';
import type { MatchAnalysis } from '@/src/services/ai';
import type { AgentResult } from '@/src/services/agentParser';
import type { PlannerRuntimeState } from '@/src/services/planner/runtime';

export interface ActiveAnalysis {
  matchId: string;
  domainId: string;
  subjectId: string;
  match: Match;
  dataToAnalyze: any;
  plan: any[];
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
