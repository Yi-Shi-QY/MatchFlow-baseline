import type {
  ManagerFeedBlock,
  ManagerMessageBlockType,
  ManagerSessionProjection,
} from '@/src/services/manager-gateway/types';
import { resolveRuntimeDomainPack } from '@/src/domains/runtime/registry';
import { resolveRuntimeManagerHelpText } from '@/src/services/manager/runtimeIntentRouter';
import type { ManagerConversationAction } from '@/src/services/manager/types';

export interface CommandCenterFeedItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  blockType: ManagerMessageBlockType;
  text?: string;
  createdAt: number;
  draftIds?: string[];
  action?: ManagerConversationAction;
  automationEvent?: {
    source: 'automation_executor';
    phase: 'started' | 'completed' | 'failed' | 'cancelled';
    route: string;
    title: string;
    provider?: string | null;
    model?: string | null;
    errorMessage?: string | null;
    totalTokens?: number | null;
  };
  navigationIntent?: {
    route: string;
    state?: Record<string, unknown>;
  };
}

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

function parseAction(payload: Record<string, unknown> | null): ManagerConversationAction | undefined {
  if (
    payload?.action &&
    typeof payload.action === 'object' &&
    !Array.isArray(payload.action) &&
    (payload.action as Record<string, unknown>).type === 'open_settings' &&
    typeof (payload.action as Record<string, unknown>).label === 'string'
  ) {
    return {
      type: 'open_settings',
      label: String((payload.action as Record<string, unknown>).label),
    };
  }

  return undefined;
}

function parseDraftIds(payload: Record<string, unknown> | null): string[] | undefined {
  const draftIds = Array.isArray(payload?.draftIds)
    ? payload.draftIds.filter((entry): entry is string => typeof entry === 'string')
    : [];
  return draftIds.length > 0 ? draftIds : undefined;
}

function parseAutomationEvent(
  payload: Record<string, unknown> | null,
): CommandCenterFeedItem['automationEvent'] {
  if (
    !payload?.automationEvent ||
    typeof payload.automationEvent !== 'object' ||
    Array.isArray(payload.automationEvent)
  ) {
    return undefined;
  }

  const event = payload.automationEvent as Record<string, unknown>;
  const phase = event.phase;
  const route = typeof event.route === 'string' ? event.route.trim() : '';
  const title = typeof event.title === 'string' ? event.title.trim() : '';
  if (
    event.source !== 'automation_executor' ||
    (phase !== 'started' &&
      phase !== 'completed' &&
      phase !== 'failed' &&
      phase !== 'cancelled') ||
    route.length === 0 ||
    title.length === 0
  ) {
    return undefined;
  }

  return {
    source: 'automation_executor',
    phase,
    route,
    title,
    provider: typeof event.provider === 'string' ? event.provider : null,
    model: typeof event.model === 'string' ? event.model : null,
    errorMessage: typeof event.errorMessage === 'string' ? event.errorMessage : null,
    totalTokens: typeof event.totalTokens === 'number' ? event.totalTokens : null,
  };
}

function parseNavigationIntent(
  blockType: ManagerMessageBlockType,
  payload: Record<string, unknown> | null,
): CommandCenterFeedItem['navigationIntent'] {
  if (blockType !== 'navigation_intent') {
    return undefined;
  }

  if (typeof payload?.route !== 'string' || payload.route.trim().length === 0) {
    return undefined;
  }

  return {
    route: payload.route,
    state:
      payload.state && typeof payload.state === 'object' && !Array.isArray(payload.state)
        ? (payload.state as Record<string, unknown>)
        : undefined,
  };
}

function hasDisplayableContent(item: CommandCenterFeedItem): boolean {
  return Boolean(
    (typeof item.text === 'string' && item.text.trim().length > 0) ||
      (item.draftIds && item.draftIds.length > 0) ||
      item.action ||
      item.automationEvent ||
      item.navigationIntent,
  );
}

function getRuntimeDomainLabel(domainId: string): string {
  const displayName = resolveRuntimeDomainPack(domainId).manifest.displayName.trim();
  return displayName.replace(/\s+Runtime Pack$/i, '').trim() || domainId;
}

export function projectManagerFeedBlockToCommandCenterItem(
  block: ManagerFeedBlock,
): CommandCenterFeedItem | null {
  const payload = parsePayloadData(block.payloadData);
  const item: CommandCenterFeedItem = {
    id: block.id,
    role: block.role,
    blockType: block.blockType,
    text: block.text || undefined,
    createdAt: block.createdAt,
    draftIds: parseDraftIds(payload),
    action: parseAction(payload),
    automationEvent: parseAutomationEvent(payload),
    navigationIntent: parseNavigationIntent(block.blockType, payload),
  };

  if (!hasDisplayableContent(item)) {
    return null;
  }

  return item;
}

export function projectManagerSessionProjectionToCommandCenterFeed(
  projection: ManagerSessionProjection | null | undefined,
): CommandCenterFeedItem[] {
  if (!projection) {
    return [];
  }

  const feedItems = projection.feed
    .map(projectManagerFeedBlockToCommandCenterItem)
    .filter((entry): entry is CommandCenterFeedItem => Boolean(entry));
  const existingAssistantTexts = new Set(
    feedItems
      .filter((entry) => entry.role === 'assistant' && typeof entry.text === 'string')
      .map((entry) => entry.text!.trim()),
  );
  const compositeSummaryItems =
    projection.compositeWorkflow?.items
      .filter(
        (item) => typeof item.summary === 'string' && item.summary.trim().length > 0,
      )
      .filter((item) => !existingAssistantTexts.has(item.summary!.trim()))
      .map((item, index) => ({
        id: `composite_summary:${item.itemId}`,
        role: 'assistant' as const,
        blockType: 'assistant_text' as const,
        text: `[${getRuntimeDomainLabel(item.domainId)}] ${item.summary!.trim()}`,
        createdAt:
          (projection.compositeWorkflow?.updatedAt || projection.session.updatedAt || 0) + index + 1,
      })) || [];

  return [...feedItems, ...compositeSummaryItems];
}

export function createCommandCenterWelcomeFeed(
  language: 'zh' | 'en',
  domainId = 'football',
): CommandCenterFeedItem[] {
  return [
    {
      id: `command_center_welcome_${language}`,
      role: 'assistant',
      blockType: 'assistant_text',
      text: resolveRuntimeManagerHelpText({
        domainId,
        language,
      }),
      createdAt: 0,
    },
  ];
}
