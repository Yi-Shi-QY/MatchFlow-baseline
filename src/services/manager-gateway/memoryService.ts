import type { DomainRuntimePack, MemoryWriteRequest, RuntimeSessionSnapshot } from '@/src/domains/runtime/types';
import type { ManagerGatewayMemoryService, ManagerGatewaySessionStore, ManagerMemoryRecord } from './types';

const DEFAULT_MEMORY_LIMIT = 6;
const GLOBAL_MEMORY_SCOPE_ID = 'global';

function resolveScopeId(
  request: MemoryWriteRequest,
  session: RuntimeSessionSnapshot,
): string {
  if (typeof request.scopeId === 'string' && request.scopeId.trim().length > 0) {
    return request.scopeId.trim();
  }

  if (request.scopeType === 'session') {
    return session.sessionId;
  }
  if (request.scopeType === 'domain') {
    return session.domainId;
  }
  return GLOBAL_MEMORY_SCOPE_ID;
}

function sortMemories(left: ManagerMemoryRecord, right: ManagerMemoryRecord): number {
  const importanceDelta = (right.importance || 0) - (left.importance || 0);
  if (importanceDelta !== 0) {
    return importanceDelta;
  }
  return right.updatedAt - left.updatedAt;
}

export function createManagerMemoryService(args: {
  sessionStore: ManagerGatewaySessionStore;
  defaultLimit?: number;
}): ManagerGatewayMemoryService {
  const defaultLimit = args.defaultLimit || DEFAULT_MEMORY_LIMIT;

  return {
    async listRelevantMemories(input: {
      session: RuntimeSessionSnapshot;
      limit?: number;
    }): Promise<ManagerMemoryRecord[]> {
      if (!args.sessionStore.listMemories) {
        return [];
      }

      const limit = input.limit && input.limit > 0 ? input.limit : defaultLimit;
      const [sessionMemories, domainMemories, globalMemories] = await Promise.all([
        args.sessionStore.listMemories({
          scopeType: 'session',
          scopeId: input.session.sessionId,
          limit,
        }),
        args.sessionStore.listMemories({
          scopeType: 'domain',
          scopeId: input.session.domainId,
          limit,
        }),
        args.sessionStore.listMemories({
          scopeType: 'global',
          scopeId: GLOBAL_MEMORY_SCOPE_ID,
          limit,
        }),
      ]);

      const deduped = new Map<string, ManagerMemoryRecord>();
      for (const record of [...sessionMemories, ...domainMemories, ...globalMemories].sort(sortMemories)) {
        const key = `${record.scopeType}:${record.scopeId}:${record.memoryType}:${record.keyText}`;
        if (!deduped.has(key)) {
          deduped.set(key, record);
        }
      }

      return Array.from(deduped.values()).sort(sortMemories).slice(0, limit);
    },

    async persistMemoryWrites(input: {
      session: RuntimeSessionSnapshot;
      runtimePack: DomainRuntimePack;
      writes: MemoryWriteRequest[];
    }): Promise<ManagerMemoryRecord[]> {
      if (!args.sessionStore.upsertMemory || input.writes.length === 0) {
        return [];
      }

      const persisted: ManagerMemoryRecord[] = [];
      for (const write of input.writes) {
        if (
          input.runtimePack.memoryPolicy?.shouldPersist &&
          !input.runtimePack.memoryPolicy.shouldPersist(write)
        ) {
          continue;
        }

        persisted.push(
          await args.sessionStore.upsertMemory({
            scopeType: write.scopeType,
            scopeId: resolveScopeId(write, input.session),
            memoryType: write.memoryType,
            keyText: write.keyText,
            contentText: write.contentText,
            importance: write.importance,
            source: write.source || `runtime:${input.runtimePack.manifest.domainId}`,
          }),
        );
      }

      return persisted.sort(sortMemories);
    },
  };
}

export { GLOBAL_MEMORY_SCOPE_ID };
