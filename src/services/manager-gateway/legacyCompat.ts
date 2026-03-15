import { resolveRuntimeDomainPack } from '@/src/domains/runtime/registry';
import type { SessionWorkflowStateSnapshot } from '@/src/domains/runtime/types';
import { parseManagerIntakeWorkflowSnapshot } from '@/src/services/manager-intake/workflowProjection';
import type {
  ManagerConversationMessage,
  ManagerSessionSnapshot,
} from '@/src/services/manager/types';
import {
  getRuntimeManagerCapability,
  parseRuntimeManagerPendingTask,
} from '@/src/services/manager/runtimeIntentRouter';
import type {
  ManagerFeedBlock,
  ManagerMessageBlockType,
  ManagerMessageRole,
  ManagerSessionProjection,
} from './types';

function parsePayloadData(input: string | null | undefined): Record<string, unknown> | null {
  if (!input) {
    return null;
  }

  try {
    const parsed = JSON.parse(input);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function mapFeedRole(role: ManagerMessageRole): ManagerConversationMessage['role'] {
  return role === 'user' ? 'user' : 'agent';
}

function mapFeedKind(blockType: ManagerMessageBlockType): ManagerConversationMessage['kind'] {
  return blockType === 'draft_bundle' ? 'draft_bundle' : 'text';
}

function projectFeedBlockToLegacyMessage(block: ManagerFeedBlock): ManagerConversationMessage | null {
  if (
    block.blockType === 'tool_status' ||
    block.blockType === 'context_notice' ||
    (!block.text && block.blockType !== 'draft_bundle')
  ) {
    return null;
  }

  const payload = parsePayloadData(block.payloadData);
  const action =
    payload?.action &&
    typeof payload.action === 'object' &&
    !Array.isArray(payload.action) &&
    (payload.action as Record<string, unknown>).type === 'open_settings' &&
    typeof (payload.action as Record<string, unknown>).label === 'string'
      ? {
          type: 'open_settings' as const,
          label: String((payload.action as Record<string, unknown>).label),
        }
      : undefined;
  const draftIds = Array.isArray(payload?.draftIds)
    ? payload?.draftIds.filter((entry): entry is string => typeof entry === 'string')
    : undefined;

  return {
    id: block.id,
    role: mapFeedRole(block.role),
    kind: mapFeedKind(block.blockType),
    text: block.text || '',
    createdAt: block.createdAt,
    draftIds: draftIds && draftIds.length > 0 ? draftIds : undefined,
    action,
  };
}

function projectWorkflowToPendingTask(input: {
  domainId: string;
  workflow: SessionWorkflowStateSnapshot | null,
}): ManagerSessionSnapshot['pendingTask'] {
  return parseRuntimeManagerPendingTask({
    domainId: input.domainId,
    workflow: input.workflow,
  });
}

function projectWorkflowToIntakeWorkflow(input: {
  domainId: string;
  workflow: SessionWorkflowStateSnapshot | null;
}): ManagerSessionSnapshot['intakeWorkflow'] {
  const capability = getRuntimeManagerCapability({
    domainId: input.domainId,
  });
  const workflowType = capability?.taskIntake?.definition.workflowType;
  if (!workflowType) {
    return null;
  }

  return parseManagerIntakeWorkflowSnapshot(input.workflow, workflowType);
}

function getRuntimeDomainLabel(domainId: string): string {
  const displayName = resolveRuntimeDomainPack(domainId).manifest.displayName.trim();
  return displayName.replace(/\s+Runtime Pack$/i, '').trim() || domainId;
}

function getEffectiveActiveWorkflow(
  projection: ManagerSessionProjection,
): {
  domainId: string;
  workflow: SessionWorkflowStateSnapshot | null;
} {
  if (projection.session.sessionKind !== 'supervisor' || !projection.compositeWorkflow) {
    return {
      domainId: projection.runtimeDomainId || projection.session.domainId,
      workflow: projection.activeWorkflow,
    };
  }

  const workflow = projection.compositeWorkflow;
  const activeItem =
    (workflow.activeItemId &&
      workflow.items.find((item) => item.itemId === workflow.activeItemId)) ||
    workflow.items.find((item) => item.status === 'active') ||
    workflow.items.find((item) => item.status === 'blocked') ||
    workflow.items.find((item) => item.status === 'pending') ||
    workflow.items.find((item) => item.status === 'failed') ||
    null;

  if (
    !activeItem ||
    typeof activeItem.childWorkflowType !== 'string' ||
    !activeItem.childWorkflowType.trim() ||
    !activeItem.childWorkflowStateData ||
    typeof activeItem.childWorkflowStateData !== 'object' ||
    Array.isArray(activeItem.childWorkflowStateData)
  ) {
    return {
      domainId: activeItem?.domainId || projection.runtimeDomainId || projection.session.domainId,
      workflow: null,
    };
  }

  return {
    domainId: activeItem.domainId,
    workflow: {
      workflowType: activeItem.childWorkflowType,
      stateData: activeItem.childWorkflowStateData,
      updatedAt: projection.compositeWorkflow.updatedAt,
    },
  };
}

function buildCompositeSummaryMessages(
  projection: ManagerSessionProjection,
  existingMessages: ManagerConversationMessage[],
): ManagerConversationMessage[] {
  if (!projection.compositeWorkflow) {
    return [];
  }

  const existingTexts = new Set(
    existingMessages
      .filter((message) => message.role === 'agent')
      .map((message) => message.text.trim()),
  );

  return projection.compositeWorkflow.items
    .filter((item) => typeof item.summary === 'string' && item.summary.trim().length > 0)
    .filter((item) => !existingTexts.has(item.summary!.trim()))
    .map((item, index) => ({
      id: `composite_summary:${item.itemId}`,
      role: 'agent' as const,
      kind: 'text' as const,
      text: `[${getRuntimeDomainLabel(item.domainId)}] ${item.summary!.trim()}`,
      createdAt: projection.compositeWorkflow!.updatedAt + index + 1,
    }));
}

export function projectManagerSessionProjectionToLegacySnapshot(
  projection: ManagerSessionProjection,
): ManagerSessionSnapshot {
  const feedMessages = projection.feed
    .map(projectFeedBlockToLegacyMessage)
    .filter((entry): entry is ManagerConversationMessage => Boolean(entry));
  const messages = [...feedMessages, ...buildCompositeSummaryMessages(projection, feedMessages)];
  const effectiveActiveWorkflow = getEffectiveActiveWorkflow(projection);

  return {
    messages,
    pendingTask: projectWorkflowToPendingTask({
      domainId: effectiveActiveWorkflow.domainId,
      workflow: effectiveActiveWorkflow.workflow,
    }),
    intakeWorkflow: projectWorkflowToIntakeWorkflow({
      domainId: effectiveActiveWorkflow.domainId,
      workflow: effectiveActiveWorkflow.workflow,
    }),
  };
}
