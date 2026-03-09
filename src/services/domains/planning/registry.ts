import type { AppSettings } from "@/src/services/settings";
import { DEFAULT_DOMAIN_ID, listBuiltinPlanningStrategies } from "../builtinModules";
import type { DomainPlanningStrategy } from "./types";
import { getInstalledDomainPackManifest } from "../packStore";

function collectBuiltinPlanningStrategiesByDomainId(): Record<string, DomainPlanningStrategy> {
  const strategies = listBuiltinPlanningStrategies().slice().sort((a, b) =>
    a.domainId.localeCompare(b.domainId),
  );
  const byDomainId: Record<string, DomainPlanningStrategy> = {};

  strategies.forEach((strategy) => {
    const domainId = typeof strategy?.domainId === "string" ? strategy.domainId.trim() : "";
    if (!domainId) {
      throw new Error("[planning] Built-in planning strategy has empty domainId.");
    }
    if (byDomainId[domainId]) {
      throw new Error(`[planning] Duplicate built-in planning strategy domainId: ${domainId}.`);
    }
    byDomainId[domainId] = strategy;
  });

  return byDomainId;
}

const DOMAIN_PLANNING_STRATEGIES: Record<string, DomainPlanningStrategy> =
  collectBuiltinPlanningStrategiesByDomainId();

function getDefaultPlanningStrategy(): DomainPlanningStrategy {
  const explicitDefault = DOMAIN_PLANNING_STRATEGIES[DEFAULT_DOMAIN_ID];
  if (explicitDefault) return explicitDefault;

  const fallback = Object.values(DOMAIN_PLANNING_STRATEGIES)[0];
  if (fallback) return fallback;

  throw new Error("No domain planning strategy registered.");
}

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
  return getPlanningStrategyByDomainId(domainId) || getDefaultPlanningStrategy();
}
