import { beforeEach, describe, expect, it } from 'vitest';

describe('manager execution ticket store', () => {
  beforeEach(() => {
    if (typeof globalThis.localStorage === 'undefined') {
      const storage = new Map<string, string>();
      Object.defineProperty(globalThis, 'localStorage', {
        value: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => {
            storage.set(key, value);
          },
          removeItem: (key: string) => {
            storage.delete(key);
          },
          clear: () => {
            storage.clear();
          },
        },
        configurable: true,
      });
    }

    localStorage.clear();
  });

  it('creates a pending confirmation ticket for run-now execution', async () => {
    const { createExecutionTicket } = await import(
      '@/src/services/manager-workspace/executionTicketStore'
    );

    const ticket = await createExecutionTicket({
      source: 'command_center',
      executionMode: 'run_now',
      draftId: 'draft_run_now',
      title: 'Analyze Real Madrid vs Barcelona',
      target: {
        domainId: 'football',
        subjectId: 'match_1',
        targetLabel: 'Real Madrid vs Barcelona',
        scheduledFor: '2026-03-13T12:00:00.000Z',
      },
      draftSnapshot: {
        sourceText: 'Analyze Real Madrid vs Barcelona',
        title: 'Analyze Real Madrid vs Barcelona',
        intentType: 'one_time',
        activationMode: 'run_now',
        schedule: {
          type: 'one_time',
          runAt: '2026-03-13T12:00:00.000Z',
          timezone: 'Asia/Shanghai',
        },
        targetSelector: {
          mode: 'fixed_subject',
          subjectId: 'match_1',
          subjectLabel: 'Real Madrid vs Barcelona',
        },
      },
    });

    expect(ticket.status).toBe('pending_confirmation');
    expect(ticket.executionMode).toBe('run_now');
    expect(ticket.draftId).toBe('draft_run_now');
  });

  it('creates a pending confirmation ticket for scheduled automation', async () => {
    const { createExecutionTicket } = await import(
      '@/src/services/manager-workspace/executionTicketStore'
    );

    const ticket = await createExecutionTicket({
      source: 'command_center',
      executionMode: 'scheduled',
      draftId: 'draft_scheduled',
      title: 'Tonight Arsenal vs Manchester City',
      target: {
        domainId: 'football',
        targetLabel: 'Arsenal vs Manchester City',
        scheduledFor: '2026-03-13T20:00:00.000Z',
      },
      draftSnapshot: {
        sourceText: 'Tonight at 20:00 analyze Arsenal vs Manchester City',
        title: 'Tonight Arsenal vs Manchester City',
        intentType: 'one_time',
        activationMode: 'save_only',
        schedule: {
          type: 'one_time',
          runAt: '2026-03-13T20:00:00.000Z',
          timezone: 'Asia/Shanghai',
        },
        targetSelector: {
          mode: 'fixed_subject',
          subjectId: 'match_2',
          subjectLabel: 'Arsenal vs Manchester City',
        },
      },
    });

    expect(ticket.status).toBe('pending_confirmation');
    expect(ticket.executionMode).toBe('scheduled');
    expect(ticket.target.scheduledFor).toBe('2026-03-13T20:00:00.000Z');
  });

  it('maps ticket state from draft to confirmed to running to completed', async () => {
    const {
      createExecutionTicket,
      getExecutionTicketByDraftId,
      getExecutionTicketByJobId,
      getExecutionTicketByRunId,
      patchExecutionTicket,
    } = await import('@/src/services/manager-workspace/executionTicketStore');

    const created = await createExecutionTicket({
      source: 'command_center',
      executionMode: 'scheduled',
      draftId: 'draft_transition',
      title: 'Daily Premier League scan',
      target: {
        domainId: 'football',
        targetLabel: 'Premier League',
        scheduledFor: '2026-03-14T01:00:00.000Z',
      },
      draftSnapshot: {
        sourceText: 'Every day at 09:00 analyze Premier League',
        title: 'Daily Premier League scan',
        intentType: 'recurring',
        activationMode: 'save_only',
        schedule: {
          type: 'daily',
          time: '09:00',
          timezone: 'Asia/Shanghai',
        },
        targetSelector: {
          mode: 'league_query',
          leagueKey: 'epl',
          leagueLabel: 'Premier League',
        },
      },
    });

    await patchExecutionTicket({
      draftId: 'draft_transition',
      patch: {
        status: 'confirmed',
        jobId: 'job_1',
      },
    });

    const confirmed = await getExecutionTicketByDraftId('draft_transition');
    expect(confirmed?.id).toBe(created.id);
    expect(confirmed?.status).toBe('confirmed');
    expect(confirmed?.jobId).toBe('job_1');

    await patchExecutionTicket({
      jobId: 'job_1',
      patch: {
        status: 'running',
        runId: 'run_1',
      },
    });

    const running = await getExecutionTicketByJobId('job_1');
    expect(running?.status).toBe('running');
    expect(running?.runId).toBe('run_1');

    await patchExecutionTicket({
      runId: 'run_1',
      patch: {
        status: 'completed',
      },
    });

    const completed = await getExecutionTicketByRunId('run_1');
    expect(completed?.status).toBe('completed');
    expect(completed?.jobId).toBe('job_1');
  });
});
