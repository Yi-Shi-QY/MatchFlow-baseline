import { GLOBAL_MEMORY_SCOPE_ID } from '@/src/services/manager-gateway/memoryService';
import { createManagerSessionStore } from '@/src/services/manager-gateway/sessionStore';
import type { ManagerMemoryRecord } from '@/src/services/manager-gateway/types';

export interface LoadedMemoryRecord {
  memoryId: string;
  memoryKey: string;
  scopeType: ManagerMemoryRecord['scopeType'];
  scopeId: string;
  memoryType: string;
  keyText: string;
  title: string;
  contentText: string;
  importance?: number | null;
  source?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface LoadedMemoryWorkspace {
  sessionId: string;
  memories: LoadedMemoryRecord[];
}

function buildMemoryKey(record: ManagerMemoryRecord): string {
  return `${record.scopeType}:${record.scopeId}:${record.memoryType}:${record.keyText}`;
}

function sortMemories(left: ManagerMemoryRecord, right: ManagerMemoryRecord): number {
  const importanceDelta = (right.importance || 0) - (left.importance || 0);
  if (importanceDelta !== 0) {
    return importanceDelta;
  }
  return right.updatedAt - left.updatedAt;
}

function mapMemoryRecord(record: ManagerMemoryRecord): LoadedMemoryRecord {
  return {
    memoryId: record.id,
    memoryKey: buildMemoryKey(record),
    scopeType: record.scopeType,
    scopeId: record.scopeId,
    memoryType: record.memoryType,
    keyText: record.keyText,
    title: record.keyText,
    contentText: record.contentText,
    importance: record.importance,
    source: record.source,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function loadMemoryWorkspace(input: {
  domainId: string;
  runtimeDomainVersion?: string | null;
}): Promise<LoadedMemoryWorkspace> {
  const store = createManagerSessionStore();
  const session = await store.getOrCreateMainSession({
    domainId: input.domainId,
    runtimeDomainVersion: input.runtimeDomainVersion,
  });

  const [globalMemories, domainMemories, sessionMemories] = await Promise.all([
    store.listMemories?.({
      scopeType: 'global',
      scopeId: GLOBAL_MEMORY_SCOPE_ID,
      limit: 100,
    }) || Promise.resolve([]),
    store.listMemories?.({
      scopeType: 'domain',
      scopeId: input.domainId,
      limit: 100,
    }) || Promise.resolve([]),
    store.listMemories?.({
      scopeType: 'session',
      scopeId: session.id,
      limit: 100,
    }) || Promise.resolve([]),
  ]);

  const deduped = new Map<string, ManagerMemoryRecord>();
  [...globalMemories, ...domainMemories, ...sessionMemories]
    .sort(sortMemories)
    .forEach((record) => {
      const key = buildMemoryKey(record);
      if (!deduped.has(key)) {
        deduped.set(key, record);
      }
    });

  return {
    sessionId: session.id,
    memories: Array.from(deduped.values()).sort(sortMemories).map(mapMemoryRecord),
  };
}
