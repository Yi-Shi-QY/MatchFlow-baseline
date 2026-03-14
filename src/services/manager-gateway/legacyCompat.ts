import type { SessionWorkflowStateSnapshot } from '@/src/domains/runtime/types';
import type {
  ManagerConversationMessage,
  ManagerSessionSnapshot,
} from '@/src/services/manager/types';
import { parseRuntimeManagerPendingTask } from '@/src/services/manager/runtimeIntentRouter';
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

export function projectManagerSessionProjectionToLegacySnapshot(
  projection: ManagerSessionProjection,
): ManagerSessionSnapshot {
  const messages = projection.feed
    .map(projectFeedBlockToLegacyMessage)
    .filter((entry): entry is ManagerConversationMessage => Boolean(entry));

  return {
    messages,
    pendingTask: projectWorkflowToPendingTask({
      domainId: projection.runtimeDomainId || projection.session.domainId,
      workflow: projection.activeWorkflow,
    }),
  };
}
