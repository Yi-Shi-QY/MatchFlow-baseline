import { describe, expect, it } from 'vitest';
import type {
  LoadedMemoryCandidate,
  LoadedMemoryRecord,
} from '@/src/services/memoryWorkspace';
import type {
  DailySummaryMetadataRecord,
  MemoryMetadataRecord,
} from '@/src/services/memoryMetadata';
import { deriveMemoryWorkspaceModel } from '@/src/pages/memory/memoryWorkspaceModel';

function createMemory(
  id: string,
  overrides: Partial<LoadedMemoryRecord> = {},
): LoadedMemoryRecord {
  return {
    memoryId: id,
    memoryKey: `domain:football:habit:${id}`,
    scopeType: 'domain',
    scopeId: 'football',
    memoryType: 'habit',
    keyText: id,
    title: id,
    contentText: `${id} content`,
    importance: 0.8,
    source: 'system',
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

function createCandidate(
  id: string,
  overrides: Partial<LoadedMemoryCandidate> = {},
): LoadedMemoryCandidate {
  return {
    candidateId: id,
    candidateKey: `domain:football:preference:${id}`,
    status: 'pending',
    scopeType: 'domain',
    scopeId: 'football',
    memoryType: 'preference',
    keyText: id,
    title: id,
    contentText: `${id} candidate content`,
    reasoning: 'Candidate reasoning',
    evidence: ['Candidate detail'],
    conflictKind: 'none',
    conflictMemoryId: null,
    conflictCandidateId: null,
    createdAt: 150,
    updatedAt: 150,
    ...overrides,
  };
}

function createMetadata(
  memoryId: string,
  overrides: Partial<MemoryMetadataRecord> = {},
): MemoryMetadataRecord {
  return {
    memoryId,
    memoryKey: `domain:football:habit:${memoryId}`,
    title: memoryId,
    status: 'pending',
    reasoning: 'Reasoning text',
    reasoningDetails: ['Reason detail'],
    impactSummary: 'Impact text',
    sourceChain: ['summary:1#1'],
    similarMemoryIds: [],
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

function createDailySummary(
  summaryId: string,
  overrides: Partial<DailySummaryMetadataRecord> = {},
): DailySummaryMetadataRecord {
  return {
    summaryId,
    title: summaryId,
    contentText: 'Summary content',
    createdAt: 200,
    updatedAt: 200,
    extractionStatus: 'partial',
    extractedMemoryIds: ['memory_enabled'],
    similarMemoryIds: [],
    ...overrides,
  };
}

describe('memory workspace model', () => {
  it('keeps the frozen section order and surfaces pending candidates before enabled memories', () => {
    const model = deriveMemoryWorkspaceModel({
      candidates: [
        createCandidate('candidate_pending', { status: 'pending', updatedAt: 300 }),
        createCandidate('candidate_dismissed', { status: 'dismissed', updatedAt: 120 }),
      ],
      memories: [
        createMemory('memory_pending'),
        createMemory('memory_enabled'),
        createMemory('memory_disabled'),
      ],
      metadataRecords: [
        createMetadata('memory_pending', { status: 'pending' }),
        createMetadata('memory_enabled', { status: 'enabled' }),
        createMetadata('memory_disabled', { status: 'disabled' }),
      ],
      dailySummaries: [createDailySummary('daily_2026_03_13')],
      language: 'zh',
    });

    expect(model.sections.map((section) => section.id)).toEqual([
      'summary',
      'pending',
      'enabled',
      'daily_summary',
      'disabled',
    ]);
    expect(model.pendingCards[0].memoryId).toBe('candidate_pending');
    expect(model.pendingCards[0].actions).toContain('查看理由');
    expect(model.enabledCards[0].memoryId).toBe('memory_enabled');
    expect(model.disabledCards.map((card) => card.memoryId)).toContain('candidate_dismissed');
    expect(model.dailySummaryCards[0].ctaLabel).toBe('查看提炼结果');
  });
});
