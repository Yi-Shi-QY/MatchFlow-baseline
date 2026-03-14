import type {
  AnalysisConfigSubjectRef,
  DomainAnalysisConfigAdapter,
  SubjectAnalysisConfigPayload,
} from '@/src/services/analysisConfigRegistry';
import {
  PROJECT_OPS_DOMAIN_ID,
  PROJECT_OPS_SUBJECT_TYPES,
} from '@/src/services/domains/modules/projectOps/localCases';

function isRecordObject(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === 'object' && !Array.isArray(input);
}

function normalizeDomainId(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  const normalized = input.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeProjectOpsConfig(subjectSnapshot: any): SubjectAnalysisConfigPayload | null {
  if (!isRecordObject(subjectSnapshot)) {
    return null;
  }

  const sourceContext = isRecordObject(subjectSnapshot.sourceContext)
    ? subjectSnapshot.sourceContext
    : {};

  return {
    subjectId:
      typeof subjectSnapshot.id === 'string' && subjectSnapshot.id.trim().length > 0
        ? subjectSnapshot.id.trim()
        : undefined,
    sourceContext: {
      domainId: PROJECT_OPS_DOMAIN_ID,
      selectedSources: isRecordObject(sourceContext.selectedSources)
        ? sourceContext.selectedSources
        : undefined,
      selectedSourceIds: Array.isArray(sourceContext.selectedSourceIds)
        ? sourceContext.selectedSourceIds.filter((entry): entry is string => typeof entry === 'string')
        : undefined,
      capabilities: isRecordObject(sourceContext.capabilities)
        ? sourceContext.capabilities
        : undefined,
      planning: isRecordObject(sourceContext.planning) ? sourceContext.planning : undefined,
    },
  };
}

function mergeSourceContext(
  subjectPayload: any,
  config: SubjectAnalysisConfigPayload | null,
): any {
  if (!config?.sourceContext || !subjectPayload || typeof subjectPayload !== 'object') {
    return subjectPayload;
  }

  const localSourceContext =
    subjectPayload.sourceContext && typeof subjectPayload.sourceContext === 'object'
      ? subjectPayload.sourceContext
      : {};
  const serverSourceContext =
    config.sourceContext && typeof config.sourceContext === 'object'
      ? config.sourceContext
      : {};
  const localDomainId = normalizeDomainId(localSourceContext.domainId);
  const serverDomainId = normalizeDomainId(serverSourceContext.domainId);
  const hasDomainMismatch =
    Boolean(localDomainId) && Boolean(serverDomainId) && localDomainId !== serverDomainId;

  if (hasDomainMismatch) {
    return subjectPayload;
  }

  return {
    ...subjectPayload,
    sourceContext: {
      ...serverSourceContext,
      ...localSourceContext,
      domainId: PROJECT_OPS_DOMAIN_ID,
      capabilities: {
        ...(serverSourceContext.capabilities || {}),
        ...(localSourceContext.capabilities || {}),
      },
      planning: {
        ...(serverSourceContext.planning || {}),
        ...(localSourceContext.planning || {}),
      },
    },
  };
}

export const projectOpsAnalysisConfigAdapter: DomainAnalysisConfigAdapter = {
  domainId: PROJECT_OPS_DOMAIN_ID,
  supportsSubject(subjectRef: AnalysisConfigSubjectRef): boolean {
    return (
      !subjectRef.subjectType ||
      subjectRef.subjectType === 'match' ||
      PROJECT_OPS_SUBJECT_TYPES.includes(subjectRef.subjectType as (typeof PROJECT_OPS_SUBJECT_TYPES)[number])
    );
  },
  async fetchSubjectConfig() {
    return null;
  },
  async resolveSubjectConfig(subjectSnapshot: any) {
    return normalizeProjectOpsConfig(subjectSnapshot);
  },
  mergePlanning(subjectPayload: any, config: SubjectAnalysisConfigPayload | null) {
    return mergeSourceContext(subjectPayload, config);
  },
};

export const DOMAIN_ANALYSIS_CONFIG_ADAPTERS = [projectOpsAnalysisConfigAdapter];
