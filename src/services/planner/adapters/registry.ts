import { getInstalledDomainPackManifest } from "@/src/services/domains/packStore";
import type { DomainPlannerAdapter, PlannerGraph, PlannerRuntimeState } from "../runtime";
import { defaultPlannerAdapter } from "./default";
import type { PlannerLanguage } from "./utils";

type DomainPlannerAdapterModule = {
  DOMAIN_PLANNER_ADAPTER_ENTRIES?: DomainPlannerAdapter[];
};

function collectBuiltinDomainPlannerAdapters(): Record<string, DomainPlannerAdapter> {
  const modules = import.meta.glob(["./*.ts", "!./registry.ts", "!./index.ts"], {
    eager: true,
  }) as Record<string, DomainPlannerAdapterModule>;

  const entries = Object.entries(modules)
    .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
    .flatMap(([modulePath, module]) => {
      const adapterEntries = Array.isArray(module.DOMAIN_PLANNER_ADAPTER_ENTRIES)
        ? module.DOMAIN_PLANNER_ADAPTER_ENTRIES
        : [];
      return adapterEntries.map((adapter) => ({ adapter, modulePath }));
    });

  const byDomainId: Record<string, DomainPlannerAdapter> = {};
  const sourceByDomainId: Record<string, string> = {};
  entries.forEach(({ adapter, modulePath }) => {
    if (!adapter || typeof adapter.domainId !== "string" || adapter.domainId.trim().length === 0) {
      return;
    }
    if (typeof adapter.buildGraph !== "function") {
      return;
    }

    const domainId = adapter.domainId.trim();
    if (domainId === "default") {
      return;
    }
    if (byDomainId[domainId]) {
      throw new Error(
        `[planner] Duplicate domain planner adapter id "${domainId}" in ${modulePath}. ` +
          `Already registered in ${sourceByDomainId[domainId]}.`,
      );
    }
    byDomainId[domainId] = adapter;
    sourceByDomainId[domainId] = modulePath;
  });

  return byDomainId;
}

export const BUILTIN_DOMAIN_PLANNER_ADAPTERS: Record<string, DomainPlannerAdapter> =
  collectBuiltinDomainPlannerAdapters();

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
