import { describe, expect, it } from 'vitest';
import {
  listBuiltinDomainIds,
  validateBuiltinDomainOnboardingCoverage,
} from '@/src/services/domains/builtinModules';
import { collectDomainOnboardingChecks } from '@/src/domains/runtime/onboarding';

describe('builtin module onboarding coverage', () => {
  it('passes when built-in domains have runtime onboarding coverage', () => {
    const checks = collectDomainOnboardingChecks();

    expect(checks.map((check) => check.domainId)).toContain('football');
    expect(() => validateBuiltinDomainOnboardingCoverage(checks)).not.toThrow();
  });

  it('fails loudly when a built-in domain is missing onboarding requirements', () => {
    const checks = listBuiltinDomainIds().map((domainId) => ({
      domainId,
      hasRuntimePack: domainId !== 'football',
      hasDetailAdapter: true,
      hasAnalysisConfigAdapter: true,
      hasAutomationParser: true,
      hasContractTests: true,
    }));

    expect(() => validateBuiltinDomainOnboardingCoverage(checks)).toThrow(
      /Built-in domain football is missing onboarding requirements: runtime pack/,
    );
  });
});
