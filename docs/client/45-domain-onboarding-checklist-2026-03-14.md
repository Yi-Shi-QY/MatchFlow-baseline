# Domain Onboarding Checklist

This checklist is the minimum bar for adding a new first-class domain to MatchFlow after the subject-first hardening work.

## Goal

The target is not "domain code compiles".

The target is:

- the domain mounts through the shared subject shell
- the manager can operate without shared football-only assumptions
- onboarding gaps fail in development and tests before they surface in the UI

## Required Contracts

Every new domain must provide all of the following:

1. A runtime pack with a valid manifest, resolver, source adapters, tools, and any workflow handlers it declares.
2. A subject detail adapter in `src/services/domains/ui/detailAdapters/`.
3. An analysis config adapter in `src/services/analysisConfigAdapters/`.
4. An automation parser hook exposed through the runtime pack automation capability.
5. If the domain uses manager-guided clarification or LLM planning:
   manager capability metadata, skill ids, pending-task parsing, and legacy effect mapping.

## Registration Checklist

1. Add the domain module under `src/services/domains/modules/`.
2. Add the runtime pack under `src/domains/runtime/<domain>/`.
3. Register any domain-owned detail adapter.
4. Register any domain-owned analysis config adapter.
5. Ensure `listRegisteredAutomationParserDomainIds()` includes the new domain.
6. Run runtime validator coverage through `assertValidRuntimePack(...)`.
7. Run builtin onboarding coverage through `validateBuiltinDomainOnboardingCoverage(...)`.

## Test Checklist

Minimum required tests for a new domain:

1. Runtime pack contract test.
2. Subject detail mounting test.
3. Manager compatibility test if the domain exposes manager capability.
4. Analysis config resolution test.
5. At least one persistence or routing round-trip test using canonical subject refs.

In addition, the shared guardrail tests must keep passing:

1. `src/domains/runtime/__tests__/registryContract.test.ts`
2. `src/services/domains/__tests__/builtinModules.test.ts`

## Review Questions

Before calling the domain "ready", answer yes to each question:

1. Can the domain be opened through `/subject/:domainId/:subjectId` without patching shared core code?
2. Can the manager enter the domain through runtime-pack metadata instead of shared football conditions?
3. Can automation parse, save, and execute domain work without rewriting shared stores?
4. Do settings, history, and saved subjects preserve the domain id explicitly?
5. If one required adapter is removed, do tests fail loudly?

## Stop Conditions

Do not continue onboarding if any of these are true:

1. The runtime pack only works by reusing football workflow ids or shared football copy.
2. The domain cannot provide a stable subject id and subject type contract.
3. The domain needs a new shared-core exception before the generic seams are exhausted.

If any stop condition is hit, return to platform hardening before extending the domain.
