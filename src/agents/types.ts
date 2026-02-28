export interface AgentContext {
  matchData?: any;
  segmentPlan?: any;
  previousAnalysis?: string;
  analysisText?: string;
  language?: 'en' | 'zh';
  enableAutonomousPlanning?: boolean;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  skills?: string[];
  contextDependencies?: string[] | 'all' | 'none';
  systemPrompt: (context: AgentContext) => string;
}
