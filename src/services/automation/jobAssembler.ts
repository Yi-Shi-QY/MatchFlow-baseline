import type { DomainAutomationResolvedTarget } from '@/src/domains/runtime/automation';
import type { AnalysisRequestPayload } from '@/src/services/ai/contracts';
import {
  fetchSubjectAnalysisConfig,
  mergeServerPlanningIntoAnalysisPayload,
  resolveSubjectAnalysisConfig,
} from '@/src/services/analysisConfig';
import type { SubjectDisplay } from '@/src/services/subjectDisplay';
import type {
  AutomationJob,
  AutomationTargetSnapshotItem,
  AutomationTargetSnapshot,
} from './types';

export interface AssembledAutomationTarget {
  jobId: string;
  domainId: string;
  subjectId: string;
  subjectType: string;
  title: string;
  match: SubjectDisplay;
  dataToAnalyze: AnalysisRequestPayload;
}

export interface AssembledAutomationJob {
  job: AutomationJob;
  targets: AssembledAutomationTarget[];
  targetSnapshot: AutomationTargetSnapshot;
}

function buildTargetSnapshotItem(input: {
  domainId: string;
  subjectId: string;
  subjectType: string;
  title: string;
}): AutomationTargetSnapshotItem {
  return {
    domainId: input.domainId,
    subjectId: input.subjectId,
    subjectType: input.subjectType,
    title: input.title,
  };
}

async function prepareAutomationAnalysisPayload(input: {
  subjectDisplay: SubjectDisplay;
  job: AutomationJob;
  subjectId: string;
  subjectType: string;
}): Promise<AnalysisRequestPayload> {
  const { subjectDisplay, job, subjectId, subjectType } = input;
  let dataToAnalyze: AnalysisRequestPayload = {
    ...subjectDisplay,
  };

  try {
    let serverConfig = null;
    if (typeof subjectId === 'string' && subjectId.trim().length > 0 && !subjectId.startsWith('custom_')) {
      serverConfig = await fetchSubjectAnalysisConfig({
        domainId: job.domainId,
        subjectId: subjectId.trim(),
        subjectType,
      });
    }

    if (!serverConfig) {
      serverConfig = await resolveSubjectAnalysisConfig(dataToAnalyze);
    }

    dataToAnalyze = mergeServerPlanningIntoAnalysisPayload(dataToAnalyze, serverConfig);
  } catch (error) {
    console.warn(
      'Failed to resolve server planning config for automation job; continue with local source context.',
      error,
    );
  }

  const currentSourceContext =
    dataToAnalyze?.sourceContext && typeof dataToAnalyze.sourceContext === 'object'
      ? dataToAnalyze.sourceContext
      : {};
  const selectedSourceIds = Array.isArray(job.analysisProfile?.selectedSourceIds)
    ? job.analysisProfile.selectedSourceIds
    : currentSourceContext.selectedSourceIds;
  const selectedSources =
    Array.isArray(selectedSourceIds) && selectedSourceIds.length > 0
      ? selectedSourceIds.reduce<Record<string, boolean>>((acc, sourceId) => {
          acc[sourceId] = true;
          return acc;
        }, {})
      : currentSourceContext.selectedSources;
  const planningContext =
    currentSourceContext.planning && typeof currentSourceContext.planning === 'object'
      ? currentSourceContext.planning
      : {};

  return {
    ...dataToAnalyze,
    sourceContext: {
      ...currentSourceContext,
      domainId: job.domainId,
      selectedSources,
      selectedSourceIds,
      planning: {
        ...planningContext,
        sequencePreference:
          job.analysisProfile?.sequencePreference || planningContext.sequencePreference,
        conversationManaged: Boolean(job.analysisProfile),
      },
      automation: {
        jobId: job.id,
        sourceRuleId: job.sourceRuleId,
        triggerType: job.triggerType,
        domainPackVersion: job.domainPackVersion,
        templateId: job.templateId,
        targetSelector: job.targetSelector,
      },
    },
  };
}

function buildTargetSnapshot(
  targets: DomainAutomationResolvedTarget[],
): AutomationTargetSnapshot {
  if (targets.length === 1) {
    return buildTargetSnapshotItem({
      domainId: targets[0].domainId,
      subjectId: targets[0].subjectId,
      subjectType: targets[0].subjectType,
      title: targets[0].title,
    });
  }

  return targets.map((target) =>
    buildTargetSnapshotItem({
      domainId: target.domainId,
      subjectId: target.subjectId,
      subjectType: target.subjectType,
      title: target.title,
    }),
  );
}

async function resolveAutomationTargets(job: AutomationJob) {
  const { resolveRuntimeDomainPack } = await import('@/src/domains/runtime/registry');
  const runtimePack = resolveRuntimeDomainPack(job.domainId);
  if (!runtimePack.automation) {
    throw new Error(
      `Runtime domain "${runtimePack.manifest.domainId}" does not support automation target resolution.`,
    );
  }

  return runtimePack.automation;
}

export async function assembleAutomationJob(job: AutomationJob): Promise<AssembledAutomationJob> {
  const automationCapability = await resolveAutomationTargets(job);
  const resolvedTargets = await automationCapability.resolveJobTargets(job);

  if (resolvedTargets.length > 0) {
    const targets: AssembledAutomationTarget[] = [];

    for (const resolvedTarget of resolvedTargets) {
      const dataToAnalyze = await prepareAutomationAnalysisPayload({
        subjectDisplay: resolvedTarget.subjectDisplay,
        job,
        subjectId: resolvedTarget.subjectId,
        subjectType: resolvedTarget.subjectType,
      });
      targets.push({
        jobId: job.id,
        domainId: resolvedTarget.domainId,
        subjectId: resolvedTarget.subjectId,
        subjectType: resolvedTarget.subjectType,
        title: resolvedTarget.title,
        match: resolvedTarget.subjectDisplay,
        dataToAnalyze,
      });
    }

    return {
      job,
      targets,
      targetSnapshot: buildTargetSnapshot(resolvedTargets),
    };
  }

  const syntheticTarget = await automationCapability.createSyntheticTarget(job);
  const syntheticPayload = await prepareAutomationAnalysisPayload({
    subjectDisplay: syntheticTarget.subjectDisplay,
    job,
    subjectId: syntheticTarget.subjectId,
    subjectType: syntheticTarget.subjectType,
  });
  const customInfo = (
    syntheticTarget.subjectDisplay as SubjectDisplay & {
      customInfo?: unknown;
    }
  ).customInfo;
  if (customInfo !== undefined) {
    syntheticPayload.customInfo = customInfo;
  }

  return {
    job,
    targets: [
      {
        jobId: job.id,
        domainId: syntheticTarget.domainId,
        subjectId: syntheticTarget.subjectId,
        subjectType: syntheticTarget.subjectType,
        title: syntheticTarget.title,
        match: syntheticTarget.subjectDisplay,
        dataToAnalyze: syntheticPayload,
      },
    ],
    targetSnapshot: buildTargetSnapshot([syntheticTarget]),
  };
}
