import { GLOBAL_MEMORY_SCOPE_ID } from '@/src/services/manager-gateway/memoryService';
import { createManagerSessionStore } from '@/src/services/manager-gateway/sessionStore';
import type { ManagerMemoryRecord } from '@/src/services/manager-gateway/types';
import { listMemoryCandidates } from '@/src/services/memoryCandidateStore';
import type {
  MemoryCandidateConflictKind,
  MemoryCandidateStatus,
} from '@/src/services/memoryCandidateTypes';

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

export interface LoadedMemoryCandidate {
  candidateId: string;
  candidateKey: string;
  status: MemoryCandidateStatus;
  scopeType: ManagerMemoryRecord['scopeType'];
  scopeId: string;
  memoryType: string;
  keyText: string;
  title: string;
  contentText: string;
  reasoning: string;
  evidence: string[];
  conflictKind: MemoryCandidateConflictKind;
  conflictMemoryId: string | null;
  conflictCandidateId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface LoadedMemoryWorkspace {
  sessionId: string;
  memories: LoadedMemoryRecord[];
  candidates: LoadedMemoryCandidate[];
}

function buildMemoryKey(record: Pick<
  ManagerMemoryRecord,
  'scopeType' | 'scopeId' | 'memoryType' | 'keyText'
>): string {
  return `${record.scopeType}:${record.scopeId}:${record.memoryType}:${record.keyText}`;
}

function buildCandidateKey(record: Pick<
  LoadedMemoryCandidate,
  'scopeType' | 'scopeId' | 'memoryType' | 'keyText'
>): string {
  return `${record.scopeType}:${record.scopeId}:${record.memoryType}:${record.keyText}`;
}

function sortMemories(left: ManagerMemoryRecord, right: ManagerMemoryRecord): number {
  const importanceDelta = (right.importance || 0) - (left.importance || 0);
  if (importanceDelta !== 0) {
    return importanceDelta;
  }
  return right.updatedAt - left.updatedAt;
}

function sortCandidates(
  left: LoadedMemoryCandidate,
  right: LoadedMemoryCandidate,
): number {
  if (left.status !== right.status) {
    return left.status === 'pending' ? -1 : 1;
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

function isCandidateVisible(args: {
  candidate: {
    status: MemoryCandidateStatus;
    scopeType: ManagerMemoryRecord['scopeType'];
    scopeId: string;
  };
  domainId: string;
  sessionId: string;
}): boolean {
  if (args.candidate.status === 'enabled') {
    return false;
  }

  if (args.candidate.scopeType === 'global') {
    return args.candidate.scopeId === GLOBAL_MEMORY_SCOPE_ID;
  }
  if (args.candidate.scopeType === 'domain') {
    return args.candidate.scopeId === args.domainId;
  }
  return args.candidate.scopeId === args.sessionId;
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

  const [globalMemories, domainMemories, sessionMemories, rawCandidates] = await Promise.all([
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
    listMemoryCandidates(),
  ]);

  const dedupedMemories = new Map<string, ManagerMemoryRecord>();
  [...globalMemories, ...domainMemories, ...sessionMemories]
    .sort(sortMemories)
    .forEach((record) => {
      const key = buildMemoryKey(record);
      if (!dedupedMemories.has(key)) {
        dedupedMemories.set(key, record);
      }
    });

  const candidates = rawCandidates
    .filter((candidate) =>
      isCandidateVisible({
        candidate,
        domainId: input.domainId,
        sessionId: session.id,
      }),
    )
    .map<LoadedMemoryCandidate>((candidate) => ({
      candidateId: candidate.id,
      candidateKey: buildCandidateKey(candidate),
      status: candidate.status,
      scopeType: candidate.scopeType,
      scopeId: candidate.scopeId,
      memoryType: candidate.memoryType,
      keyText: candidate.keyText,
      title: candidate.title,
      contentText: candidate.contentText,
      reasoning: candidate.reasoning,
      evidence: [...candidate.evidence],
      conflictKind: candidate.conflictKind,
      conflictMemoryId: candidate.conflictMemoryId,
      conflictCandidateId: candidate.conflictCandidateId,
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
    }))
    .sort(sortCandidates);

  return {
    sessionId: session.id,
    memories: Array.from(dedupedMemories.values()).sort(sortMemories).map(mapMemoryRecord),
    candidates,
  };
}
