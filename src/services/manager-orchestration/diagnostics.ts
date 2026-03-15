import type {
  ManagerGatewayActiveChildDiagnostics,
  ManagerGatewayChildSyncDiagnostics,
  ManagerGatewayChildSyncOutcome,
  ManagerGatewayCompatibilityPath,
  ManagerGatewayDiagnostics,
  ManagerGatewayMigrationDiagnostics,
  ManagerGatewayOrchestrationDiagnostics,
  ManagerGatewayRoutingDiagnostics,
} from '@/src/services/manager-gateway/types';
import type { ManagerSessionKind } from '@/src/services/manager-gateway/types';
import type {
  ManagerCompositeItem,
  ManagerCompositeWorkflowState,
  ManagerRoutingResult,
} from './types';

function resolveCompatibilityPath(
  sessionKind?: ManagerSessionKind | null,
): ManagerGatewayCompatibilityPath {
  if (sessionKind === 'supervisor') {
    return 'supervisor';
  }

  if (sessionKind === 'domain_child') {
    return 'domain_child';
  }

  return 'legacy_domain_main';
}

export function buildGatewayMigrationDiagnostics(
  sessionKind?: ManagerSessionKind | null,
): ManagerGatewayMigrationDiagnostics {
  return {
    compatibilityPath: resolveCompatibilityPath(sessionKind),
    sessionKind: sessionKind || 'domain_main',
  };
}

export function buildGatewayRoutingDiagnostics(
  routingResult: ManagerRoutingResult,
): ManagerGatewayRoutingDiagnostics {
  return {
    mode: routingResult.mode,
    workItemCount: routingResult.items.length,
    workItemDomains: routingResult.items.map((item) => item.domainId),
  };
}

export function buildGatewayActiveChildDiagnostics(input: {
  item: ManagerCompositeItem;
  childSessionId?: string | null;
  inputSource: 'source_text' | 'user_input';
}): ManagerGatewayActiveChildDiagnostics {
  return {
    itemId: input.item.itemId,
    domainId: input.item.domainId,
    childSessionId:
      typeof input.childSessionId !== 'undefined'
        ? input.childSessionId
        : input.item.childSessionId || null,
    inputSource: input.inputSource,
  };
}

export function buildGatewayChildSyncDiagnostics(input: {
  workflow: ManagerCompositeWorkflowState;
  itemId: string;
  outcome: ManagerGatewayChildSyncOutcome;
}): ManagerGatewayChildSyncDiagnostics | null {
  const item = input.workflow.items.find((candidate) => candidate.itemId === input.itemId);
  if (!item) {
    return null;
  }

  const nextActiveItem =
    (input.workflow.activeItemId &&
      input.workflow.items.find((candidate) => candidate.itemId === input.workflow.activeItemId)) ||
    null;

  return {
    itemId: item.itemId,
    domainId: item.domainId,
    outcome: input.outcome,
    itemStatus: item.status,
    nextActiveItemId: nextActiveItem?.itemId || null,
    nextActiveDomainId: nextActiveItem?.domainId || null,
  };
}

export function withOrchestrationDiagnostics(input: {
  diagnostics?: Record<string, unknown>;
  orchestration: ManagerGatewayOrchestrationDiagnostics;
}): ManagerGatewayDiagnostics {
  const existing = (input.diagnostics || {}) as ManagerGatewayDiagnostics;
  return {
    ...existing,
    orchestration: {
      ...(existing.orchestration || {}),
      ...input.orchestration,
    },
  };
}
