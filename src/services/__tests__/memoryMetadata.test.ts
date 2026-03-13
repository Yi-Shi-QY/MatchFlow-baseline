import { beforeEach, describe, expect, it } from 'vitest';
import {
  listDailySummaryMetadata,
  listMemoryMetadata,
  resolveMemoryConflictHint,
  setMemoryMetadataStatus,
  upsertDailySummaryMetadata,
  upsertMemoryMetadata,
} from '@/src/services/memoryMetadata';

describe('memory metadata store', () => {
  beforeEach(() => {
    const map = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        get length() {
          return map.size;
        },
        clear() {
          map.clear();
        },
        getItem(key: string) {
          return map.has(key) ? map.get(key)! : null;
        },
        key(index: number) {
          return Array.from(map.keys())[index] ?? null;
        },
        removeItem(key: string) {
          map.delete(key);
        },
        setItem(key: string, value: string) {
          map.set(key, value);
        },
      } satisfies Storage,
      configurable: true,
    });
    localStorage.clear();
  });

  it('stores UI metadata status and daily summary extraction state without becoming a second memory content source', async () => {
    await upsertMemoryMetadata({
      memoryId: 'memory_1',
      memoryKey: 'domain:football:habit:preferred-league',
      title: '英超优先',
      status: 'pending',
      reasoning: '这是从近期多轮对话中推断出的稳定偏好。',
      reasoningDetails: ['最近 5 次都优先查看英超。'],
      impactSummary: '后续推荐会优先展示英超内容。',
      sourceChain: ['summary:2026-03-13#1'],
      createdAt: 100,
      updatedAt: 100,
    });
    await setMemoryMetadataStatus('memory_1', 'disabled');
    await upsertDailySummaryMetadata({
      summaryId: 'daily_2026_03_13',
      title: '2026-03-13 每日摘要',
      contentText: 'Today the user refined the workspace hierarchy.',
      createdAt: 200,
      updatedAt: 200,
      extractionStatus: 'partial',
      extractedMemoryIds: ['memory_1'],
      similarMemoryIds: [],
    });

    const metadata = await listMemoryMetadata();
    const summaries = await listDailySummaryMetadata();

    expect(metadata[0].status).toBe('disabled');
    expect(summaries[0].extractionStatus).toBe('partial');
  });

  it('resolves duplicate hints in the frozen order: structured key, then source chain, then similar content', () => {
    expect(
      resolveMemoryConflictHint({
        candidate: {
          memoryId: 'candidate',
          structuredKey: 'habit:preferred-league',
          sourceChain: ['summary:1#1'],
          contentText: 'Prefer Premier League first.',
        },
        existing: [
          {
            memoryId: 'memory_existing',
            structuredKey: 'habit:preferred-league',
            sourceChain: ['summary:2#1'],
            contentText: 'Prefer Premier League first.',
          },
        ],
      }).kind,
    ).toBe('structured_key');

    expect(
      resolveMemoryConflictHint({
        candidate: {
          memoryId: 'candidate',
          structuredKey: 'habit:secondary-league',
          sourceChain: ['summary:3#2'],
          contentText: 'Prefer Champions League second.',
        },
        existing: [
          {
            memoryId: 'memory_existing',
            structuredKey: 'habit:another-key',
            sourceChain: ['summary:3#2'],
            contentText: 'Prefer Champions League second.',
          },
        ],
      }).kind,
    ).toBe('source_chain');

    expect(
      resolveMemoryConflictHint({
        candidate: {
          memoryId: 'candidate',
          structuredKey: 'habit:market-style',
          sourceChain: ['summary:4#1'],
          contentText: 'Use concise answers for market checks.',
        },
        existing: [
          {
            memoryId: 'memory_existing',
            structuredKey: 'habit:analysis-style',
            sourceChain: ['summary:9#4'],
            contentText: 'Use concise answers for market check',
          },
        ],
      }).kind,
    ).toBe('similar_content');
  });
});
