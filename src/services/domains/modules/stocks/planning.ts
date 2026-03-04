import type { DomainPlanningStrategy } from '../../planning/types';

export type StocksTemplateType =
  | 'stocks_basic'
  | 'stocks_standard'
  | 'stocks_risk_focused'
  | 'stocks_comprehensive';

function hasNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function pickSignal(
  analysisData: any,
  capabilityKey: string,
  sourceKey: string,
  fallback: boolean,
): boolean {
  const capabilities = analysisData?.sourceContext?.capabilities || {};
  if (typeof capabilities?.[capabilityKey] === 'boolean') {
    return capabilities[capabilityKey];
  }

  const selectedSources = analysisData?.sourceContext?.selectedSources || {};
  if (typeof selectedSources?.[sourceKey] === 'boolean') {
    return selectedSources[sourceKey];
  }

  const selectedSourceIds = Array.isArray(analysisData?.sourceContext?.selectedSourceIds)
    ? new Set(
        analysisData.sourceContext.selectedSourceIds.filter(
          (item: unknown) => typeof item === 'string',
        ),
      )
    : null;

  if (selectedSourceIds) {
    return selectedSourceIds.has(sourceKey);
  }

  return fallback;
}

function deriveSourceSignals(analysisData: any) {
  const hasAssetProfile = pickSignal(
    analysisData,
    'hasAssetProfile',
    'asset_profile',
    hasNonEmptyObject(analysisData?.assetProfile),
  );
  const hasPriceAction = pickSignal(
    analysisData,
    'hasPriceAction',
    'price_action',
    hasNonEmptyObject(analysisData?.priceAction),
  );
  const hasValuationHealth = pickSignal(
    analysisData,
    'hasValuationHealth',
    'valuation_health',
    hasNonEmptyObject(analysisData?.valuationHealth),
  );
  const hasRiskEvents = pickSignal(
    analysisData,
    'hasRiskEvents',
    'risk_events',
    hasNonEmptyObject(analysisData?.riskEvents),
  );
  const hasCustomNarrative = hasNonEmptyString(analysisData?.customInfo);

  return {
    hasAssetProfile,
    hasPriceAction,
    hasValuationHealth,
    hasRiskEvents,
    hasCustomNarrative,
  };
}

function buildStocksFallbackPlan(language: 'en' | 'zh') {
  if (language === 'zh') {
    return [
      {
        title: '标的概览',
        focus: '确认核心背景与关键驱动',
        animationType: 'none',
        agentType: 'stocks_overview',
        contextMode: 'independent',
      },
      {
        title: '结论与建议',
        focus: '给出最终判断和执行建议',
        animationType: 'none',
        agentType: 'stocks_prediction',
        contextMode: 'all',
      },
    ];
  }

  return [
    {
      title: 'Asset Overview',
      focus: 'Confirm setup and major drivers',
      animationType: 'none',
      agentType: 'stocks_overview',
      contextMode: 'independent',
    },
    {
      title: 'Final Recommendation',
      focus: 'Provide final stance and execution plan',
      animationType: 'none',
      agentType: 'stocks_prediction',
      contextMode: 'all',
    },
  ];
}

function buildStocksTerminalSegment(language: 'en' | 'zh') {
  if (language === 'zh') {
    return {
      title: '结论与建议',
      focus: '给出最终判断和执行建议',
      animationType: 'none',
      agentType: 'stocks_prediction',
      contextMode: 'all',
    };
  }

  return {
    title: 'Final Recommendation',
    focus: 'Provide final stance and execution plan',
    animationType: 'none',
    agentType: 'stocks_prediction',
    contextMode: 'all',
  };
}

export const stocksPlanningStrategy: DomainPlanningStrategy = {
  domainId: 'stocks',
  getPlannerAgentId: (mode) =>
    mode === 'autonomous' ? 'stocks_planner_autonomous' : 'stocks_planner_template',
  resolveRoute: (analysisData: any) => {
    const signals = deriveSourceSignals(analysisData);

    if (
      signals.hasCustomNarrative &&
      !signals.hasAssetProfile &&
      !signals.hasPriceAction &&
      !signals.hasValuationHealth &&
      !signals.hasRiskEvents
    ) {
      return {
        mode: 'autonomous',
        allowedAgentTypes: null,
        reason: 'custom-only narrative',
      };
    }

    if (
      signals.hasAssetProfile &&
      signals.hasPriceAction &&
      signals.hasValuationHealth &&
      signals.hasRiskEvents
    ) {
      return {
        mode: 'template',
        templateType: 'stocks_comprehensive',
        allowedAgentTypes: null,
        reason: 'full signal coverage',
      };
    }

    if (signals.hasRiskEvents && !signals.hasPriceAction && !signals.hasValuationHealth) {
      return {
        mode: 'template',
        templateType: 'stocks_risk_focused',
        allowedAgentTypes: [
          'stocks_overview',
          'stocks_risk',
          'stocks_prediction',
          'stocks_general',
        ],
        reason: 'risk-dominant signal set',
      };
    }

    if (signals.hasPriceAction || signals.hasValuationHealth) {
      return {
        mode: 'template',
        templateType: 'stocks_standard',
        allowedAgentTypes: null,
        reason: 'price or valuation signals available',
      };
    }

    return {
      mode: 'template',
      templateType: 'stocks_basic',
      allowedAgentTypes: ['stocks_overview', 'stocks_prediction', 'stocks_general'],
      reason: 'minimal available signals',
    };
  },
  buildFallbackPlan: buildStocksFallbackPlan,
  requiredTerminalAgentType: 'stocks_prediction',
  buildRequiredTerminalSegment: buildStocksTerminalSegment,
};
