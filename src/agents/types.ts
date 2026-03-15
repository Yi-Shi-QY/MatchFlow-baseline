export interface AgentContext {
  matchData?: any;
  segmentPlan?: any;
  previousAnalysis?: string;
  analysisText?: string;
  userInput?: string;
  narrationText?: string;
  language?: 'en' | 'zh';
  enableAutonomousPlanning?: boolean;
  includeAnimations?: boolean;
  animationSchema?: string;
  planningMode?: 'template' | 'autonomous';
  planningReason?: string;
  allowedAgentTypes?: string[] | null;
  allowedAnimationTypes?: string[] | null;
  allowedSourceIds?: string[];
  requiredAgentIds?: string[];
  domainId?: string;
  domainName?: string;
  managerPendingTask?: {
    sourceText: string;
    stage: 'await_factors' | 'await_sequence';
    selectedSourceIds?: string[];
    sequencePreference?: string[];
  } | null;
  managerTaskIntake?: {
    workflowType: string;
    sourceText: string;
    activeStepId: string | null;
    activeStepTitle?: string | null;
    recognizedSlotIds: string[];
    missingSlotIds: string[];
    completed: boolean;
  } | null;
  planningAgentCatalog?: PlanningAgentCapability[];
  planningAnimationCatalog?: PlanningAnimationCapability[];
  planningSourceCatalog?: PlanningSourceCapability[];
  conversationHistory?: Array<{
    role: 'user' | 'agent';
    text: string;
  }>;
  managerContextFragments?: Array<{
    category: string;
    text: string;
  }>;
}

export interface PlanningAgentCapability {
  id: string;
  name?: string;
  description?: string;
  contextDependencies?: string[] | "all" | "none";
}

export interface PlanningAnimationCapability {
  type: string;
  templateId?: string;
  note?: string;
}

export interface PlanningSourceCapability {
  id: string;
  labelKey?: string;
  descriptionKey?: string;
  selected?: boolean;
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  skills?: string[];
  contextDependencies?: string[] | 'all' | 'none';
  systemPrompt: (context: AgentContext) => string;
}
