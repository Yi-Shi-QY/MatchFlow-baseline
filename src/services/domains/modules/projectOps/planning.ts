import type { DomainPlanningStrategy } from '../../planning/types';

const PROJECT_OPS_AGENT_TYPES = [
  'project_ops_overview',
  'project_ops_risk',
  'project_ops_recommendation',
];

function normalizeSelectedSourceIds(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return Array.from(
    new Set(
      input
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter((entry) => entry.length > 0),
    ),
  );
}

function resolveSelectedSourceIds(analysisData: any): string[] {
  const fromIds = normalizeSelectedSourceIds(analysisData?.sourceContext?.selectedSourceIds);
  if (fromIds.length > 0) {
    return fromIds;
  }

  const selectedSources =
    analysisData?.sourceContext?.selectedSources &&
    typeof analysisData.sourceContext.selectedSources === 'object'
      ? analysisData.sourceContext.selectedSources
      : null;
  if (!selectedSources) {
    return ['fundamental', 'market', 'custom'];
  }

  const next = Object.entries(selectedSources)
    .filter(
      ([key, value]) =>
        typeof key === 'string' && key.trim().length > 0 && value === true,
    )
    .map(([key]) => key.trim());

  return next.length > 0 ? next : ['fundamental', 'market', 'custom'];
}

function hasRiskSignals(analysisData: any): boolean {
  const metadata =
    analysisData?.metadata && typeof analysisData.metadata === 'object'
      ? analysisData.metadata
      : {};
  return (
    typeof metadata.riskScore === 'number' ||
    typeof metadata.confidence === 'number' ||
    (Array.isArray(metadata.blockers) && metadata.blockers.length > 0)
  );
}

function buildProjectOpsFallbackPlan(language: 'en' | 'zh') {
  if (language === 'zh') {
    return [
      {
        title: 'Topic Context',
        focus: 'Clarify the objective, owner, stage, and next checkpoint.',
        animationType: 'none',
        agentType: 'project_ops_overview',
        contextMode: 'independent',
        sourceIds: ['fundamental'],
      },
      {
        title: 'Execution Risk',
        focus: 'Identify blockers, dependency pressure, and execution risk.',
        animationType: 'none',
        agentType: 'project_ops_risk',
        contextMode: 'build_upon',
        sourceIds: ['market', 'custom'],
      },
      {
        title: 'Recommended Next Step',
        focus: 'Convert the evidence into owner, action, and timing guidance.',
        animationType: 'none',
        agentType: 'project_ops_recommendation',
        contextMode: 'all',
        sourceIds: ['fundamental', 'market', 'custom'],
      },
    ];
  }

  return [
    {
      title: 'Operating Context',
      focus: 'Clarify the objective, owner, stage, and next checkpoint.',
      animationType: 'none',
      agentType: 'project_ops_overview',
      contextMode: 'independent',
      sourceIds: ['fundamental'],
    },
    {
      title: 'Execution Risk',
      focus: 'Identify blockers, dependency pressure, and execution risk.',
      animationType: 'none',
      agentType: 'project_ops_risk',
      contextMode: 'build_upon',
      sourceIds: ['market', 'custom'],
    },
    {
      title: 'Recommended Next Step',
      focus: 'Convert the evidence into owner, action, and timing guidance.',
      animationType: 'none',
      agentType: 'project_ops_recommendation',
      contextMode: 'all',
      sourceIds: ['fundamental', 'market', 'custom'],
    },
  ];
}

function buildProjectOpsTerminalSegment(language: 'en' | 'zh') {
  return buildProjectOpsFallbackPlan(language)[2];
}

export const projectOpsPlanningStrategy: DomainPlanningStrategy = {
  domainId: 'project_ops',
  getPlannerAgentId: () => 'planner_autonomous',
  resolveRoute: (analysisData: any) => {
    const selectedSourceIds = resolveSelectedSourceIds(analysisData);
    return {
      mode: 'autonomous',
      allowedAgentTypes: [...PROJECT_OPS_AGENT_TYPES],
      allowedAnimationTypes: ['none'],
      allowedSourceIds: selectedSourceIds,
      reason: hasRiskSignals(analysisData)
        ? 'project-ops subject with delivery risk signals'
        : 'project-ops default route',
      requiredAgentIds: ['project_ops_recommendation'],
    };
  },
  buildFallbackPlan: buildProjectOpsFallbackPlan,
  requiredTerminalAgentType: 'project_ops_recommendation',
  buildRequiredTerminalSegment: buildProjectOpsTerminalSegment,
};
