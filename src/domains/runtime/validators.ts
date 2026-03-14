import type { DomainRuntimePack } from './types';

function normalizeId(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

function assertNonEmptyValue(value: string, message: string): void {
  if (value.length === 0) {
    throw new Error(message);
  }
}

function assertUniqueIds(domainId: string, resourceName: string, ids: string[]): void {
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length > 0) {
    throw new Error(
      `[runtime:${domainId}] Duplicate ${resourceName}: ${Array.from(new Set(duplicates)).join(', ')}`,
    );
  }
}

export function assertValidRuntimePack(runtimePack: DomainRuntimePack): DomainRuntimePack {
  const domainId = normalizeId(runtimePack?.manifest?.domainId);
  assertNonEmptyValue(domainId, '[runtime] Runtime pack manifest.domainId is required.');
  assertNonEmptyValue(
    normalizeId(runtimePack?.manifest?.version),
    `[runtime:${domainId}] Runtime pack manifest.version is required.`,
  );
  assertNonEmptyValue(
    normalizeId(runtimePack?.manifest?.displayName),
    `[runtime:${domainId}] Runtime pack manifest.displayName is required.`,
  );

  if (
    !runtimePack?.resolver ||
    typeof runtimePack.resolver.resolveIntent !== 'function' ||
    typeof runtimePack.resolver.resolveSubjects !== 'function' ||
    typeof runtimePack.resolver.resolveEvents !== 'function'
  ) {
    throw new Error(
      `[runtime:${domainId}] Runtime pack must provide resolver.resolveIntent/resolveSubjects/resolveEvents.`,
    );
  }

  if (!Array.isArray(runtimePack.sourceAdapters)) {
    throw new Error(`[runtime:${domainId}] Runtime pack sourceAdapters must be an array.`);
  }
  if (!Array.isArray(runtimePack.contextProviders)) {
    throw new Error(`[runtime:${domainId}] Runtime pack contextProviders must be an array.`);
  }
  if (!Array.isArray(runtimePack.tools)) {
    throw new Error(`[runtime:${domainId}] Runtime pack tools must be an array.`);
  }

  const sourceAdapterIds = runtimePack.sourceAdapters.map((adapter) => normalizeId(adapter?.id));
  sourceAdapterIds.forEach((adapterId, index) => {
    assertNonEmptyValue(
      adapterId,
      `[runtime:${domainId}] sourceAdapters[${index}] must provide a non-empty id.`,
    );
  });
  assertUniqueIds(domainId, 'source adapter ids', sourceAdapterIds);

  const workflowTypes = Array.isArray(runtimePack.workflows)
    ? runtimePack.workflows.map((workflow) => normalizeId(workflow?.workflowType))
    : [];
  workflowTypes.forEach((workflowType, index) => {
    assertNonEmptyValue(
      workflowType,
      `[runtime:${domainId}] workflows[${index}] must provide a non-empty workflowType.`,
    );
  });
  assertUniqueIds(domainId, 'workflow types', workflowTypes);

  if (runtimePack.manager) {
    const managerDomainId = normalizeId(runtimePack.manager.domainId);
    if (managerDomainId !== domainId) {
      throw new Error(
        `[runtime:${domainId}] manager.domainId must match manifest.domainId, received "${managerDomainId || '(empty)'}".`,
      );
    }

    const skillIds = Array.isArray(runtimePack.manager.skillIds)
      ? runtimePack.manager.skillIds.map((skillId) => normalizeId(skillId))
      : [];
    if (skillIds.length === 0) {
      throw new Error(`[runtime:${domainId}] manager.skillIds must contain at least one tool id.`);
    }
    skillIds.forEach((skillId, index) => {
      assertNonEmptyValue(
        skillId,
        `[runtime:${domainId}] manager.skillIds[${index}] must be a non-empty string.`,
      );
    });
    assertUniqueIds(domainId, 'manager skill ids', skillIds);

    if (
      typeof runtimePack.manager.parsePendingTask !== 'function' ||
      typeof runtimePack.manager.mapLegacyEffect !== 'function'
    ) {
      throw new Error(
        `[runtime:${domainId}] manager capability must provide parsePendingTask and mapLegacyEffect.`,
      );
    }

    const defaultWorkflowType = normalizeId(runtimePack.manager.plannerHints?.defaultWorkflowType);
    if (defaultWorkflowType.length > 0 && !workflowTypes.includes(defaultWorkflowType)) {
      throw new Error(
        `[runtime:${domainId}] manager planner defaultWorkflowType "${defaultWorkflowType}" is not registered in workflows.`,
      );
    }
  }

  return runtimePack;
}
