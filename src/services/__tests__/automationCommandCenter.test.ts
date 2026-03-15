import { describe, expect, it, vi } from 'vitest';
import {
  finalizeAutomationDraftsForComposer,
  resolveImmediateAnalysisNavigation,
  summarizeManagerResponse,
} from '@/src/services/automation/commandCenter';
import { parseAutomationCommand } from '@/src/services/automation/parser';

const mocks = vi.hoisted(() => ({
  assembleAutomationJob: vi.fn(),
}));

vi.mock('@/src/services/automation/jobAssembler', () => ({
  assembleAutomationJob: mocks.assembleAutomationJob,
}));

describe('automation command center', () => {
  it('turns a single no-time command into a run-now draft in smart mode', () => {
    const drafts = parseAutomationCommand('Analyze Real Madrid vs Barcelona', {
      defaultDomainId: 'football',
      now: new Date('2026-03-11T09:00:00.000Z'),
    });

    const finalized = finalizeAutomationDraftsForComposer(
      'Analyze Real Madrid vs Barcelona',
      drafts,
      {
        composerMode: 'smart',
        now: new Date('2026-03-11T09:00:00.000Z'),
      },
    );

    expect(finalized).toHaveLength(1);
    expect(finalized[0].activationMode).toBe('run_now');
    expect(finalized[0].schedule?.type).toBe('one_time');
    expect(finalized[0].status).toBe('ready');
  });

  it('keeps explicit scheduled commands in save-only mode', () => {
    const drafts = parseAutomationCommand(
      'Tonight at 20:00 analyze Real Madrid vs Barcelona and notify me',
      {
        defaultDomainId: 'football',
        now: new Date('2026-03-11T09:00:00.000Z'),
      },
    );

    const finalized = finalizeAutomationDraftsForComposer(
      'Tonight at 20:00 analyze Real Madrid vs Barcelona and notify me',
      drafts,
      {
        composerMode: 'smart',
        now: new Date('2026-03-11T09:00:00.000Z'),
      },
    );

    expect(finalized[0].activationMode).toBe('save_only');
    expect(finalized[0].status).toBe('ready');
  });

  it('builds a direct manager response with inline-edit guidance', () => {
    const drafts = parseAutomationCommand(
      'Tonight analyze Premier League and remind me',
      {
        defaultDomainId: 'football',
        now: new Date('2026-03-11T09:00:00.000Z'),
      },
    );

    const finalized = finalizeAutomationDraftsForComposer(
      'Tonight analyze Premier League and remind me',
      drafts,
      {
        composerMode: 'automation',
        now: new Date('2026-03-11T09:00:00.000Z'),
      },
    );

    const summary = summarizeManagerResponse(finalized, {
      composerMode: 'automation',
      language: 'en',
    });

    expect(summary.totalDrafts).toBe(finalized.length);
    expect(summary.message).toContain('manager');
    expect(summary.message).toContain('conversation');
  });

  it('navigates immediate analysis drafts to a single target route', async () => {
    const [draft] = finalizeAutomationDraftsForComposer(
      'Analyze Real Madrid vs Barcelona',
      parseAutomationCommand('Analyze Real Madrid vs Barcelona', {
        defaultDomainId: 'football',
        now: new Date('2026-03-11T09:00:00.000Z'),
      }),
      {
        composerMode: 'smart',
        now: new Date('2026-03-11T09:00:00.000Z'),
      },
    );

    mocks.assembleAutomationJob.mockResolvedValue({
      job: {},
      targets: [
        {
          jobId: 'preview',
          domainId: 'football',
          subjectId: 'match-1',
          subjectType: 'match',
          title: 'Real Madrid vs Barcelona',
          match: {},
          dataToAnalyze: {
            id: 'match-1',
            league: 'La Liga',
          },
        },
      ],
      targetSnapshot: [],
    });

    const result = await resolveImmediateAnalysisNavigation(draft, 'en');

    expect(result.status).toBe('ready');
    expect(result.navigation?.route).toBe('/subject/football/match-1');
    expect(result.navigation?.state.subjectType).toBe('match');
    expect(result.navigation?.state.openAnalysisWorkbench).toBe(true);
    expect(result.navigation?.state.autoStartAnalysis).toBe(true);
  });

  it('rejects immediate navigation when the command expands to multiple targets', async () => {
    const [draft] = finalizeAutomationDraftsForComposer(
      'Analyze Real Madrid vs Barcelona',
      parseAutomationCommand('Analyze Real Madrid vs Barcelona', {
        defaultDomainId: 'football',
        now: new Date('2026-03-11T09:00:00.000Z'),
      }),
      {
        composerMode: 'smart',
        now: new Date('2026-03-11T09:00:00.000Z'),
      },
    );

    mocks.assembleAutomationJob.mockResolvedValue({
      job: {},
      targets: [
        {
          jobId: 'preview',
          domainId: 'football',
          subjectId: 'match-1',
          subjectType: 'match',
          title: 'One',
          match: {},
          dataToAnalyze: {},
        },
        {
          jobId: 'preview',
          domainId: 'football',
          subjectId: 'match-2',
          subjectType: 'match',
          title: 'Two',
          match: {},
          dataToAnalyze: {},
        },
      ],
      targetSnapshot: [],
    });

    const result = await resolveImmediateAnalysisNavigation(draft, 'en');

    expect(result.status).toBe('unsupported');
    expect(result.message).toContain('multiple targets');
  });
});
