import { createAutomationId } from '@/src/services/automation/utils';
import { createManagerSessionStore } from '@/src/services/manager-gateway/sessionStore';
import type {
  ManagerGatewaySessionStore,
  ManagerMemoryRecord,
} from '@/src/services/manager-gateway/types';
import type {
  MemoryCandidateConflictKind,
  MemoryCandidateInput,
  MemoryCandidateOrigin,
  MemoryCandidateRecord,
} from './memoryCandidateTypes';

const MEMORY_CANDIDATE_STORE_KEY = 'matchflow_memory_candidate_store_v1';

interface MemoryCandidateStorage {
  schemaVersion: 1;
  candidates: MemoryCandidateRecord[];
}

let memoryCandidateStoreCache: MemoryCandidateStorage | null = null;

function buildEmptyStorage(): MemoryCandidateStorage {
  return {
    schemaVersion: 1,
    candidates: [],
  };
}

function safeParse(input: string | null): unknown {
  if (!input) {
    return null;
  }

  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function cloneCandidate(record: MemoryCandidateRecord): MemoryCandidateRecord {
  return {
    ...record,
    evidence: [...record.evidence],
  };
}

function cloneStorage(storage: MemoryCandidateStorage): MemoryCandidateStorage {
  return {
    schemaVersion: 1,
    candidates: storage.candidates.map(cloneCandidate),
  };
}

function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildFingerprint(input: {
  scopeType: MemoryCandidateRecord['scopeType'];
  scopeId: string;
  memoryType: string;
  keyText: string;
  contentText: string;
}): string {
  return [
    input.scopeType,
    normalizeText(input.scopeId),
    normalizeText(input.memoryType),
    normalizeText(input.keyText),
    normalizeText(input.contentText),
  ].join('::');
}

function buildStructuredKey(input: {
  scopeType: MemoryCandidateRecord['scopeType'];
  scopeId: string;
  memoryType: string;
  keyText: string;
}): string {
  return [
    input.scopeType,
    normalizeText(input.scopeId),
    normalizeText(input.memoryType),
    normalizeText(input.keyText),
  ].join('::');
}

function buildDefaultTitle(input: MemoryCandidateInput): string {
  if (typeof input.title === 'string' && input.title.trim().length > 0) {
    return input.title.trim();
  }

  if (input.keyText === 'analysis-factors') {
    return 'Analysis factor preference';
  }
  if (input.keyText === 'analysis-sequence') {
    return 'Analysis sequence preference';
  }
  if (input.keyText === 'analysis-sequence-habit') {
    return 'Stable analysis sequence habit';
  }
  if (input.memoryType === 'constraint') {
    return 'Explicit constraint';
  }

  return 'Memory candidate';
}

function buildDefaultReasoning(input: MemoryCandidateInput): string {
  if (typeof input.reasoning === 'string' && input.reasoning.trim().length > 0) {
    return input.reasoning.trim();
  }

  if (input.sourceKind === 'explicit_constraint') {
    return 'User explicitly stated a constraint that should remain visible before it is enabled.';
  }
  if (input.sourceKind === 'stable_habit') {
    return 'The same preference appeared repeatedly across user turns, so it may be a stable habit.';
  }

  return 'User explicitly stated a preference that may be worth carrying into future turns.';
}

function normalizeCandidateRecord(input: unknown): MemoryCandidateRecord | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return null;
  }

  const value = input as Record<string, unknown>;
  if (
    typeof value.id !== 'string' ||
    typeof value.fingerprint !== 'string' ||
    typeof value.sourceKind !== 'string' ||
    typeof value.origin !== 'string' ||
    typeof value.status !== 'string' ||
    typeof value.scopeType !== 'string' ||
    typeof value.scopeId !== 'string' ||
    typeof value.memoryType !== 'string' ||
    typeof value.keyText !== 'string' ||
    typeof value.contentText !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.reasoning !== 'string' ||
    typeof value.createdAt !== 'number' ||
    typeof value.updatedAt !== 'number'
  ) {
    return null;
  }

  const status =
    value.status === 'pending' || value.status === 'enabled' || value.status === 'dismissed'
      ? value.status
      : null;
  const sourceKind =
    value.sourceKind === 'explicit_preference' ||
    value.sourceKind === 'explicit_constraint' ||
    value.sourceKind === 'stable_habit' ||
    value.sourceKind === 'automation_result'
      ? value.sourceKind
      : null;
  const origin =
    value.origin === 'manager_turn' || value.origin === 'automation_result'
      ? value.origin
      : null;
  const scopeType =
    value.scopeType === 'global' ||
    value.scopeType === 'domain' ||
    value.scopeType === 'session'
      ? value.scopeType
      : null;
  const conflictKind =
    value.conflictKind === 'memory_content' || value.conflictKind === 'candidate_content'
      ? value.conflictKind
      : 'none';

  if (!status || !sourceKind || !origin || !scopeType) {
    return null;
  }

  return {
    id: value.id,
    fingerprint: value.fingerprint,
    sourceKind,
    origin,
    status,
    scopeType,
    scopeId: value.scopeId,
    memoryType: value.memoryType,
    keyText: value.keyText,
    contentText: value.contentText,
    title: value.title,
    reasoning: value.reasoning,
    evidence: Array.isArray(value.evidence)
      ? value.evidence.filter((entry): entry is string => typeof entry === 'string')
      : [],
    conflictKind,
    conflictMemoryId:
      typeof value.conflictMemoryId === 'string' ? value.conflictMemoryId : null,
    conflictCandidateId:
      typeof value.conflictCandidateId === 'string' ? value.conflictCandidateId : null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    enabledAt: typeof value.enabledAt === 'number' ? value.enabledAt : null,
    dismissedAt: typeof value.dismissedAt === 'number' ? value.dismissedAt : null,
  };
}

function readStorage(): MemoryCandidateStorage {
  if (memoryCandidateStoreCache) {
    return cloneStorage(memoryCandidateStoreCache);
  }

  if (typeof localStorage === 'undefined') {
    memoryCandidateStoreCache = buildEmptyStorage();
    return cloneStorage(memoryCandidateStoreCache);
  }

  const parsed = safeParse(localStorage.getItem(MEMORY_CANDIDATE_STORE_KEY));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    memoryCandidateStoreCache = buildEmptyStorage();
    return cloneStorage(memoryCandidateStoreCache);
  }

  const value = parsed as Record<string, unknown>;
  memoryCandidateStoreCache = {
    schemaVersion: 1,
    candidates: Array.isArray(value.candidates)
      ? value.candidates
          .map(normalizeCandidateRecord)
          .filter((entry): entry is MemoryCandidateRecord => Boolean(entry))
      : [],
  };
  return cloneStorage(memoryCandidateStoreCache);
}

function writeStorage(storage: MemoryCandidateStorage): void {
  memoryCandidateStoreCache = cloneStorage(storage);
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(MEMORY_CANDIDATE_STORE_KEY, JSON.stringify(storage));
}

function compareUpdatedDesc(
  left: MemoryCandidateRecord,
  right: MemoryCandidateRecord,
): number {
  return right.updatedAt - left.updatedAt;
}

function mergeEvidence(
  left: string[],
  right: string[],
): string[] {
  return Array.from(
    new Set(
      [...left, ...right]
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );
}

async function loadRelevantMemories(args: {
  sessionStore?: ManagerGatewaySessionStore;
  candidates: MemoryCandidateInput[];
}): Promise<ManagerMemoryRecord[]> {
  const listMemories = args.sessionStore?.listMemories;
  if (!listMemories || args.candidates.length === 0) {
    return [];
  }

  const uniqueScopes = Array.from(
    new Set(
      args.candidates.map((candidate) => `${candidate.scopeType}::${candidate.scopeId}`),
    ),
  );

  const responses = await Promise.all(
    uniqueScopes.map(async (scopeKey) => {
      const [scopeType, ...scopeIdParts] = scopeKey.split('::');
      const scopeId = scopeIdParts.join('::');
      if (scopeType !== 'global' && scopeType !== 'domain' && scopeType !== 'session') {
        return [];
      }
      return listMemories({
        scopeType,
        scopeId,
        limit: 100,
      });
    }),
  );

  return responses.flat();
}

function findMatchingMemory(
  memories: ManagerMemoryRecord[],
  candidate: MemoryCandidateInput,
): ManagerMemoryRecord | null {
  const structuredKey = buildStructuredKey(candidate);
  const contentFingerprint = normalizeText(candidate.contentText);

  return (
    memories.find((memory) => {
      if (
        buildStructuredKey(memory) !== structuredKey ||
        normalizeText(memory.contentText) !== contentFingerprint
      ) {
        return false;
      }
      return true;
    }) || null
  );
}

function detectConflict(args: {
  candidate: MemoryCandidateInput;
  existingCandidates: MemoryCandidateRecord[];
  existingMemories: ManagerMemoryRecord[];
}): {
  conflictKind: MemoryCandidateConflictKind;
  conflictMemoryId: string | null;
  conflictCandidateId: string | null;
} {
  const structuredKey = buildStructuredKey(args.candidate);
  const contentFingerprint = normalizeText(args.candidate.contentText);

  const conflictingMemory =
    args.existingMemories.find((memory) => {
      if (buildStructuredKey(memory) !== structuredKey) {
        return false;
      }
      return normalizeText(memory.contentText) !== contentFingerprint;
    }) || null;
  if (conflictingMemory) {
    return {
      conflictKind: 'memory_content',
      conflictMemoryId: conflictingMemory.id,
      conflictCandidateId: null,
    };
  }

  const conflictingCandidate =
    args.existingCandidates.find((candidate) => {
      if (buildStructuredKey(candidate) !== structuredKey) {
        return false;
      }
      return normalizeText(candidate.contentText) !== contentFingerprint;
    }) || null;
  if (conflictingCandidate) {
    return {
      conflictKind: 'candidate_content',
      conflictMemoryId: null,
      conflictCandidateId: conflictingCandidate.id,
    };
  }

  return {
    conflictKind: 'none',
    conflictMemoryId: null,
    conflictCandidateId: null,
  };
}

function buildRecord(
  input: MemoryCandidateInput,
  conflict: {
    conflictKind: MemoryCandidateConflictKind;
    conflictMemoryId: string | null;
    conflictCandidateId: string | null;
  },
): MemoryCandidateRecord {
  const createdAt =
    typeof input.createdAt === 'number' && Number.isFinite(input.createdAt)
      ? input.createdAt
      : Date.now();
  const updatedAt =
    typeof input.updatedAt === 'number' && Number.isFinite(input.updatedAt)
      ? input.updatedAt
      : createdAt;

  return {
    id: createAutomationId('memory_candidate'),
    fingerprint: buildFingerprint(input),
    sourceKind: input.sourceKind,
    origin: (input.origin || 'manager_turn') as MemoryCandidateOrigin,
    status: 'pending',
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    memoryType: input.memoryType,
    keyText: input.keyText,
    contentText: input.contentText,
    title: buildDefaultTitle(input),
    reasoning: buildDefaultReasoning(input),
    evidence: mergeEvidence([], input.evidence || [input.contentText]),
    conflictKind: conflict.conflictKind,
    conflictMemoryId: conflict.conflictMemoryId,
    conflictCandidateId: conflict.conflictCandidateId,
    createdAt,
    updatedAt,
    enabledAt: null,
    dismissedAt: null,
  };
}

export async function listMemoryCandidates(input: {
  status?: MemoryCandidateRecord['status'];
  scopeType?: MemoryCandidateRecord['scopeType'];
  scopeId?: string;
} = {}): Promise<MemoryCandidateRecord[]> {
  const storage = readStorage();

  return storage.candidates
    .filter((candidate) => {
      if (input.status && candidate.status !== input.status) {
        return false;
      }
      if (input.scopeType && candidate.scopeType !== input.scopeType) {
        return false;
      }
      if (input.scopeId && candidate.scopeId !== input.scopeId) {
        return false;
      }
      return true;
    })
    .sort(compareUpdatedDesc)
    .map(cloneCandidate);
}

export async function getMemoryCandidate(
  candidateId: string,
): Promise<MemoryCandidateRecord | null> {
  const storage = readStorage();
  const candidate = storage.candidates.find((entry) => entry.id === candidateId);
  return candidate ? cloneCandidate(candidate) : null;
}

export async function persistMemoryCandidates(input: {
  candidates: MemoryCandidateInput[];
  sessionStore?: ManagerGatewaySessionStore;
}): Promise<MemoryCandidateRecord[]> {
  if (!Array.isArray(input.candidates) || input.candidates.length === 0) {
    return [];
  }

  const storage = readStorage();
  const existingMemories = await loadRelevantMemories(input);
  const persisted: MemoryCandidateRecord[] = [];

  for (const candidateInput of input.candidates) {
    if (
      !candidateInput ||
      typeof candidateInput.scopeId !== 'string' ||
      candidateInput.scopeId.trim().length === 0 ||
      typeof candidateInput.memoryType !== 'string' ||
      candidateInput.memoryType.trim().length === 0 ||
      typeof candidateInput.keyText !== 'string' ||
      candidateInput.keyText.trim().length === 0 ||
      typeof candidateInput.contentText !== 'string' ||
      candidateInput.contentText.trim().length === 0
    ) {
      continue;
    }

    const matchingMemory = findMatchingMemory(existingMemories, candidateInput);
    if (matchingMemory) {
      continue;
    }

    const fingerprint = buildFingerprint(candidateInput);
    const existingIndex = storage.candidates.findIndex(
      (candidate) => candidate.fingerprint === fingerprint,
    );
    if (existingIndex >= 0) {
      const existing = storage.candidates[existingIndex];
      const nextRecord: MemoryCandidateRecord = {
        ...existing,
        title: buildDefaultTitle(candidateInput),
        reasoning: buildDefaultReasoning(candidateInput),
        evidence: mergeEvidence(existing.evidence, candidateInput.evidence || []),
        updatedAt:
          typeof candidateInput.updatedAt === 'number' && Number.isFinite(candidateInput.updatedAt)
            ? candidateInput.updatedAt
            : Date.now(),
      };
      storage.candidates[existingIndex] = nextRecord;
      persisted.push(cloneCandidate(nextRecord));
      continue;
    }

    const conflict = detectConflict({
      candidate: candidateInput,
      existingCandidates: storage.candidates,
      existingMemories,
    });
    const record = buildRecord(candidateInput, conflict);
    storage.candidates.push(record);
    persisted.push(cloneCandidate(record));
  }

  writeStorage(storage);
  return persisted;
}

export async function dismissMemoryCandidate(
  candidateId: string,
): Promise<MemoryCandidateRecord | null> {
  const storage = readStorage();
  const index = storage.candidates.findIndex((candidate) => candidate.id === candidateId);
  if (index < 0) {
    return null;
  }

  const now = Date.now();
  const next: MemoryCandidateRecord = {
    ...storage.candidates[index],
    status: 'dismissed',
    dismissedAt: now,
    updatedAt: now,
  };
  storage.candidates[index] = next;
  writeStorage(storage);
  return cloneCandidate(next);
}

export async function enableMemoryCandidate(input: {
  candidateId: string;
  sessionStore?: ManagerGatewaySessionStore;
  contentText?: string;
  title?: string;
}): Promise<{
  candidate: MemoryCandidateRecord | null;
  memory: ManagerMemoryRecord | null;
}> {
  const storage = readStorage();
  const index = storage.candidates.findIndex((candidate) => candidate.id === input.candidateId);
  if (index < 0) {
    return {
      candidate: null,
      memory: null,
    };
  }

  const candidate = storage.candidates[index];
  const sessionStore = input.sessionStore || createManagerSessionStore();
  const upsertMemory = sessionStore.upsertMemory;
  if (!upsertMemory) {
    throw new Error('Memory candidate enable requires a mutable manager memory store.');
  }

  const persistedMemory = await upsertMemory({
    scopeType: candidate.scopeType,
    scopeId: candidate.scopeId,
    memoryType: candidate.memoryType,
    keyText: candidate.keyText,
    contentText:
      typeof input.contentText === 'string' && input.contentText.trim().length > 0
        ? input.contentText.trim()
        : candidate.contentText,
    source: `user_confirmed:${candidate.sourceKind}`,
  });

  const now = Date.now();
  const nextCandidate: MemoryCandidateRecord = {
    ...candidate,
    title:
      typeof input.title === 'string' && input.title.trim().length > 0
        ? input.title.trim()
        : candidate.title,
    contentText:
      typeof input.contentText === 'string' && input.contentText.trim().length > 0
        ? input.contentText.trim()
        : candidate.contentText,
    status: 'enabled',
    enabledAt: now,
    updatedAt: now,
    conflictKind: 'none',
    conflictMemoryId: null,
  };
  storage.candidates[index] = nextCandidate;
  writeStorage(storage);

  return {
    candidate: cloneCandidate(nextCandidate),
    memory: { ...persistedMemory },
  };
}

export function clearMemoryCandidateStoreFallback(): void {
  memoryCandidateStoreCache = null;
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.removeItem(MEMORY_CANDIDATE_STORE_KEY);
}
