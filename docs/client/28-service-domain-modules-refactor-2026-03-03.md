# Service Domain Module Refactor (2026-03-03)

## Objective

Improve maintainability of the domain service layer by grouping domain-specific runtime logic (domain definitions + planning strategies) into explicit module folders.

## New Structure

Domain modules now live under:

- `src/services/domains/modules/football/`
- `src/services/domains/modules/basketball/`

Each module contains:

- `domain.ts` (analysis domain definition + data source wiring)
- `planning.ts` (domain planning strategy)
- `index.ts` (module exports)

Top-level module barrel:

- `src/services/domains/modules/index.ts`

## Compatibility Layer

Legacy import paths remain available as re-export shims:

- `src/services/domains/football.ts`
- `src/services/domains/basketball.ts`
- `src/services/domains/planning/football.ts`
- `src/services/domains/planning/basketball.ts`

This avoids breaking existing imports while allowing gradual migration.

## Integration Update

`src/services/domains/builtinModules.ts` now imports from the new module barrel (`./modules`) instead of mixing direct domain and planning file imports.

## Why This Helps

- Stronger boundary between domain modules and shared infrastructure.
- Easier to add new domains by copying a predictable module skeleton.
- Cleaner future migration path for:
  - domain-scoped data mappers
  - domain-specific validators
  - domain-level test fixtures

