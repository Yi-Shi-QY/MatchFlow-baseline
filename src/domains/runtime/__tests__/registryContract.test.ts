import { describe, expect, it } from 'vitest';
import type { DomainRuntimePack } from '@/src/domains/runtime/types';
import { listRuntimeDomainPacks } from '@/src/domains/runtime/registry';
import { assertValidRuntimePack } from '@/src/domains/runtime/validators';

function createRuntimePack(
  overrides: Partial<DomainRuntimePack> = {},
): DomainRuntimePack {
  return {
    manifest: {
      domainId: 'project_ops',
      version: '1.0.0',
      displayName: 'Project Ops',
      supportedIntentTypes: [],
      supportedEventTypes: [],
      supportedFactorIds: [],
    },
    resolver: {
      async resolveIntent() {
        return null;
      },
      async resolveSubjects() {
        return [];
      },
      async resolveEvents() {
        return [];
      },
    },
    sourceAdapters: [],
    contextProviders: [],
    tools: [],
    workflows: [],
    ...overrides,
  } as DomainRuntimePack;
}

describe('runtime registry contracts', () => {
  it('keeps built-in runtime packs valid at load time', () => {
    const runtimePacks = listRuntimeDomainPacks();

    expect(runtimePacks.map((runtimePack) => runtimePack.manifest.domainId)).toContain('football');
    expect(() => runtimePacks.forEach((runtimePack) => assertValidRuntimePack(runtimePack))).not.toThrow();
  });

  it('rejects manager capabilities whose default workflow is not registered', () => {
    const runtimePack = createRuntimePack({
      manager: {
        domainId: 'project_ops',
        skillIds: ['manager_help'],
        plannerHints: {
          defaultWorkflowType: 'project_ops_task_intake',
        },
        parsePendingTask: () => null,
        mapLegacyEffect: () => ({
          blocks: [],
        }),
      },
    });

    expect(() => assertValidRuntimePack(runtimePack)).toThrow(
      /defaultWorkflowType "project_ops_task_intake" is not registered/,
    );
  });
});
