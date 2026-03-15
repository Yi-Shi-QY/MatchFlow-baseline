import { describe, expect, it } from 'vitest';
import { getRuntimeDomainPackById, listRuntimeDomainPacks } from '@/src/domains/runtime/registry';
import { parseProjectOpsAutomationCommand } from '@/src/domains/runtime/projectOps/automationParser';
import { projectOpsRuntimeResolver } from '@/src/domains/runtime/projectOps/resolver';
import { parsePendingTaskFromWorkflow } from '@/src/domains/runtime/projectOps/tools';
import { PROJECT_OPS_TASK_INTAKE_WORKFLOW_TYPE } from '@/src/domains/runtime/projectOps/workflowType';
import { getAnalysisDomainById } from '@/src/services/domains/registry';
import { getDomainSubjectDetailAdapter } from '@/src/services/domains/ui/detailRegistry';

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

  it('exposes a domain-native intake capability instead of football wording', () => {
    const runtimePack = getRuntimeDomainPackById('project_ops');
    const capability = runtimePack?.manager?.taskIntake;

    expect(capability).toBeTruthy();

    const prompt = capability!.buildPrompt({
      language: 'en',
      definition: capability!.definition,
      activeStepId: 'focus_dimensions',
      slotValues: {
        target_subject: {
          subjectId: 'project_mobile_launch',
          label: 'Q2 Mobile Launch',
          subjectType: 'project',
        },
      },
      recognizedSlotIds: ['target_subject'],
      missingSlotIds: ['focus_dimensions'],
    });

    expect(capability!.definition.steps.map((step) => step.stepId)).toEqual([
      'target_subject',
      'focus_dimensions',
      'decision_goal',
      'time_horizon',
    ]);
    expect(prompt.body).toContain('delivery and milestones');
    expect(prompt.body).not.toContain('odds and market');
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

  it('resolves Chinese project subject queries into project_ops intent instead of falling back', async () => {
    const intent = await projectOpsRuntimeResolver.resolveIntent('Q2 移动发布现在风险怎么样', {
      now: new Date('2026-03-15T10:00:00.000Z'),
    });

    expect(intent?.domainId).toBe('project_ops');
    expect(intent?.intentType).toBe('analyze');
    expect(intent?.subjectRefs?.[0]?.subjectId).toBe('project_mobile_launch');
  });

  it('parses Chinese project ops commands into fixed local subjects when aliases match', () => {
    const drafts = parseProjectOpsAutomationCommand('明天 09:00 分析 供应商切换清单', {
      defaultDomainId: 'project_ops',
      now: new Date('2026-03-15T10:00:00.000Z'),
    });

    expect(drafts).toHaveLength(1);
    expect(drafts?.[0]?.domainId).toBe('project_ops');
    expect(drafts?.[0]?.targetSelector).toMatchObject({
      mode: 'fixed_subject',
      subjectId: 'task_vendor_cutover',
    });
  });
});
