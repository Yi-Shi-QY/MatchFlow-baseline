export interface AgentContext {
  matchData?: any;
  segmentPlan?: any;
  previousAnalysis?: string;
  analysisText?: string;
  narrationText?: string;
  language?: 'en' | 'zh';
  enableAutonomousPlanning?: boolean;
  includeAnimations?: boolean;
  animationSchema?: string;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  skills?: string[];
  contextDependencies?: string[] | 'all' | 'none';
  systemPrompt: (context: AgentContext) => string;
}
