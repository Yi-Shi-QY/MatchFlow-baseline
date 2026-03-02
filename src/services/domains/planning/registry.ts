import type { AppSettings } from "@/src/services/settings";
import { footballPlanningStrategy } from "./football";
import type { DomainPlanningStrategy } from "./types";
import { getInstalledDomainPackManifest } from "../packStore";

const DOMAIN_PLANNING_STRATEGIES: Record<string, DomainPlanningStrategy> = {
  [footballPlanningStrategy.domainId]: footballPlanningStrategy,
};

const DEFAULT_DOMAIN_ID = footballPlanningStrategy.domainId;

export function listPlanningStrategies(): DomainPlanningStrategy[] {
  return Object.values(DOMAIN_PLANNING_STRATEGIES);
}

export function getPlanningStrategyByDomainId(
  domainId: string | null | undefined,
): DomainPlanningStrategy | null {
  if (!domainId) return null;

  const direct = DOMAIN_PLANNING_STRATEGIES[domainId];
  if (direct) return direct;

  const pack = getInstalledDomainPackManifest(domainId);
  if (!pack?.baseDomainId) return null;

  return DOMAIN_PLANNING_STRATEGIES[pack.baseDomainId] || null;
}

export function resolvePlanningDomainId(
  analysisData: any,
  settings: Pick<AppSettings, "activeDomainId">,
): string {
  const explicitDomainId =
    typeof analysisData?.sourceContext?.domainId === "string" &&
    analysisData.sourceContext.domainId.trim().length > 0
      ? analysisData.sourceContext.domainId.trim()
      : null;
  if (explicitDomainId) {
    return explicitDomainId;
  }

  const configuredDomainId =
    typeof settings.activeDomainId === "string" && settings.activeDomainId.trim().length > 0
      ? settings.activeDomainId.trim()
      : null;
  if (configuredDomainId) {
    return configuredDomainId;
  }

  return DEFAULT_DOMAIN_ID;
}

export function getPlanningStrategyForAnalysis(
  analysisData: any,
  settings: Pick<AppSettings, "activeDomainId">,
): DomainPlanningStrategy {
  const domainId = resolvePlanningDomainId(analysisData, settings);
  return getPlanningStrategyByDomainId(domainId) || footballPlanningStrategy;
}
