# Domain Packs (Client-Side)

Domain Packs are lightweight metadata bundles installed from the Hub.  
They do not execute arbitrary code on client.

## What a Domain Pack Does

- Creates a new domain id that aliases an existing built-in domain behavior.
- Carries recommended extension ids (agents/skills/templates).
- Can provide additional HTTP host allowlist defaults for runtime skills.

## Current Runtime Behavior

- Alias domain reuses data source + planning behavior from `baseDomainId`.
- If `baseDomainId` is missing or invalid, installation still succeeds but domain alias is ignored.
- Planning strategy resolves via `baseDomainId` when possible; unknown domain ids still fall back to football strategy.
- `skillHttpAllowedHosts` from active domain pack is merged into runtime host allowlist for `http_json` skills.
- One-click recommended sync seeds ids from active domain resources before scanning server snapshots.

## Manifest Fields

- `id`, `version`, `name`, `description` (required)
- `baseDomainId` (optional, default `football`)
- `minAppVersion` (optional)
- `recommendedAgents`, `recommendedSkills`, `recommendedTemplates` (optional string arrays)
- `skillHttpAllowedHosts` (optional string array)
- `hub` (optional hub hint)

## Hub Endpoints Tried

- `/hub/domains/{id}`
- `/hub/domain/{id}`
- `/domains/{id}`
- `/extensions/domains/{id}`
