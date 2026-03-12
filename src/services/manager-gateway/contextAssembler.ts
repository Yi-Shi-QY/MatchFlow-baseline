import type { ContextFragment, RuntimeConversationTurn, RuntimeSessionSnapshot } from '@/src/domains/runtime/types';
import type {
  ManagerContextAssemblyResult,
  ManagerFeedBlock,
  ManagerGatewayContextAssembler,
  ManagerGatewayMemoryService,
  ManagerGatewaySummaryService,
  ManagerSessionRecord,
} from './types';

const DEFAULT_RECENT_TURN_LIMIT = 6;

const CATEGORY_ORDER: Record<ContextFragment['category'], number> = {
  summary: 1,
  recent_turns: 2,
  memory: 3,
  domain_state: 4,
  runtime_state: 5,
  tool_affordance: 6,
};

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.trim().length / 4));
}

function mapFeedToConversation(feed: ManagerFeedBlock[]): RuntimeConversationTurn[] {
  return feed
    .filter((entry) => typeof entry.text === 'string' && entry.text.trim().length > 0)
    .map((entry) => ({
      role: entry.role,
      text: entry.text || '',
      blockType: entry.blockType,
      createdAt: entry.createdAt,
    }));
}

function buildRecentTurnsFragment(recentMessages: RuntimeConversationTurn[]): ContextFragment | null {
  const turns = recentMessages
    .slice(-DEFAULT_RECENT_TURN_LIMIT)
    .filter((message) => typeof message.text === 'string' && message.text.trim().length > 0);
  if (turns.length === 0) {
    return null;
  }

  const text = turns
    .map((message) => {
      const roleLabel =
        message.role === 'user' ? 'User' : message.role === 'system' ? 'System' : 'Assistant';
      return `${roleLabel}: ${message.text.trim().replace(/\s+/g, ' ')}`;
    })
    .join('\n');

  return {
    id: 'recent_turns',
    category: 'recent_turns',
    priority: 90,
    text,
    tokenEstimate: estimateTokens(text),
  };
}

function buildRuntimeStateFragment(input: {
  session: ManagerSessionRecord;
  activeRun: { status: string } | null;
  activeWorkflowType?: string | null;
  sourceAdapterIds: string[];
}): ContextFragment {
  const parts = [
    `Session title: ${input.session.title}`,
    `Domain id: ${input.session.domainId}`,
  ];
  if (input.sourceAdapterIds.length > 0) {
    parts.push(`Mounted source adapters: ${input.sourceAdapterIds.join(', ')}`);
  }
  if (input.activeWorkflowType) {
    parts.push(`Active workflow: ${input.activeWorkflowType}`);
  }
  if (input.activeRun) {
    parts.push(`Active run status: ${input.activeRun.status}`);
  }
  const text = parts.join('\n');
  return {
    id: 'runtime_state',
    category: 'runtime_state',
    priority: 50,
    text,
    tokenEstimate: estimateTokens(text),
  };
}

function buildToolAffordanceFragment(runtimePack: {
  manifest: { displayName: string };
  tools: Array<{ id: string; description: string }>;
}): ContextFragment | null {
  if (runtimePack.tools.length === 0) {
    return null;
  }

  const text = [
    `Available ${runtimePack.manifest.displayName} tool affordances:`,
    ...runtimePack.tools.map((tool) => `- ${tool.id}: ${tool.description}`),
  ].join('\n');

  return {
    id: 'tool_affordances',
    category: 'tool_affordance',
    priority: 20,
    text,
    tokenEstimate: estimateTokens(text),
  };
}

function sortFragments(left: ContextFragment, right: ContextFragment): number {
  const categoryDelta = CATEGORY_ORDER[left.category] - CATEGORY_ORDER[right.category];
  if (categoryDelta !== 0) {
    return categoryDelta;
  }
  return right.priority - left.priority;
}

export function createManagerContextAssembler(args: {
  summaryService: ManagerGatewaySummaryService;
  memoryService: ManagerGatewayMemoryService;
}): ManagerGatewayContextAssembler {
  return {
    async assemble(input): Promise<ManagerContextAssemblyResult> {
      const recentMessages = input.recentMessages || mapFeedToConversation(input.feed);
      const runtimeSession: RuntimeSessionSnapshot = {
        sessionId: input.session.id,
        sessionKey: input.session.sessionKey,
        domainId: input.session.domainId,
        title: input.session.title,
        runtimeDomainVersion: input.session.runtimeDomainVersion,
        activeWorkflow: input.activeWorkflow,
      };

      const latestSummary = await args.summaryService.getLatestSummary(input.session.id);
      const relevantMemories = await args.memoryService.listRelevantMemories({
        session: runtimeSession,
      });

      const domainFragments = (
        await Promise.all(
          input.runtimePack.contextProviders.map((provider) =>
            provider.collect({
              session: runtimeSession,
              recentMessages,
              intent: input.intent,
              runtimeBindings: {
                sourceAdapterIds: input.runtimePack.sourceAdapters.map((adapter) => adapter.id),
                queryCatalog: input.runtimePack.queryCatalog,
              },
              domainState: {
                activeWorkflow: input.activeWorkflow,
              },
            }),
          ),
        )
      ).flat();

      const fragments: ContextFragment[] = [];

      if (latestSummary) {
        fragments.push({
          id: `summary:${latestSummary.id}`,
          category: 'summary',
          priority: 100,
          text: latestSummary.summaryText,
          tokenEstimate: estimateTokens(latestSummary.summaryText),
          metadata: {
            summaryId: latestSummary.id,
            cutoffOrdinal: latestSummary.cutoffOrdinal,
            sourceMessageCount: latestSummary.sourceMessageCount,
          },
        });
      }

      const recentTurnsFragment = buildRecentTurnsFragment(recentMessages);
      if (recentTurnsFragment) {
        fragments.push(recentTurnsFragment);
      }

      fragments.push(
        ...relevantMemories.map((record, index): ContextFragment => ({
          id: `memory:${record.id}:${index}`,
          category: 'memory',
          priority:
            typeof record.importance === 'number' && Number.isFinite(record.importance)
              ? Math.round(record.importance * 100)
              : 60,
          text: `${record.keyText}: ${record.contentText}`,
          tokenEstimate: estimateTokens(`${record.keyText}: ${record.contentText}`),
          metadata: {
            memoryId: record.id,
            scopeType: record.scopeType,
            scopeId: record.scopeId,
            memoryType: record.memoryType,
          },
        })),
      );

      fragments.push(...domainFragments);
      fragments.push(
        buildRuntimeStateFragment({
          session: input.session,
          activeRun: input.activeRun,
          activeWorkflowType: input.activeWorkflow?.workflowType || input.session.activeWorkflowType,
          sourceAdapterIds: input.runtimePack.sourceAdapters.map((adapter) => adapter.id),
        }),
      );

      const toolAffordanceFragment = buildToolAffordanceFragment(input.runtimePack);
      if (toolAffordanceFragment) {
        fragments.push(toolAffordanceFragment);
      }

      const normalizedFragments = fragments
        .filter((fragment) => typeof fragment.text === 'string' && fragment.text.trim().length > 0)
        .map((fragment) => ({
          ...fragment,
          tokenEstimate:
            typeof fragment.tokenEstimate === 'number'
              ? fragment.tokenEstimate
              : estimateTokens(fragment.text),
        }))
        .sort(sortFragments);

      const tokenEstimate = normalizedFragments.reduce(
        (total, fragment) => total + (fragment.tokenEstimate || 0),
        0,
      );
      const assembledAt = Date.now();

      return {
        fragments: normalizedFragments,
        usage: {
          fragmentCount: normalizedFragments.length,
          tokenEstimate,
          summaryId: latestSummary?.id || null,
          memoryCount: relevantMemories.length,
        },
        snapshot: {
          assembledAt,
          fragments: normalizedFragments,
          recentMessageCount: recentMessages.length,
          summaryId: latestSummary?.id || null,
          memoryCount: relevantMemories.length,
        },
      };
    },
  };
}
