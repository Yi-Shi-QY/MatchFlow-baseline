# Built-in Module Split Refactor (2026-03-03)

## Objective

Continue client structure optimization by separating each domain's built-in local-case construction from the central registry file.

## What Changed

### 1. Added domain module descriptor type

- `src/services/domains/modules/types.ts`

Defines `BuiltinDomainModule` so domain module assembly can live in domain folders rather than only in `builtinModules.ts`.

### 2. Added shared match clone helper

- `src/services/domains/modules/shared/cloneMatch.ts`

Moved deep clone logic into a shared helper to avoid duplication and keep registry file focused.

### 3. Moved local case builders into domain module folders

- Football cases:
  - `src/services/domains/modules/football/localCases.ts`
  - `src/services/domains/modules/football/module.ts`
- Basketball cases:
  - `src/services/domains/modules/basketball/localCases.ts`
  - `src/services/domains/modules/basketball/module.ts`

Each domain now owns how its local test data is prepared.

### 4. Updated module barrels

- `src/services/domains/modules/football/index.ts`
- `src/services/domains/modules/basketball/index.ts`
- `src/services/domains/modules/index.ts`

They now export domain definition, planning strategy, and module creator functions.

### 5. Simplified central registry file

- `src/services/domains/builtinModules.ts`

Now focuses on:

- centralized minimum-case validation
- duplicate id checks
- public query APIs (`listBuiltinDomainModules`, `getBuiltinDomainLocalTestCases`, etc.)

Domain data assembly is delegated to module creators.

## Result

The built-in domain registry is thinner and easier to maintain, while each domain module becomes more self-contained.

