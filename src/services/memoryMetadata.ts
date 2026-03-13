import type { LoadedMemoryRecord } from './memoryWorkspace';

const MEMORY_METADATA_STORAGE_KEY = 'matchflow_memory_metadata_v1';

export type MemoryMetadataStatus = 'pending' | 'enabled' | 'disabled';
export type DailySummaryExtractionStatus = 'not_started' | 'completed' | 'partial';
export type MemoryConflictKind =
  | 'none'
  | 'structured_key'
  | 'source_chain'
  | 'similar_content';

export interface MemoryMetadataRecord {
  memoryId: string;
  memoryKey: string;
  title: string;
  status: MemoryMetadataStatus;
  reasoning: string;
  reasoningDetails: string[];
  impactSummary: string;
  sourceChain: string[];
  similarMemoryIds?: string[];
  structuredKey?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DailySummaryMetadataRecord {
  summaryId: string;
  title: string;
  contentText: string;
  createdAt: number;
  updatedAt: number;
  extractionStatus: DailySummaryExtractionStatus;
  extractedMemoryIds: string[];
  similarMemoryIds: string[];
}

interface MemoryMetadataStorage {
  memories: Record<string, MemoryMetadataRecord>;
  dailySummaries: Record<string, DailySummaryMetadataRecord>;
}

interface ConflictCandidate {
  memoryId: string;
  structuredKey?: string;
  sourceChain: string[];
  contentText: string;
}

export interface MemoryConflictHint {
  kind: MemoryConflictKind;
  existingMemoryId: string | null;
}

function buildEmptyStorage(): MemoryMetadataStorage {
  return {
    memories: {},
    dailySummaries: {},
  };
}

function isRecordObject(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === 'object' && !Array.isArray(input);
}

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function normalizeMemoryMetadataRecord(input: unknown): MemoryMetadataRecord | null {
  if (!isRecordObject(input)) {
    return null;
  }

  if (
    typeof input.memoryId !== 'string' ||
    typeof input.memoryKey !== 'string' ||
    typeof input.title !== 'string' ||
    typeof input.reasoning !== 'string' ||
    typeof input.impactSummary !== 'string' ||
    typeof input.createdAt !== 'number' ||
    typeof input.updatedAt !== 'number'
  ) {
    return null;
  }

  const status =
    input.status === 'enabled' || input.status === 'disabled' || input.status === 'pending'
      ? input.status
      : 'pending';

  return {
    memoryId: input.memoryId,
    memoryKey: input.memoryKey,
    title: input.title,
    status,
    reasoning: input.reasoning,
    reasoningDetails: normalizeStringArray(input.reasoningDetails),
    impactSummary: input.impactSummary,
    sourceChain: normalizeStringArray(input.sourceChain),
    similarMemoryIds: normalizeStringArray(input.similarMemoryIds),
    structuredKey: typeof input.structuredKey === 'string' ? input.structuredKey : undefined,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function normalizeDailySummaryRecord(input: unknown): DailySummaryMetadataRecord | null {
  if (!isRecordObject(input)) {
    return null;
  }

  if (
    typeof input.summaryId !== 'string' ||
    typeof input.title !== 'string' ||
    typeof input.contentText !== 'string' ||
    typeof input.createdAt !== 'number' ||
    typeof input.updatedAt !== 'number'
  ) {
    return null;
  }

  const extractionStatus =
    input.extractionStatus === 'completed' ||
    input.extractionStatus === 'partial' ||
    input.extractionStatus === 'not_started'
      ? input.extractionStatus
      : 'not_started';

  return {
    summaryId: input.summaryId,
    title: input.title,
    contentText: input.contentText,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    extractionStatus,
    extractedMemoryIds: normalizeStringArray(input.extractedMemoryIds),
    similarMemoryIds: normalizeStringArray(input.similarMemoryIds),
  };
}

function readStorage(): MemoryMetadataStorage {
  if (typeof localStorage === 'undefined') {
    return buildEmptyStorage();
  }

  try {
    const raw = localStorage.getItem(MEMORY_METADATA_STORAGE_KEY);
    if (!raw) {
      return buildEmptyStorage();
    }

    const parsed = JSON.parse(raw);
    if (!isRecordObject(parsed)) {
      return buildEmptyStorage();
    }

    const memories = isRecordObject(parsed.memories)
      ? Object.fromEntries(
          Object.entries(parsed.memories)
            .map(([key, value]) => [key, normalizeMemoryMetadataRecord(value)])
            .filter((entry): entry is [string, MemoryMetadataRecord] => Boolean(entry[1])),
        )
      : {};
    const dailySummaries = isRecordObject(parsed.dailySummaries)
      ? Object.fromEntries(
          Object.entries(parsed.dailySummaries)
            .map(([key, value]) => [key, normalizeDailySummaryRecord(value)])
            .filter((entry): entry is [string, DailySummaryMetadataRecord] => Boolean(entry[1])),
        )
      : {};

    return {
      memories,
      dailySummaries,
    };
  } catch {
    return buildEmptyStorage();
  }
}

function writeStorage(storage: MemoryMetadataStorage): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(MEMORY_METADATA_STORAGE_KEY, JSON.stringify(storage));
}

function normalizeContentFingerprint(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildDefaultMemoryMetadata(memory: LoadedMemoryRecord): MemoryMetadataRecord {
  const sourceText = typeof memory.source === 'string' ? memory.source.toLowerCase() : '';
  const status: MemoryMetadataStatus =
    sourceText.includes('user') ? 'enabled' : 'pending';
  const reasoning =
    status === 'enabled'
      ? '这是用户明确表达或已经确认启用的长期记忆。'
      : '这是系统推断出的候选记忆，启用前需要先查看理由。';
  const impactSummary =
    status === 'enabled'
      ? '后续推荐和默认行为会继续参考这条记忆。'
      : '如果确认启用，后续推荐和默认行为会开始参考这条记忆。';

  return {
    memoryId: memory.memoryId,
    memoryKey: memory.memoryKey,
    title: memory.title,
    status,
    reasoning,
    reasoningDetails: [memory.contentText],
    impactSummary,
    sourceChain: memory.source ? [String(memory.source)] : [],
    similarMemoryIds: [],
    structuredKey: `${memory.memoryType}:${memory.keyText}`,
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
  };
}

export async function listMemoryMetadata(): Promise<MemoryMetadataRecord[]> {
  const storage = readStorage();
  return Object.values(storage.memories).sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function getMemoryMetadata(memoryId: string): Promise<MemoryMetadataRecord | null> {
  const storage = readStorage();
  return storage.memories[memoryId] || null;
}

export async function upsertMemoryMetadata(
  record: MemoryMetadataRecord,
): Promise<MemoryMetadataRecord> {
  const storage = readStorage();
  storage.memories[record.memoryId] = {
    ...record,
    updatedAt: record.updatedAt || Date.now(),
  };
  writeStorage(storage);
  return storage.memories[record.memoryId];
}

export async function setMemoryMetadataStatus(
  memoryId: string,
  status: MemoryMetadataStatus,
): Promise<MemoryMetadataRecord | null> {
  const storage = readStorage();
  const existing = storage.memories[memoryId];
  if (!existing) {
    return null;
  }

  storage.memories[memoryId] = {
    ...existing,
    status,
    updatedAt: Date.now(),
  };
  writeStorage(storage);
  return storage.memories[memoryId];
}

export async function listDailySummaryMetadata(): Promise<DailySummaryMetadataRecord[]> {
  const storage = readStorage();
  return Object.values(storage.dailySummaries).sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function getDailySummaryMetadata(
  summaryId: string,
): Promise<DailySummaryMetadataRecord | null> {
  const storage = readStorage();
  return storage.dailySummaries[summaryId] || null;
}

export async function upsertDailySummaryMetadata(
  record: DailySummaryMetadataRecord,
): Promise<DailySummaryMetadataRecord> {
  const storage = readStorage();
  storage.dailySummaries[record.summaryId] = {
    ...record,
    updatedAt: record.updatedAt || Date.now(),
  };
  writeStorage(storage);
  return storage.dailySummaries[record.summaryId];
}

export function resolveMemoryConflictHint(input: {
  candidate: ConflictCandidate;
  existing: ConflictCandidate[];
}): MemoryConflictHint {
  const structuredKeyMatch = input.existing.find(
    (entry) =>
      entry.structuredKey &&
      input.candidate.structuredKey &&
      entry.structuredKey === input.candidate.structuredKey,
  );
  if (structuredKeyMatch) {
    return {
      kind: 'structured_key',
      existingMemoryId: structuredKeyMatch.memoryId,
    };
  }

  const sourceChainMatch = input.existing.find((entry) =>
    entry.sourceChain.some((source) => input.candidate.sourceChain.includes(source)),
  );
  if (sourceChainMatch) {
    return {
      kind: 'source_chain',
      existingMemoryId: sourceChainMatch.memoryId,
    };
  }

  const candidateFingerprint = normalizeContentFingerprint(input.candidate.contentText);
  const similarContentMatch = input.existing.find((entry) => {
    const existingFingerprint = normalizeContentFingerprint(entry.contentText);
    return (
      candidateFingerprint.length > 0 &&
      existingFingerprint.length > 0 &&
      (candidateFingerprint === existingFingerprint ||
        candidateFingerprint.includes(existingFingerprint) ||
        existingFingerprint.includes(candidateFingerprint))
    );
  });
  if (similarContentMatch) {
    return {
      kind: 'similar_content',
      existingMemoryId: similarContentMatch.memoryId,
    };
  }

  return {
    kind: 'none',
    existingMemoryId: null,
  };
}
