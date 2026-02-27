export interface AgentContext {
  matchData?: any;
  segmentPlan?: any;
  animationSchema?: string;
  previousAnalysis?: string;
  analysisText?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  skills?: string[];
  systemPrompt: (context: AgentContext) => string;
}
