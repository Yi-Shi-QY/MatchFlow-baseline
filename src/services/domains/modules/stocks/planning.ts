import type { DomainPlanningStrategy } from "../../planning/types";

function hasNonEmptyObject(value: any): boolean {
  return !!value && typeof value === "object" && Object.keys(value).length > 0;
}

function hasNonEmptyArray(value: any): boolean {
  return Array.isArray(value) && value.length > 0;
}

function hasText(value: any): boolean {
  return typeof value === "string" ? value.trim().length > 0 : false;
}

function deriveSourceSignals(analysisData: any) {
  const selected = analysisData?.sourceContext?.selectedSources;
  const selectedIds = Array.isArray(analysisData?.sourceContext?.selectedSourceIds)
    ? new Set(
        analysisData.sourceContext.selectedSourceIds.filter((id: any) => typeof id === "string"),
      )
    : null;
  const capabilities = analysisData?.sourceContext?.capabilities || {};

  const wantsAssetProfile =
    typeof selected?.asset_profile === "boolean"
      ? !!selected.asset_profile
      : typeof selected?.fundamental === "boolean"
        ? !!selected.fundamental
        : selectedIds?.has("asset_profile") ??
          selectedIds?.has("fundamental") ??
          selectedIds?.has("context") ??
          capabilities.hasAssetProfile ??
          true;

  const wantsPriceAction =
    typeof selected?.price_action === "boolean"
      ? !!selected.price_action
      : typeof selected?.stats === "boolean"
        ? !!selected.stats
        : selectedIds?.has("price_action") ??
          selectedIds?.has("stats") ??
          capabilities.hasPriceAction ??
          capabilities.hasStats ??
          hasNonEmptyObject(analysisData?.priceAction);

  const wantsValuationHealth =
    typeof selected?.valuation_health === "boolean"
      ? !!selected.valuation_health
      : typeof selected?.market === "boolean"
        ? !!selected.market
        : selectedIds?.has("valuation_health") ??
          selectedIds?.has("market") ??
          capabilities.hasValuationHealth ??
          hasNonEmptyObject(analysisData?.valuationHealth);

  const riskFallback =
    hasNonEmptyObject(analysisData?.riskEvents) ||
    hasNonEmptyArray(analysisData?.riskEvents?.catalysts) ||
    hasNonEmptyArray(analysisData?.riskEvents?.downsideTriggers) ||
    hasText(analysisData?.riskEvents?.narrative) ||
    hasText(analysisData?.customInfo);

  const wantsRiskEvents =
    typeof selected?.risk_events === "boolean"
      ? !!selected.risk_events
      : typeof selected?.custom === "boolean"
        ? !!selected.custom
        : selectedIds?.has("risk_events") ??
          selectedIds?.has("custom") ??
          capabilities.hasRiskEvents ??
          capabilities.hasCustom ??
          riskFallback;

  const hasPriceAction =
    typeof capabilities.hasPriceAction === "boolean"
      ? capabilities.hasPriceAction
      : typeof capabilities.hasStats === "boolean"
        ? capabilities.hasStats
        : hasNonEmptyObject(analysisData?.priceAction);

  const hasValuationHealth =
    typeof capabilities.hasValuationHealth === "boolean"
      ? capabilities.hasValuationHealth
      : hasNonEmptyObject(analysisData?.valuationHealth);

  const hasRiskEvents =
    typeof capabilities.hasRiskEvents === "boolean"
      ? capabilities.hasRiskEvents
      : riskFallback;

  return {
    wantsAssetProfile,
    wantsPriceAction,
    wantsValuationHealth,
    wantsRiskEvents,
    hasPriceAction,
    hasValuationHealth,
    hasRiskEvents,
  };
}

function buildStocksFallbackPlan(_language: "en" | "zh") {
  return [
    {
      title: "Asset Context",
      focus: "Market backdrop and dominant narrative",
      animationType: "none",
      agentType: "stocks_overview",
      contextMode: "independent",
    },
    {
      title: "Final Outlook",
      focus: "Scenario probabilities with execution boundaries",
      animationType: "none",
      agentType: "stocks_prediction",
      contextMode: "all",
    },
  ];
}

function buildStocksTerminalSegment(_language: "en" | "zh") {
  return {
    title: "Final Outlook",
    focus: "Provide final scenario outlook with key risks",
    animationType: "none",
    agentType: "stocks_prediction",
    contextMode: "all",
  };
}

export const stocksPlanningStrategy: DomainPlanningStrategy = {
  domainId: "stocks",
  resolveRoute: (analysisData: any) => {
    const signals = deriveSourceSignals(analysisData);

    if (
      signals.wantsRiskEvents &&
      !signals.wantsAssetProfile &&
      !signals.wantsPriceAction &&
      !signals.wantsValuationHealth
    ) {
      return {
        mode: "autonomous",
        allowedAgentTypes: null,
        reason: "risk-events-only input",
      };
    }

    if (signals.hasRiskEvents && !signals.hasPriceAction && !signals.hasValuationHealth) {
      return {
        mode: "template",
        templateType: "stocks_risk_focused",
        allowedAgentTypes: [
          "stocks_overview",
          "stocks_risk",
          "stocks_prediction",
          "stocks_general",
        ],
        reason: "event-risk dominant input",
      };
    }

    if (signals.hasPriceAction && signals.hasValuationHealth && signals.hasRiskEvents) {
      return {
        mode: "template",
        templateType: "stocks_comprehensive",
        allowedAgentTypes: null,
        reason: "technical+valuation+risk",
      };
    }

    if (signals.hasPriceAction && signals.hasValuationHealth) {
      return {
        mode: "template",
        templateType: "stocks_standard",
        allowedAgentTypes: null,
        reason: "technical+valuation",
      };
    }

    if (signals.hasRiskEvents) {
      return {
        mode: "template",
        templateType: "stocks_risk_focused",
        allowedAgentTypes: [
          "stocks_overview",
          "stocks_risk",
          "stocks_prediction",
          "stocks_general",
        ],
        reason: "risk-aware lightweight input",
      };
    }

    if (signals.hasPriceAction) {
      return {
        mode: "template",
        templateType: "stocks_standard",
        allowedAgentTypes: [
          "stocks_overview",
          "stocks_technical",
          "stocks_prediction",
          "stocks_general",
        ],
        reason: "technical-only dominant input",
      };
    }

    return {
      mode: "template",
      templateType: "stocks_basic",
      allowedAgentTypes: ["stocks_overview", "stocks_prediction", "stocks_general"],
      reason: "minimal stock input",
    };
  },
  buildFallbackPlan: buildStocksFallbackPlan,
  requiredTerminalAgentType: "stocks_prediction",
  buildRequiredTerminalSegment: buildStocksTerminalSegment,
};