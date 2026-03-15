import { createAutomationId } from '@/src/services/automation/utils';
import type {
  ManagerCompositeItem,
  ManagerCompositeItemStatus,
  ManagerCompositeWorkflowState,
  ManagerCompositeWorkflowStatus,
  ManagerRoutingResult,
} from './types';

function buildItemTitle(sourceText: string, domainId: string): string {
  const normalized = sourceText.trim();
  if (normalized.length > 0) {
    return normalized;
  }

  return domainId.trim().length > 0 ? domainId.trim() : 'Untitled work item';
}

function isTerminalItemStatus(status: ManagerCompositeItemStatus): boolean {
  return status === 'completed' || status === 'failed';
}

function normalizeItem(
  item: Partial<ManagerCompositeItem> & Pick<ManagerCompositeItem, 'itemId' | 'domainId' | 'sourceText'>,
): ManagerCompositeItem {
  return {
    itemId: item.itemId,
    title: typeof item.title === 'string' && item.title.trim().length > 0
      ? item.title.trim()
      : buildItemTitle(item.sourceText, item.domainId),
    domainId: item.domainId,
    sourceText: item.sourceText,
    status:
      item.status === 'active' ||
      item.status === 'blocked' ||
      item.status === 'completed' ||
      item.status === 'failed'
        ? item.status
        : 'pending',
    childSessionId: typeof item.childSessionId === 'string' ? item.childSessionId : null,
    childWorkflowType: typeof item.childWorkflowType === 'string' ? item.childWorkflowType : null,
    childWorkflowStateData:
      item.childWorkflowStateData && typeof item.childWorkflowStateData === 'object'
        ? { ...item.childWorkflowStateData }
        : null,
    pendingLabel: typeof item.pendingLabel === 'string' ? item.pendingLabel : undefined,
    summary: typeof item.summary === 'string' ? item.summary : undefined,
  };
}

function deriveWorkflowStatus(
  items: ManagerCompositeItem[],
  activeItemId: string | null,
): ManagerCompositeWorkflowStatus {
  if (items.length === 0) {
    return 'planning';
  }

  if (items.every((item) => item.status === 'completed')) {
    return 'completed';
  }

  if (activeItemId && items.some((item) => item.itemId === activeItemId && item.status === 'active')) {
    return 'active';
  }

  if (items.some((item) => item.status === 'pending' || item.status === 'active')) {
    return 'active';
  }

  if (items.some((item) => item.status === 'blocked' || item.status === 'failed')) {
    return 'blocked';
  }

  return 'planning';
}

function pickNextActiveItemId(items: ManagerCompositeItem[]): string | null {
  const preferred = items.find((item) => item.status === 'pending');
  if (preferred) {
    return preferred.itemId;
  }

  const resumable = items.find((item) => item.status === 'active');
  return resumable?.itemId || null;
}

function withDerivedState(
  workflow: ManagerCompositeWorkflowState,
  items: ManagerCompositeItem[],
  activeItemId: string | null,
  updatedAt: number,
): ManagerCompositeWorkflowState {
  const nextItems = items.map((item) => ({ ...item }));
  const nextActiveItemId = (() => {
    if (!activeItemId) {
      return null;
    }

    const activeItem = nextItems.find((item) => item.itemId === activeItemId);
    return activeItem && activeItem.status === 'active' ? activeItemId : null;
  })();

  return {
    ...workflow,
    items: nextItems,
    activeItemId: nextActiveItemId,
    status: deriveWorkflowStatus(nextItems, nextActiveItemId),
    updatedAt,
  };
}

export function createCompositeWorkflow(input: {
  sourceText: string;
  routingResult: ManagerRoutingResult;
  workflowId?: string;
  now?: number;
}): ManagerCompositeWorkflowState {
  const now = input.now || Date.now();
  const items = input.routingResult.items.map((item, index) =>
    normalizeItem({
      itemId: createAutomationId('manager_item'),
      title: buildItemTitle(item.sourceText, item.domainId),
      domainId: item.domainId,
      sourceText: item.sourceText,
      status:
        input.routingResult.mode !== 'ambiguous' && index === 0 ? 'active' : 'pending',
    }),
  );

  const activeItemId =
    input.routingResult.mode === 'ambiguous' ? null : items.find((item) => item.status === 'active')?.itemId || null;

  return {
    schemaVersion: 'manager_composite_v1',
    workflowId: input.workflowId || createAutomationId('manager_composite'),
    workflowType: 'manager_composite',
    sourceText: input.sourceText,
    status:
      input.routingResult.mode === 'ambiguous'
        ? 'blocked'
        : deriveWorkflowStatus(items, activeItemId),
    activeItemId,
    items,
    createdAt: now,
    updatedAt: now,
  };
}

export function activateCompositeItem(
  workflow: ManagerCompositeWorkflowState,
  input: {
    itemId: string;
    now?: number;
  },
): ManagerCompositeWorkflowState {
  const target = workflow.items.find((item) => item.itemId === input.itemId);
  if (!target || isTerminalItemStatus(target.status)) {
    return workflow;
  }

  const nextItems = workflow.items.map((item) => {
    if (item.itemId === input.itemId) {
      return {
        ...item,
        status: 'active' as const,
      };
    }

    if (item.status === 'active') {
      return {
        ...item,
        status: 'pending' as const,
      };
    }

    return { ...item };
  });

  return withDerivedState(workflow, nextItems, input.itemId, input.now || Date.now());
}

export function syncChildStateIntoCompositeItem(
  workflow: ManagerCompositeWorkflowState,
  input: {
    itemId: string;
    status?: ManagerCompositeItemStatus;
    childSessionId?: string | null;
    childWorkflowType?: string | null;
    childWorkflowStateData?: Record<string, unknown> | null;
    pendingLabel?: string;
    summary?: string;
    now?: number;
  },
): ManagerCompositeWorkflowState {
  let targetFound = false;
  const nextItems = workflow.items.map((item) => {
    if (item.itemId !== input.itemId) {
      return { ...item };
    }

    targetFound = true;
    return normalizeItem({
      ...item,
      status: input.status || item.status,
      childSessionId:
        typeof input.childSessionId !== 'undefined' ? input.childSessionId : item.childSessionId,
      childWorkflowType:
        typeof input.childWorkflowType !== 'undefined'
          ? input.childWorkflowType
          : item.childWorkflowType,
      childWorkflowStateData:
        typeof input.childWorkflowStateData !== 'undefined'
          ? input.childWorkflowStateData
          : item.childWorkflowStateData,
      pendingLabel:
        typeof input.pendingLabel !== 'undefined' ? input.pendingLabel : item.pendingLabel,
      summary: typeof input.summary !== 'undefined' ? input.summary : item.summary,
    });
  });

  if (!targetFound) {
    return workflow;
  }

  const updatedAt = input.now || Date.now();
  const target = nextItems.find((item) => item.itemId === input.itemId) || null;
  const nextActiveItemId = target?.status === 'active' ? target.itemId : workflow.activeItemId;
  return withDerivedState(workflow, nextItems, nextActiveItemId, updatedAt);
}

export function completeCompositeItem(
  workflow: ManagerCompositeWorkflowState,
  input: {
    itemId: string;
    summary?: string;
    now?: number;
  },
): ManagerCompositeWorkflowState {
  let targetFound = false;
  const nextItems = workflow.items.map((item) => {
    if (item.itemId !== input.itemId) {
      return { ...item };
    }

    targetFound = true;
    return {
      ...item,
      status: 'completed' as const,
      summary: typeof input.summary === 'string' ? input.summary : item.summary,
      pendingLabel: undefined,
      childWorkflowStateData: item.childWorkflowStateData ? { ...item.childWorkflowStateData } : null,
    };
  });

  if (!targetFound) {
    return workflow;
  }

  const nextActiveItemId = pickNextActiveItemId(nextItems);
  const activatedItems =
    nextActiveItemId
      ? nextItems.map((item) =>
          item.itemId === nextActiveItemId && item.status === 'pending'
            ? { ...item, status: 'active' as const }
            : { ...item },
        )
      : nextItems.map((item) => ({ ...item }));

  return withDerivedState(
    workflow,
    activatedItems,
    nextActiveItemId,
    input.now || Date.now(),
  );
}

export function cancelCompositeWorkflow(
  workflow: ManagerCompositeWorkflowState,
  input?: {
    now?: number;
  },
): ManagerCompositeWorkflowState {
  const nextItems = workflow.items.map((item) => {
    if (isTerminalItemStatus(item.status)) {
      return { ...item };
    }

    return {
      ...item,
      status: 'blocked' as const,
    };
  });

  return withDerivedState(workflow, nextItems, null, input?.now || Date.now());
}

export function serializeCompositeWorkflow(workflow: ManagerCompositeWorkflowState): string {
  return JSON.stringify(workflow);
}

export function parseCompositeWorkflowSnapshot(
  input: string | Record<string, unknown> | null | undefined,
): ManagerCompositeWorkflowState | null {
  const raw =
    typeof input === 'string'
      ? (() => {
          try {
            return JSON.parse(input) as Record<string, unknown>;
          } catch {
            return null;
          }
        })()
      : input && typeof input === 'object' && !Array.isArray(input)
        ? input
        : null;

  if (!raw) {
    return null;
  }

  if (
    raw.schemaVersion !== 'manager_composite_v1' ||
    raw.workflowType !== 'manager_composite' ||
    typeof raw.workflowId !== 'string' ||
    typeof raw.sourceText !== 'string' ||
    !Array.isArray(raw.items)
  ) {
    return null;
  }

  const items = raw.items
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .filter(
      (item) =>
        typeof item.itemId === 'string' &&
        typeof item.domainId === 'string' &&
        typeof item.sourceText === 'string',
    )
    .map((item) =>
      normalizeItem({
        itemId: item.itemId as string,
        title: typeof item.title === 'string' ? item.title : undefined,
        domainId: item.domainId as string,
        sourceText: item.sourceText as string,
        status: item.status as ManagerCompositeItemStatus,
        childSessionId: typeof item.childSessionId === 'string' ? item.childSessionId : null,
        childWorkflowType: typeof item.childWorkflowType === 'string' ? item.childWorkflowType : null,
        childWorkflowStateData:
          item.childWorkflowStateData && typeof item.childWorkflowStateData === 'object'
            ? (item.childWorkflowStateData as Record<string, unknown>)
            : null,
        pendingLabel: typeof item.pendingLabel === 'string' ? item.pendingLabel : undefined,
        summary: typeof item.summary === 'string' ? item.summary : undefined,
      }),
    );

  const activeItemId =
    typeof raw.activeItemId === 'string' && items.some((item) => item.itemId === raw.activeItemId)
      ? raw.activeItemId
      : null;

  const workflow: ManagerCompositeWorkflowState = {
    schemaVersion: 'manager_composite_v1',
    workflowId: raw.workflowId,
    workflowType: 'manager_composite',
    sourceText: raw.sourceText,
    status:
      raw.status === 'active' || raw.status === 'blocked' || raw.status === 'completed'
        ? raw.status
        : deriveWorkflowStatus(items, activeItemId),
    activeItemId,
    items,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  };

  return withDerivedState(workflow, items, activeItemId, workflow.updatedAt);
}
