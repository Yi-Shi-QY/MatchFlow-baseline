import { describe, expect, it } from 'vitest';
import { getRuntimeDomainPackById, listRuntimeDomainPacks } from '@/src/domains/runtime/registry';
import { getAnalysisDomainById } from '@/src/services/domains/registry';
import { getDomainSubjectDetailAdapter } from '@/src/services/domains/ui/detailRegistry';
import {
  PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
  parsePendingTaskFromWorkflow,
} from '@/src/domains/runtime/projectOps/tools';

describe('project ops runtime pack', () => {
  it('registers project_ops across runtime, domain, and detail registries', () => {
    const runtimePack = getRuntimeDomainPackById('project_ops');
    const domain = getAnalysisDomainById('project_ops');
    const taskAdapter = getDomainSubjectDetailAdapter({
      domainId: 'project_ops',
      subjectType: 'task',
    });
    const fallbackAdapter = getDomainSubjectDetailAdapter({
      domainId: 'project_ops',
      subjectType: 'match',
    });

    expect(listRuntimeDomainPacks().map((pack) => pack.manifest.domainId)).toContain('project_ops');
    expect(runtimePack?.manifest.domainId).toBe('project_ops');
    expect(domain?.id).toBe('project_ops');
    expect(taskAdapter?.domainId).toBe('project_ops');
    expect(fallbackAdapter?.domainId).toBe('project_ops');
  });

  it('restores pending task intake state using the registered workflow type', () => {
    const pendingTask = {
      id: 'pending_project_ops',
      sourceText: 'Analyze Q2 Mobile Launch tomorrow at 9',
      composerMode: 'smart',
      drafts: [],
      stage: 'await_sequence',
      createdAt: 100,
    } as const;

    expect(
      parsePendingTaskFromWorkflow({
        workflowType: PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE,
        stateData: pendingTask as unknown as Record<string, unknown>,
      }),
    ).toEqual(pendingTask);
  });
});
