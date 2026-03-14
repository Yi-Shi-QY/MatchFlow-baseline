import { DOMAIN_ANALYSIS_CONFIG_ADAPTERS } from '@/src/services/analysisConfigRegistry';
import {
  listBuiltinDomainIds,
  type BuiltinDomainOnboardingCoverage,
} from '@/src/services/domains/builtinModules';
import { BUILTIN_DOMAIN_SUBJECT_DETAIL_ADAPTERS } from '@/src/services/domains/ui/detailRegistry';
import { listRegisteredAutomationParserDomainIds } from '@/src/services/automation/domainParsers';
import { listRuntimeDomainPacks } from './registry';

export interface DomainOnboardingCheck extends BuiltinDomainOnboardingCoverage {}

const ONBOARDING_CONTRACT_TEST_MODULES = import.meta.glob(
  ['./__tests__/registryContract.test.ts', '../../services/domains/__tests__/builtinModules.test.ts'],
  { eager: true },
);

function hasOnboardingContractTests(): boolean {
  return Object.keys(ONBOARDING_CONTRACT_TEST_MODULES).length >= 2;
}

export function collectDomainOnboardingChecks(
  domainIds: string[] = listBuiltinDomainIds(),
): DomainOnboardingCheck[] {
  const runtimePackDomainIds = new Set(
    listRuntimeDomainPacks().map((runtimePack) => runtimePack.manifest.domainId),
  );
  const automationParserDomainIds = new Set(listRegisteredAutomationParserDomainIds());
  const hasContractTests = hasOnboardingContractTests();

  return domainIds.map((domainId) => ({
    domainId,
    hasRuntimePack: runtimePackDomainIds.has(domainId),
    hasDetailAdapter: Array.isArray(BUILTIN_DOMAIN_SUBJECT_DETAIL_ADAPTERS[domainId]),
    hasAnalysisConfigAdapter: Boolean(DOMAIN_ANALYSIS_CONFIG_ADAPTERS[domainId]),
    hasAutomationParser: automationParserDomainIds.has(domainId),
    hasContractTests,
  }));
}
