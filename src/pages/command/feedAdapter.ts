import type {
  ManagerFeedBlock,
  ManagerMessageBlockType,
  ManagerSessionProjection,
} from '@/src/services/manager-gateway/types';
import type { ManagerConversationAction } from '@/src/services/manager/types';

export interface CommandCenterFeedItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  blockType: ManagerMessageBlockType;
  text?: string;
  createdAt: number;
  draftIds?: string[];
  action?: ManagerConversationAction;
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
      item.action,
  );
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

  return projection.feed
    .map(projectManagerFeedBlockToCommandCenterItem)
    .filter((entry): entry is CommandCenterFeedItem => Boolean(entry));
}

export function createCommandCenterWelcomeFeed(
  language: 'zh' | 'en',
): CommandCenterFeedItem[] {
  return [
    {
      id: `command_center_welcome_${language}`,
      role: 'assistant',
      blockType: 'assistant_text',
      text:
        language === 'zh'
          ? '\u603b\u7ba1 Agent \u5df2\u5c31\u4f4d\u3002\u4f60\u53ef\u4ee5\u76f4\u63a5\u95ee\u201c\u4eca\u5929\u6709\u54ea\u4e9b\u6bd4\u8d5b\u201d\uff0c\u4e5f\u53ef\u4ee5\u8bf4\u201c\u4eca\u665a 20:00 \u5206\u6790\u7687\u9a6c vs \u5df4\u8428\u201d\u3002\u6211\u4f1a\u5148\u67e5\u672c\u5730\u540c\u6b65\u6570\u636e\uff0c\u518d\u5728\u5bf9\u8bdd\u91cc\u5b89\u6392\u5206\u6790\u4efb\u52a1\u3002'
          : 'The manager agent is ready. Ask what matches are on today, or tell me which match to analyze and when. I will query local synced data first, then arrange the analysis task in the conversation.',
      createdAt: 0,
    },
  ];
}
