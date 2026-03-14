import { describe, expect, it } from 'vitest';
import type { ManagerSessionProjection } from '@/src/services/manager-gateway/types';
import { projectManagerSessionProjectionToRunStatusModel } from '@/src/pages/command/runStatusModel';

function createProjection(): ManagerSessionProjection {
  return {
    session: {
      id: 'session_main',
      sessionKey: 'manager:main',
      title: 'Main session',
      status: 'active',
      domainId: 'football',
      runtimeDomainVersion: '1.0.0',
      activeWorkflowType: null,
      activeWorkflowStateData: null,
      latestSummaryId: null,
      latestMessageAt: 300,
      createdAt: 100,
      updatedAt: 300,
    },
    runtimeDomainId: 'football',
    runtimeDomainVersion: '1.0.0',
    activeRun: {
      id: 'manager_run_1234567890',
      sessionId: 'session_main',
      inputMessageId: 'message_1',
      status: 'running',
      triggerType: 'user',
      plannerMode: 'deterministic',
      intentType: 'query',
      toolPath: 'tool:football',
      errorCode: null,
      errorMessage: null,
      stateData: null,
      startedAt: 1710000000000,
      finishedAt: null,
      createdAt: 1710000000000,
      updatedAt: 1710000005000,
    },
    latestRun: {
      id: 'manager_run_1234567890',
      sessionId: 'session_main',
      inputMessageId: 'message_1',
      status: 'completed',
      triggerType: 'user',
      plannerMode: 'deterministic',
      intentType: 'query',
      toolPath: 'tool:football',
      errorCode: null,
      errorMessage: null,
      stateData: null,
      startedAt: 1710000000000,
      finishedAt: 1710000005000,
      createdAt: 1710000000000,
      updatedAt: 1710000005000,
    },
    activeWorkflow: null,
    feed: [],
  };
}

describe('command center run status model', () => {
  it('projects an active running run into a visible status model', () => {
    const model = projectManagerSessionProjectionToRunStatusModel({
      projection: createProjection(),
      isSubmitting: false,
      submitError: null,
      language: 'en',
    });

    expect(model).toMatchObject({
      state: 'running',
      badgeLabel: 'Running',
      title: 'Working on your latest request',
      actionLabel: 'Stop request',
    });
    expect(model?.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'run_id',
        }),
        expect.objectContaining({
          id: 'planner',
          value: 'Deterministic',
        }),
      ]),
    );
  });

  it('projects a queued active run ahead of local submitting state', () => {
    const model = projectManagerSessionProjectionToRunStatusModel({
      projection: {
        ...createProjection(),
        activeRun: {
          ...createProjection().activeRun!,
          status: 'queued',
          plannerMode: null,
        },
      },
      isSubmitting: true,
      submitError: null,
      language: 'en',
    });

    expect(model).toMatchObject({
      state: 'queued',
      badgeLabel: 'Queued',
      title: 'Waiting for the previous step to finish',
      actionLabel: 'Cancel pending request',
    });
  });

  it('falls back to a local submitting model when no active run is loaded yet', () => {
    const model = projectManagerSessionProjectionToRunStatusModel({
      projection: {
        ...createProjection(),
        activeRun: null,
      },
      isSubmitting: true,
      submitError: null,
      language: 'en',
    });

    expect(model).toMatchObject({
      state: 'submitting',
      badgeLabel: 'Submitting',
      title: 'Starting your request',
    });
    expect(model?.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'session',
          value: 'Main session',
        }),
      ]),
    );
  });

  it('projects a local failure when the submit request errors', () => {
    const model = projectManagerSessionProjectionToRunStatusModel({
      projection: {
        ...createProjection(),
        activeRun: null,
        latestRun: null,
      },
      isSubmitting: false,
      submitError: 'Strict manager gateway turn requires an LLM planner.',
      language: 'en',
    });

    expect(model).toMatchObject({
      state: 'failed',
      badgeLabel: 'Failed',
      title: 'This request could not be started',
      description: 'Strict manager gateway turn requires an LLM planner.',
    });
  });

  it('hides historical failed runs from the standalone status strip', () => {
    expect(
      projectManagerSessionProjectionToRunStatusModel({
        projection: {
          ...createProjection(),
          activeRun: null,
          latestRun: {
            ...createProjection().latestRun!,
            status: 'failed',
            plannerMode: 'llm_assisted',
            toolPath: 'workflow:task_intake',
            errorCode: 'submit_failed',
            errorMessage: 'Provider timeout',
          },
        },
        isSubmitting: false,
        submitError: null,
        language: 'en',
      }),
    ).toBeNull();
  });

  it('hides historical cancelled runs from the standalone status strip', () => {
    expect(
      projectManagerSessionProjectionToRunStatusModel({
        projection: {
          ...createProjection(),
          activeRun: null,
          latestRun: {
            ...createProjection().latestRun!,
            status: 'cancelled',
            errorCode: 'cancelled_by_user',
            errorMessage: 'Cancelled before execution.',
          },
        },
        isSubmitting: false,
        submitError: null,
        language: 'en',
      }),
    ).toBeNull();
  });

  it('still prefers a direct submit error for the current request', () => {
    const model = projectManagerSessionProjectionToRunStatusModel({
      projection: {
        ...createProjection(),
        activeRun: null,
        latestRun: {
          ...createProjection().latestRun!,
          status: 'cancelled',
          errorCode: 'cancelled_by_user',
          errorMessage: 'Cancelled before execution.',
        },
      },
      isSubmitting: false,
      submitError: 'Gateway rejected the request.',
      language: 'en',
    });

    expect(model).toMatchObject({
      state: 'failed',
      title: 'This request could not be started',
      description: 'Gateway rejected the request.',
    });
  });

  it('returns null when the page is idle and there is no active run or error', () => {
    expect(
      projectManagerSessionProjectionToRunStatusModel({
        projection: {
          ...createProjection(),
          activeRun: null,
          latestRun: null,
        },
        isSubmitting: false,
        submitError: null,
        language: 'en',
      }),
    ).toBeNull();
  });
});
