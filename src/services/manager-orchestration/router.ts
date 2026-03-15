import type {
  AnalysisIntent,
  DomainRuntimePack,
  ResolveContext,
  RuntimeConversationTurn,
  SessionWorkflowStateSnapshot,
} from '@/src/domains/runtime/types';
import type { ManagerLanguage } from '@/src/services/manager/types';
import type { ManagerRoutingItem, ManagerRoutingResult } from './types';

interface RoutingCandidate extends ManagerRoutingItem {
  domainId: string;
}

function countIntentRefs(intent: AnalysisIntent): {
  subjectCount: number;
  eventCount: number;
} {
  return {
    subjectCount: Array.isArray(intent.subjectRefs) ? intent.subjectRefs.length : 0,
    eventCount: Array.isArray(intent.eventRefs) ? intent.eventRefs.length : 0,
  };
}

function scoreIntent(
  intent: AnalysisIntent,
  activeDomainId?: string | null,
): {
  confidence: number;
  reason: string;
} {
  const { subjectCount, eventCount } = countIntentRefs(intent);
  let confidence = 0.35;
  const reasonParts: string[] = [];

  if (intent.targetType === 'event' || intent.targetType === 'subject') {
    confidence += 0.1;
    reasonParts.push(`target=${intent.targetType}`);
  }

  if (eventCount > 0) {
    confidence += 0.3;
    reasonParts.push(
      eventCount === 1 ? '1 event reference' : `${eventCount} event references`,
    );
  }

  if (subjectCount > 0) {
    confidence += 0.3;
    reasonParts.push(
      subjectCount === 1 ? '1 subject reference' : `${subjectCount} subject references`,
    );
  }

  if (intent.requestedWindow?.start || intent.requestedWindow?.end) {
    confidence += 0.1;
    reasonParts.push('requested window');
  }

  if (intent.intentType === 'schedule') {
    confidence += 0.05;
    reasonParts.push('schedule intent');
  }

  if (activeDomainId && activeDomainId === intent.domainId) {
    confidence += 0.05;
    reasonParts.push('active-domain match');
  }

  return {
    confidence: Math.min(0.98, Number(confidence.toFixed(2))),
    reason: reasonParts.join('; ') || 'generic manager intent',
  };
}

function toRoutingItem(
  intent: AnalysisIntent,
  activeDomainId?: string | null,
): RoutingCandidate {
  const score = scoreIntent(intent, activeDomainId);
  return {
    domainId: intent.domainId,
    sourceText: intent.rawInput,
    confidence: score.confidence,
    reason: score.reason,
  };
}

function sortCandidates(candidates: RoutingCandidate[]): RoutingCandidate[] {
  return [...candidates].sort((left, right) => {
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }

    return left.domainId.localeCompare(right.domainId);
  });
}

function collapseRoutingCandidates(candidates: RoutingCandidate[]): ManagerRoutingResult {
  if (candidates.length === 0) {
    return {
      mode: 'ambiguous',
      items: [],
    };
  }

  const sorted = sortCandidates(candidates);
  const strongCandidates = sorted.filter((candidate) => candidate.confidence >= 0.7);

  if (strongCandidates.length >= 2) {
    return {
      mode: 'composite',
      items: strongCandidates,
    };
  }

  if (strongCandidates.length === 1) {
    return {
      mode: 'single',
      items: [strongCandidates[0]],
    };
  }

  return {
    mode: 'ambiguous',
    items: sorted,
  };
}

export async function resolveManagerRoutingResult(input: {
  text: string;
  language: ManagerLanguage;
  runtimePacks: DomainRuntimePack[];
  sessionId?: string;
  activeDomainId?: string | null;
  recentMessages?: RuntimeConversationTurn[];
  activeWorkflow?: SessionWorkflowStateSnapshot | null;
  signal?: AbortSignal;
}): Promise<ManagerRoutingResult> {
  const ctx: ResolveContext = {
    language: input.language,
    sessionId: input.sessionId,
    activeDomainId: input.activeDomainId || undefined,
    recentMessages: input.recentMessages,
    activeWorkflow: input.activeWorkflow,
    signal: input.signal,
  };

  const resolved = await Promise.all(
    input.runtimePacks.map(async (runtimePack) => {
      const intent = await runtimePack.resolver.resolveIntent(input.text, ctx);
      if (!intent) {
        return null;
      }

      return toRoutingItem(intent, input.activeDomainId);
    }),
  );

  return collapseRoutingCandidates(
    resolved.filter((entry): entry is RoutingCandidate => Boolean(entry)),
  );
}
