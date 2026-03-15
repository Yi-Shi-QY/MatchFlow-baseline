import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainEvent } from '@/src/domains/runtime/types';
import {
  executeManagerContinueTaskIntake,
  executeManagerQueryLocalMatches,
  managerContinueTaskIntakeDeclaration,
} from '@/src/services/manager/toolRegistry';
import {
  listRuntimeManagerBuiltinSkillEntries,
  listRuntimeManagerToolIdsForDomain,
  supportsRuntimeManagerTool,
} from '@/src/services/manager/runtimeToolRegistry';

const mocks = vi.hoisted(() => ({
  resolveDomainEventFeed: vi.fn(),
}));

vi.mock('@/src/services/domainMatchFeed', () => ({
  resolveDomainEventFeed: mocks.resolveDomainEventFeed,
}));

function createEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    domainId: 'football',
    eventType: 'match',
    eventId: 'm1',
    title: 'Arsenal vs Manchester City',
    subjectRefs: [],
    startTime: '2026-03-12T12:00:00.000Z',
    status: 'upcoming',
    metadata: {
      league: 'Premier League',
      kickoffAt: '2026-03-12T12:00:00.000Z',
      matchData: {
        id: 'm1',
        league: 'Premier League',
        date: '2026-03-12T12:00:00.000Z',
        status: 'upcoming',
        homeTeam: {
          id: 'h1',
          name: 'Arsenal',
          logo: '',
          form: [],
        },
        awayTeam: {
          id: 'a1',
          name: 'Manchester City',
          logo: '',
          form: [],
        },
      },
    },
    ...overrides,
  };
}

describe('manager tool registry', () => {
  beforeEach(() => {
    mocks.resolveDomainEventFeed.mockReset();
    mocks.resolveDomainEventFeed.mockResolvedValue([]);
  });

  it('queries local matches through the shared domain event feed', async () => {
    mocks.resolveDomainEventFeed.mockResolvedValue([createEvent()]);

    const result = await executeManagerQueryLocalMatches({
      sourceText: 'What Premier League matches are on today?',
      domainId: 'football',
      language: 'en',
    });

    expect(mocks.resolveDomainEventFeed).toHaveBeenCalledWith({
      domainId: 'football',
      filters: {
        leagueTerms: ['Premier League'],
        matchDate: expect.any(String),
        statuses: undefined,
      },
      signal: undefined,
    });
    expect(result.agentText).toContain('Arsenal vs Manchester City');
    expect(result.messageKind).toBe('text');
  });

  it('returns an empty-result message when the shared event feed has no match records', async () => {
    const result = await executeManagerQueryLocalMatches({
      sourceText: 'What La Liga matches are on today?',
      domainId: 'football',
      language: 'en',
    });

    expect(result.agentText).toContain('found no');
  });

  it('derives available manager skills from runtime-pack registrations', () => {
    expect(listRuntimeManagerBuiltinSkillEntries().map((entry) => entry.id)).toEqual([
      'manager_query_local_matches',
      'manager_describe_capability',
      'manager_prepare_task_intake',
      'manager_continue_task_intake',
      'manager_help',
    ]);
    expect(listRuntimeManagerToolIdsForDomain('football')).toEqual([
      'manager_query_local_matches',
      'manager_describe_capability',
      'manager_prepare_task_intake',
      'manager_continue_task_intake',
      'manager_help',
    ]);
    expect(supportsRuntimeManagerTool('football', 'manager_help')).toBe(true);
    expect(supportsRuntimeManagerTool('football', 'manager_unknown')).toBe(false);
  });

  it('exposes generic continue-task-intake arguments while keeping legacy pendingTask optional', () => {
    const parameters = managerContinueTaskIntakeDeclaration.parameters as {
      properties?: Record<string, unknown>;
      required?: string[];
    };

    expect(parameters.properties?.intakeWorkflow).toBeDefined();
    expect(parameters.properties?.pendingTask).toBeDefined();
    expect(parameters.properties?.domainId).toBeDefined();
    expect(parameters.required).toEqual(['answer', 'language']);
  });

  it('returns a concrete retry message when continue-task-intake is called without active state', async () => {
    const result = await executeManagerContinueTaskIntake({
      domainId: 'football',
      answer: 'default',
      language: 'en',
    });

    expect(result.messageKind).toBe('text');
    expect(result.agentText).toContain('There is no active task intake to continue');
    expect(result.intakeWorkflow).toBeNull();
  });
});
