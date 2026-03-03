# Domain Scaffold and Compliance Tooling (v1)

Date: 2026-03-03  
Scope: `MatchFlow/src` client-side domain extension workflow.

## 1. Objective

This document introduces two automation tools for domain onboarding:

1. A scaffold generator to create a complete domain skeleton and optional registrations.
2. A compliance checker to enforce go-live gates before merge.

These tools are designed to reduce manual registry mistakes and improve repeatability.

## 2. Commands

## 2.1 Generate a new domain scaffold

```bash
npm run domain:scaffold -- --id <domain_id> [--name "Domain Name"] [--no-register] [--force] [--dry-run]
```

Examples:

```bash
npm run domain:scaffold -- --id risk_control --name "Risk Control Analysis"
npm run domain:scaffold -- --id supply_chain --dry-run
npm run domain:scaffold -- --id pricing --no-register
```

Behavior:

1. Creates domain module files under `src/services/domains/modules/<domainId>/`.
2. Creates domain agents under `src/agents/domains/<domainId>/`.
3. Creates planner templates under `src/skills/planner/templates/<domainId>/`.
4. By default, auto-registers the new domain into module/agent/template/UI registries.
5. Uses marker-based insertion to avoid brittle text replacement.

## 2.2 Verify domain extension compliance

```bash
npm run verify:domain-extension
```

Behavior:

1. Detects all built-in domains under `src/services/domains/modules/*`.
2. Validates required file structure.
3. Validates resource contract (templates/animations/agents/skills non-empty).
4. Validates planner/terminal agents against domain resources.
5. Validates built-in registry coverage:
   - module export and builtin registration
   - UI presenter registration
   - agent/skill/template registration consistency
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

## 3. Marker-based Registry Slots

The scaffold command patches these markers:

1. `DOMAIN_MODULE_EXPORT_MARKER` in `src/services/domains/modules/index.ts`
2. `DOMAIN_MODULE_IMPORT_MARKER` in `src/services/domains/builtinModules.ts`
3. `DOMAIN_MODULE_REGISTRATION_MARKER` in `src/services/domains/builtinModules.ts`
4. `DOMAIN_AGENT_IMPORT_MARKER` in `src/agents/index.ts`
5. `DOMAIN_AGENT_REGISTRATION_MARKER` in `src/agents/index.ts`
6. `DOMAIN_AGENT_VERSION_MARKER` in `src/agents/index.ts`
7. `DOMAIN_TEMPLATE_IMPORT_MARKER` in `src/skills/planner/index.ts`
8. `DOMAIN_TEMPLATE_REGISTRATION_MARKER` in `src/skills/planner/index.ts`
9. `DOMAIN_UI_PRESENTER_EXTENSIONS_MARKER` in `src/services/domains/ui/presenter.ts`
10. `DOMAIN_UI_PRESENTER_REGISTRATION_MARKER` in `src/services/domains/ui/presenter.ts`

Do not remove these markers unless the scaffold script is updated accordingly.

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
