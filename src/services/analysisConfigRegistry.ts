import { getSettings } from './settings';

export interface SubjectAnalysisConfigPayload {
  subjectId?: string;
  sourceContext?: {
    domainId?: string;
    selectedSources?: Record<string, boolean>;
    selectedSourceIds?: string[];
    capabilities?: Record<string, any>;
    matchStatus?: string;
    planning?: Record<string, any>;
  };
}

export interface AnalysisConfigSubjectRef {
  subjectId: string;
  domainId?: string;
  subjectType?: string;
}

export interface DomainAnalysisConfigAdapter {
  domainId: string;
  supportsSubject(subjectRef: AnalysisConfigSubjectRef): boolean;
  fetchSubjectConfig(
    subjectRef: AnalysisConfigSubjectRef,
  ): Promise<SubjectAnalysisConfigPayload | null>;
  resolveSubjectConfig(subjectSnapshot: any): Promise<SubjectAnalysisConfigPayload | null>;
  mergePlanning(
    subjectPayload: any,
    config: SubjectAnalysisConfigPayload | null,
  ): any;
}

type DomainAnalysisConfigAdapterModule = {
  DOMAIN_ANALYSIS_CONFIG_ADAPTERS?: DomainAnalysisConfigAdapter[];
};

function collectDomainAnalysisConfigAdapters(): Record<string, DomainAnalysisConfigAdapter> {
  const modules = import.meta.glob('./analysisConfigAdapters/*.ts', { eager: true }) as Record<
    string,
    DomainAnalysisConfigAdapterModule
  >;
  const adapterMap: Record<string, DomainAnalysisConfigAdapter> = {};

  Object.entries(modules)
    .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
    .forEach(([modulePath, module]) => {
      const adapters = Array.isArray(module.DOMAIN_ANALYSIS_CONFIG_ADAPTERS)
        ? module.DOMAIN_ANALYSIS_CONFIG_ADAPTERS
        : [];
      adapters.forEach((adapter) => {
        if (!adapter?.domainId) {
          return;
        }
        if (adapterMap[adapter.domainId]) {
          throw new Error(
            `[analysis-config] Duplicate config adapter for domain "${adapter.domainId}" in ${modulePath}.`,
          );
        }
        adapterMap[adapter.domainId] = adapter;
      });
    });

  return adapterMap;
}

export const DOMAIN_ANALYSIS_CONFIG_ADAPTERS = collectDomainAnalysisConfigAdapters();

function normalizeDomainId(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }

  const normalized = input.trim();
  return normalized.length > 0 ? normalized : null;
}

export function resolveAnalysisConfigDomainId(subjectRef?: {
  domainId?: string;
} | null): string | null {
  return normalizeDomainId(subjectRef?.domainId) || normalizeDomainId(getSettings().activeDomainId);
}

export function getAnalysisConfigAdapterByDomainId(
  domainId: string | null | undefined,
): DomainAnalysisConfigAdapter | null {
  const normalizedDomainId = normalizeDomainId(domainId);
  if (!normalizedDomainId) {
    return null;
  }

  return DOMAIN_ANALYSIS_CONFIG_ADAPTERS[normalizedDomainId] || null;
}

export function getAnalysisConfigAdapterForSubject(
  subjectRef: AnalysisConfigSubjectRef,
): DomainAnalysisConfigAdapter | null {
  const adapter = getAnalysisConfigAdapterByDomainId(resolveAnalysisConfigDomainId(subjectRef));
  if (!adapter || !adapter.supportsSubject(subjectRef)) {
    return null;
  }

  return adapter;
}

export function getAnalysisConfigAdapterForSnapshot(
  subjectSnapshot: any,
): DomainAnalysisConfigAdapter | null {
  return getAnalysisConfigAdapterByDomainId(
    subjectSnapshot?.sourceContext?.domainId ||
      subjectSnapshot?.analysisConfig?.domainId ||
      subjectSnapshot?.domainId,
  );
}
