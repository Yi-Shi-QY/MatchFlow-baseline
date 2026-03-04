import { getInstalledDomainPackManifest } from "@/src/services/domains/packStore";
import type { DomainPlannerAdapter, PlannerGraph, PlannerRuntimeState } from "../runtime";
import { defaultPlannerAdapter } from "./default";
import { footballPlannerAdapter } from "./football";
import type { PlannerLanguage } from "./utils";

export const BUILTIN_DOMAIN_PLANNER_ADAPTERS: Record<string, DomainPlannerAdapter> = {
  football: footballPlannerAdapter,
};

function normalizeDomainId(domainId: string | null | undefined): string | null {
  if (typeof domainId !== "string") return null;
  const normalized = domainId.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveBaseDomainIdFromPack(domainId: string | null): string | null {
  if (!domainId) return null;
  const manifest = getInstalledDomainPackManifest(domainId);
  return normalizeDomainId(manifest?.baseDomainId);
}

export function getPlannerAdapter(domainId?: string | null): DomainPlannerAdapter {
  const normalizedDomainId = normalizeDomainId(domainId);
  if (normalizedDomainId && BUILTIN_DOMAIN_PLANNER_ADAPTERS[normalizedDomainId]) {
    return BUILTIN_DOMAIN_PLANNER_ADAPTERS[normalizedDomainId];
  }

  const baseDomainId = resolveBaseDomainIdFromPack(normalizedDomainId);
  if (baseDomainId && BUILTIN_DOMAIN_PLANNER_ADAPTERS[baseDomainId]) {
    return BUILTIN_DOMAIN_PLANNER_ADAPTERS[baseDomainId];
  }

  return defaultPlannerAdapter;
}

export function buildPlannerGraphForDomain(
  domainId: string | null | undefined,
  plan: unknown[],
  language: PlannerLanguage,
): PlannerGraph {
  const adapter = getPlannerAdapter(domainId);
  const safePlan = Array.isArray(plan) ? plan : [];
  return adapter.buildGraph(safePlan, { language });
}

export function mapPlannerRuntimeForDomain(
  domainId: string | null | undefined,
  runtimeState: PlannerRuntimeState,
): PlannerRuntimeState {
  const adapter = getPlannerAdapter(domainId);
  if (typeof adapter.mapRuntimeState !== "function") {
    return runtimeState;
  }

  try {
    return adapter.mapRuntimeState(runtimeState);
  } catch (error) {
    console.warn("Planner runtime adapter mapping failed", {
      domainId,
      adapter: adapter.domainId,
      error,
    });
    return runtimeState;
  }
}
