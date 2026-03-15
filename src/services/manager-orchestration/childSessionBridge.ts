import { parseRuntimeManagerTaskIntakeSummary } from '@/src/services/manager/runtimeIntentRouter';
import type {
  ManagerGatewaySessionStore,
  ManagerRuntimeDomainRegistry,
  ManagerSessionProjection,
  ManagerSessionRecord,
} from '@/src/services/manager-gateway/types';
import {
  completeCompositeItem,
  syncChildStateIntoCompositeItem,
} from './compositeWorkflow';
import type {
  ManagerCompositeItem,
  ManagerCompositeWorkflowState,
} from './types';

function buildChildSessionKey(input: {
  parentSessionId: string;
  itemId: string;
}): string {
  return `manager:child:${input.parentSessionId}:${input.itemId}`;
}

function findLatestAssistantText(projection: ManagerSessionProjection): string | undefined {
  const latest = [...projection.feed]
    .reverse()
    .find(
      (entry) =>
        entry.role === 'assistant' &&
        typeof entry.text === 'string' &&
        entry.text.trim().length > 0,
    );

  return latest?.text?.trim();
}

export function createChildSessionBridge(args: {
  sessionStore: ManagerGatewaySessionStore;
  runtimeDomainRegistry: ManagerRuntimeDomainRegistry;
}) {
  return {
    async ensureChildSession(input: {
      supervisorSession: ManagerSessionRecord;
      item: ManagerCompositeItem;
    }): Promise<ManagerSessionRecord> {
      if (input.item.childSessionId) {
        const existing = await args.sessionStore.getSessionById(input.item.childSessionId);
        if (existing) {
          return existing;
        }
      }

      if (!args.sessionStore.createSession) {
        throw new Error('Supervisor child session creation requires a mutable session store.');
      }

      const runtimePack = args.runtimeDomainRegistry.resolve(input.item.domainId);
      return args.sessionStore.createSession({
        sessionKey: buildChildSessionKey({
          parentSessionId: input.supervisorSession.id,
          itemId: input.item.itemId,
        }),
        sessionKind: 'domain_child',
        parentSessionId: input.supervisorSession.id,
        ownerDomainId: input.item.domainId,
        domainId: input.item.domainId,
        runtimeDomainVersion: runtimePack.manifest.version,
        title: input.item.title,
      });
    },

    syncCompositeWorkflowFromChild(input: {
      workflow: ManagerCompositeWorkflowState;
      itemId: string;
      childProjection: ManagerSessionProjection;
      language: 'zh' | 'en';
      now?: number;
    }): ManagerCompositeWorkflowState {
      const runtimePack = args.runtimeDomainRegistry.resolve(input.childProjection.session.domainId);
      const latestAssistantText = findLatestAssistantText(input.childProjection);
      const intakeSummary = parseRuntimeManagerTaskIntakeSummary({
        runtimePack,
        workflow: input.childProjection.activeWorkflow,
        language: input.language,
      });
      const pendingLabel = intakeSummary?.activeStepTitle || latestAssistantText;
      const synced = syncChildStateIntoCompositeItem(input.workflow, {
        itemId: input.itemId,
        status: input.childProjection.activeWorkflow ? 'active' : 'completed',
        childSessionId: input.childProjection.session.id,
        childWorkflowType: input.childProjection.activeWorkflow?.workflowType || null,
        childWorkflowStateData: input.childProjection.activeWorkflow?.stateData || null,
        pendingLabel: input.childProjection.activeWorkflow ? pendingLabel : undefined,
        summary: latestAssistantText,
        now: input.now,
      });

      if (input.childProjection.activeWorkflow) {
        return synced;
      }

      return completeCompositeItem(synced, {
        itemId: input.itemId,
        summary: latestAssistantText,
        now: input.now,
      });
    },
  };
}
