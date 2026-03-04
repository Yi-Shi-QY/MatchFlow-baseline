# Domain Scaffold and Compliance Tooling (v1)

Date: 2026-03-03  
Scope: `MatchFlow/src` client-side domain extension workflow.

## 1. Objective

This document introduces two automation tools for domain onboarding:

1. A scaffold generator to create a complete domain skeleton with auto-discovery contracts.
2. A compliance checker to enforce go-live gates before merge.

These tools are designed to reduce manual registry mistakes and improve repeatability.

## 2. Commands

## 2.1 Generate a new domain scaffold

```bash
npm run domain:scaffold -- --id <domain_id> [--name "Domain Name"] [--force] [--dry-run]
```

Examples:

```bash
npm run domain:scaffold -- --id risk_control --name "Risk Control Analysis"
npm run domain:scaffold -- --id supply_chain --dry-run
```

Behavior:

1. Creates domain module files under `src/services/domains/modules/<domainId>/`.
2. Creates domain agents under `src/agents/domains/<domainId>/`.
3. Creates planner templates under `src/skills/planner/templates/<domainId>/`.
4. Creates a UI presenter file under `src/services/domains/ui/presenters/<domainId>.ts`.
5. Relies on runtime auto-discovery instead of marker-based shared-file patching.

## 2.2 Verify domain extension compliance

```bash
npm run verify:domain-extension
```

Behavior:

1. Detects all built-in domains under `src/services/domains/modules/*`.
2. Validates required file structure.
3. Validates resource contract (templates/animations/agents/skills non-empty).
4. Validates planner/terminal agents against domain resources.
5. Validates auto-discovery registry contracts:
   - module discovery contract (`DOMAIN_MODULE_FACTORIES`)
   - UI presenter discovery contract (`DOMAIN_UI_PRESENTER_ENTRIES`)
   - agent/template discovery contracts (`DOMAIN_AGENT_ENTRIES`, `DOMAIN_AGENT_VERSION_ENTRIES`, `DOMAIN_TEMPLATE_ENTRIES`)
   - agent/skill/template consistency against domain resources
6. Validates animation contracts:
   - template `animationType` must map in `templateParams.ts`
   - mapped template IDs must be listed in `resources.animations`
   - `resources.animations` IDs must exist in remotion template registry
7. Validates planner routing anti-hardcode contracts:
   - `src/services/ai/planning.ts` must fallback via `DEFAULT_DOMAIN_ID` (no hardcoded `"football"` default)
   - `src/services/ai.ts` must not fallback planner IDs with `planner_template/planner_autonomous`
8. Validates shared planner/tag agent neutrality:
   - `src/agents/planner_template.ts`, `src/agents/planner_autonomous.ts`, `src/agents/tag.ts` must avoid hardcoded football-only semantics
9. Fails with non-zero exit code when any gate is violated.

## 3. Auto-discovery Registration Contracts

The scaffold no longer patches shared registry files for domain onboarding.
Built-in domain parts are now discovered by file convention:

1. Built-in modules:
   - `src/services/domains/builtinModules.ts` auto-discovers `src/services/domains/modules/*/module.ts`
   - each module file must export `DOMAIN_MODULE_FACTORIES`
2. Domain agents:
   - `src/agents/index.ts` auto-discovers `src/agents/domains/*/index.ts`
   - each domain agent index must export `DOMAIN_AGENT_ENTRIES` and `DOMAIN_AGENT_VERSION_ENTRIES`
3. Domain templates:
   - `src/skills/planner/index.ts` auto-discovers `src/skills/planner/templates/*/index.ts`
   - each template index must export `DOMAIN_TEMPLATE_ENTRIES`
4. UI presenters:
   - `src/services/domains/ui/registry.ts` auto-discovers `src/services/domains/ui/presenters/*.ts`
   - each presenter module must export `DOMAIN_UI_PRESENTER_ENTRIES`

## 4. Recommended Workflow

1. Generate scaffold in dry-run first.
2. Generate scaffold for real.
3. Replace placeholder logic with domain-native data sources, planners, templates, animations, and i18n keys.
4. Run:
   - `npm run verify:domain-extension`
   - `npm run lint`
   - `npm run build`
5. Run manual smoke checks (domain switch, analysis flow, history replay, language switch).

## 5. Known Limitations (v1)

1. Scaffolded UI presenter starts with sports-compatible defaults and must be domain-customized.
2. Scaffolded animation types are placeholders; you still need to add remotion templates and mapping.
3. Compliance checker is static (source-based), not runtime-executed end-to-end.
