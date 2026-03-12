import type { ManagerGatewaySessionStore, ManagerGatewaySummaryService, ManagerMessageRecord, ManagerSummaryRecord } from './types';

const DEFAULT_RECENT_WINDOW_SIZE = 6;
const DEFAULT_MIN_SOURCE_MESSAGE_COUNT = 8;
const DEFAULT_MIN_NEW_MESSAGES = 4;
const DEFAULT_MAX_SUMMARY_LINES = 8;
const DEFAULT_MAX_LINE_LENGTH = 180;

function isSummarizableMessage(message: ManagerMessageRecord): boolean {
  if (typeof message.text !== 'string' || message.text.trim().length === 0) {
    return false;
  }

  return (
    message.blockType !== 'navigation_intent' &&
    message.blockType !== 'tool_status' &&
    message.blockType !== 'context_notice'
  );
}

function formatSummaryLine(message: ManagerMessageRecord): string {
  const roleLabel =
    message.role === 'user' ? 'User' : message.role === 'system' ? 'System' : 'Assistant';
  const trimmed = message.text!.trim().replace(/\s+/g, ' ');
  const compact =
    trimmed.length > DEFAULT_MAX_LINE_LENGTH
      ? `${trimmed.slice(0, DEFAULT_MAX_LINE_LENGTH - 3)}...`
      : trimmed;
  return `- ${roleLabel}: ${compact}`;
}

function buildSummaryText(messages: ManagerMessageRecord[], cutoffOrdinal: number): string {
  const lines = messages.slice(-DEFAULT_MAX_SUMMARY_LINES).map(formatSummaryLine);
  return [
    `Transcript summary through ordinal ${cutoffOrdinal}.`,
    `Captured ${messages.length} message block(s) before the recent-window cutoff.`,
    ...lines,
  ].join('\n');
}

export function createManagerSummaryService(args: {
  sessionStore: ManagerGatewaySessionStore;
  recentWindowSize?: number;
  minSourceMessageCount?: number;
  minNewMessages?: number;
}): ManagerGatewaySummaryService {
  const recentWindowSize = args.recentWindowSize || DEFAULT_RECENT_WINDOW_SIZE;
  const minSourceMessageCount = args.minSourceMessageCount || DEFAULT_MIN_SOURCE_MESSAGE_COUNT;
  const minNewMessages = args.minNewMessages || DEFAULT_MIN_NEW_MESSAGES;

  return {
    async getLatestSummary(sessionId: string): Promise<ManagerSummaryRecord | null> {
      if (!args.sessionStore.getLatestSummary) {
        return null;
      }
      return args.sessionStore.getLatestSummary(sessionId);
    },

    async refreshSessionSummary(input: {
      sessionId: string;
      messages: ManagerMessageRecord[];
    }): Promise<ManagerSummaryRecord | null> {
      if (!args.sessionStore.saveSummary) {
        return null;
      }

      const orderedMessages = [...input.messages]
        .sort((left, right) => left.ordinal - right.ordinal)
        .filter(isSummarizableMessage);
      if (orderedMessages.length < minSourceMessageCount) {
        return this.getLatestSummary(input.sessionId);
      }

      const cutoffIndex = orderedMessages.length - recentWindowSize - 1;
      if (cutoffIndex < 0) {
        return this.getLatestSummary(input.sessionId);
      }

      const cutoffOrdinal = orderedMessages[cutoffIndex].ordinal;
      const latestSummary = await this.getLatestSummary(input.sessionId);
      if (latestSummary && latestSummary.cutoffOrdinal >= cutoffOrdinal) {
        return latestSummary;
      }

      const sourceMessages = orderedMessages.filter((message) => message.ordinal <= cutoffOrdinal);
      if (sourceMessages.length < minSourceMessageCount) {
        return latestSummary;
      }

      if (latestSummary) {
        const newMessageCount = sourceMessages.filter(
          (message) => message.ordinal > latestSummary.cutoffOrdinal,
        ).length;
        if (newMessageCount < minNewMessages) {
          return latestSummary;
        }
      }

      return args.sessionStore.saveSummary({
        sessionId: input.sessionId,
        kind: 'rolling_compaction',
        cutoffOrdinal,
        summaryText: buildSummaryText(sourceMessages, cutoffOrdinal),
        sourceMessageCount: sourceMessages.length,
      });
    },
  };
}
