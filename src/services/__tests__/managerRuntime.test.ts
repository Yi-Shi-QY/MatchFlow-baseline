import { beforeEach, describe, expect, it } from 'vitest';
import { parsePendingTaskFromWorkflow } from '@/src/domains/runtime/football/tools';
import type { ManagerSessionProjection } from '@/src/services/manager-gateway/types';
import { listAutomationDrafts } from '@/src/services/automation/draftStore';
import { resetManagerGatewayForTests } from '@/src/services/manager-gateway/service';
import { clearManagerSessionStoreFallback } from '@/src/services/manager-gateway/sessionStore';
import {
  submitManagerTurn,
  submitManagerTurnProjectionResult,
} from '@/src/services/manager/runtime';
import { DEFAULT_SETTINGS, saveSettings } from '@/src/services/settings';

function getLastFeedBlock(projection: ManagerSessionProjection) {
  const lastBlock = projection.feed[projection.feed.length - 1];
  expect(lastBlock).toBeDefined();
  return lastBlock!;
}

function parsePayload(payloadData: string | null | undefined): Record<string, unknown> | null {
  if (!payloadData) {
    return null;
  }
  return JSON.parse(payloadData) as Record<string, unknown>;
}

describe('manager runtime', () => {
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
    clearManagerSessionStoreFallback();
    resetManagerGatewayForTests();
    saveSettings({ ...DEFAULT_SETTINGS });
  });

  it('returns projection-first feed blocks when AI configuration is required', async () => {
    const result = await submitManagerTurnProjectionResult({
      input: 'Today what matches are on?',
      language: 'en',
      domainId: 'football',
      domainName: 'Football',
      allowHeuristicFallback: false,
    });

    const lastBlock = getLastFeedBlock(result.projection);
    const payload = parsePayload(lastBlock.payloadData);

    expect(lastBlock.role).toBe('assistant');
    expect(lastBlock.blockType).toBe('assistant_text');
    expect(lastBlock.text).toContain('API key');
    expect(payload).toMatchObject({
      action: {
        type: 'open_settings',
      },
    });
    expect(result.shouldRefreshTaskState).toBe(false);
  });

  it('answers fixture queries through the projection-first runtime result', async () => {
    const result = await submitManagerTurnProjectionResult({
      input: 'What Premier League matches are on tomorrow?',
      language: 'en',
      domainId: 'football',
      domainName: 'Football',
    });

    const lastBlock = getLastFeedBlock(result.projection);

    expect(lastBlock.role).toBe('assistant');
    expect(lastBlock.text).toContain('Premier League');
    expect(lastBlock.text).toContain('Arsenal');
    expect(result.projection.activeWorkflow).toBeNull();
  });

  it('keeps task intake progress in projection workflow state until the draft is ready', async () => {
    const firstTurn = await submitManagerTurnProjectionResult({
      input: 'Tonight at 20:00 analyze Real Madrid vs Barcelona and notify me',
      language: 'en',
      domainId: 'football',
      domainName: 'Football',
    });

    expect(parsePendingTaskFromWorkflow(firstTurn.projection.activeWorkflow)?.stage).toBe(
      'await_factors',
    );
    expect(getLastFeedBlock(firstTurn.projection).text).toContain('prioritize');

    const secondTurn = await submitManagerTurnProjectionResult({
      input: 'fundamentals and market',
      language: 'en',
      domainId: 'football',
      domainName: 'Football',
    });

    expect(parsePendingTaskFromWorkflow(secondTurn.projection.activeWorkflow)?.stage).toBe(
      'await_sequence',
    );
    expect(getLastFeedBlock(secondTurn.projection).text).toContain('analysis order');

    const thirdTurn = await submitManagerTurnProjectionResult({
      input: 'fundamentals first, then market, then final prediction',
      language: 'en',
      domainId: 'football',
      domainName: 'Football',
    });

    const lastBlock = getLastFeedBlock(thirdTurn.projection);
    const payload = parsePayload(lastBlock.payloadData);
    const drafts = await listAutomationDrafts();

    expect(parsePendingTaskFromWorkflow(thirdTurn.projection.activeWorkflow)).toBeNull();
    expect(thirdTurn.shouldRefreshTaskState).toBe(true);
    expect(lastBlock.blockType).toBe('draft_bundle');
    expect(Array.isArray(payload?.draftIds)).toBe(true);
    expect((payload?.draftIds as unknown[]).length).toBeGreaterThan(0);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].analysisProfile?.selectedSourceIds).toEqual([
      'fundamental',
      'market',
    ]);
    expect(drafts[0].analysisProfile?.sequencePreference).toEqual([
      'fundamental',
      'market',
      'prediction',
    ]);
  });

  it('still derives a legacy snapshot for compatibility callers that need it', async () => {
    const result = await submitManagerTurn({
      input: 'What Premier League matches are on tomorrow?',
      language: 'en',
      domainId: 'football',
      domainName: 'Football',
    });

    const lastMessage = result.messages[result.messages.length - 1];

    expect(lastMessage.role).toBe('agent');
    expect(lastMessage.text).toContain('Premier League');
    expect(lastMessage.text).toContain('Arsenal');
    expect(result.pendingTask).toBeNull();
  });
});
