# Match Data Server API Guide / 数据服务端 API 指南

## EN

## 1. Base Rules

1. Health endpoint is public: `GET /health`
2. Other endpoints require:

```http
Authorization: Bearer <API_KEY>
```

## 1.1 Auth Modes (Server 2.0 Kickoff)

1. Legacy mode (compatible): `Authorization: Bearer <API_KEY>`
2. Account mode (new): `Authorization: Bearer <access_token>`
3. New auth endpoints are enabled in parallel:
   - `POST /auth/login`
   - `POST /auth/refresh`
   - `POST /auth/logout`
   - `GET /auth/me`
   - `GET /capabilities/me`

## 2. Match Read APIs

1. `GET /matches`
   - Query: `date`, `status`, `search`, `limit`, `offset`
2. `GET /matches/live`
3. `GET /matches/:id`
4. `GET /teams`
5. `GET /teams/:id/matches`
6. `GET /leagues`

Response compatibility:

1. Match list/detail remains compatible with existing client fields.
2. Optional `analysisConfig.planning` can be included for planner hints.
3. In account mode, fields may be permission-filtered:
   - missing `datasource:use:market` -> `odds` removed from match payload.
   - missing `datasource:use:fundamental` -> endpoint returns `403`.

## 3. Analysis Config APIs

1. `GET /analysis/config/match/:id`
2. `POST /analysis/config/resolve`

Output shape:

```json
{
  "data": {
    "matchId": "m2",
    "sourceContext": {
      "planning": {
        "mode": "template",
        "templateId": "live_market_pro",
        "requiredAgents": ["momentum_agent"],
        "requiredSkills": ["select_plan_template_v2"],
        "hub": {
          "baseUrl": "http://host:3001",
          "autoInstall": true
        }
      }
    }
  }
}
```

## 4. Hub Manifest APIs

Kinds:

1. `agent`
2. `skill`
3. `template`

Path aliases (all supported):

1. `/hub/{kind}s/:id`
2. `/hub/{kind}/:id`
3. `/extensions/{kind}s/:id`
4. `/extensions/{kind}/:id`

Optional query:

1. `version=<semver>`
2. `channel=<stable|beta|internal>`

Permission rules in account mode:

1. Template manifest requires:
   - `template:use:<id>` or `template:use:*`
2. Agent/skill manifest requires at least one template permission.

Runtime resolution order (Server 2.0 bridge):

1. Hub first resolves published catalog revisions from Admin Studio tables:
   - `template` -> `planning_template_revisions`
   - `agent` -> `agent_revisions`
   - `skill` -> `skill_revisions`
2. Tenant-aware lookup uses token tenant context when available; default channel is `stable`.
3. If catalog revisions are unavailable, Hub falls back to legacy `extension_manifests`.
4. In mock/no-DB mode, Hub falls back to in-memory default manifests.
5. `analysis/config/resolve` template requirement expansion follows the same runtime resolution logic.

## 5. Admin APIs

In account mode, all `/admin/*` endpoints require:

1. `admin:*` permission

## 5.1 Match and Team Admin

1. `POST /admin/init`
2. `POST /admin/teams`
3. `POST /admin/matches`
4. `PUT /admin/matches/:id/score`
5. `DELETE /admin/matches/:id`
6. `DELETE /admin/teams/:id`

`/admin/init` behavior:

1. Applies `schema.sql`.
2. Applies all `match-data-server/migrations/*.sql` in lexical order.

## 5.2 Extension Admin

1. `GET /admin/extensions`
2. `POST /admin/extensions`
3. `PUT /admin/extensions/:kind/:id/:version`
4. `POST /admin/extensions/publish`

## 5.3 Account Auth (Server 2.0)

1. `POST /auth/login`
   - Body: `identifier`, `password`
2. `POST /auth/refresh`
   - Body: `refreshToken`
3. `POST /auth/logout`
   - Body optional: `refreshToken`
4. `GET /auth/me`
5. `GET /capabilities/me`

## 5.4 Admin Identity and Policy (Server 2.0)

1. Users:
   - `GET /admin/users`
   - `POST /admin/users`
   - `PUT /admin/users/:id`
   - `POST /admin/users/:id/roles`
2. Roles:
   - `GET /admin/roles`
   - `POST /admin/roles`
   - `PUT /admin/roles/:id`
   - `POST /admin/roles/:id/permissions`
3. Permissions:
   - `GET /admin/permissions`
   - `POST /admin/permissions`
4. Audit:
   - `GET /admin/audit-logs`

Operational notes:

1. These endpoints require DB connectivity.
2. In account mode, all routes above require `admin:*`.

## 5.5 Admin Studio Catalog and Release (Phase B Initial)

1. Catalog:
   - `GET /admin/catalog/:domain`
   - `POST /admin/catalog/:domain`
   - `POST /admin/catalog/datasource/preview/structure`
   - `POST /admin/catalog/datasource/preview/data`
   - `GET /admin/catalog/:domain/:itemId/revisions`
   - `GET /admin/catalog/:domain/:itemId/diff`
   - `POST /admin/catalog/:domain/:itemId/revisions`
   - `PUT /admin/catalog/:domain/:itemId/revisions/:version`
   - `POST /admin/catalog/:domain/:itemId/publish`
   - `POST /admin/catalog/:domain/:itemId/rollback`
2. Validation:
   - `POST /admin/validate/run`
   - `GET /admin/validate/:runId`
3. Release:
   - `POST /admin/release/publish`
   - `POST /admin/release/rollback`
   - `GET /admin/release/history`
4. Datasource Collection Governance:
   - `GET /admin/data-collections/collectors`
   - `POST /admin/data-collections/collectors`
   - `PUT /admin/data-collections/collectors/:collectorId`
   - `POST /admin/data-collections/collectors/:collectorId/run`
   - `POST /admin/data-collections/collectors/:collectorId/import`
   - `GET /admin/data-collections/runs`
   - `GET /admin/data-collections/snapshots`
   - `GET /admin/data-collections/health`
   - `POST /admin/data-collections/snapshots/:snapshotId/confirm`
   - `POST /admin/data-collections/snapshots/:snapshotId/release`
   - `POST /admin/data-collections/snapshots/:snapshotId/replay`

Domain values:

1. `datasource`
2. `planning_template`
3. `animation_template`
4. `agent`
5. `skill`

Permission notes (account mode):

1. Catalog routes require domain edit permission:
   - `catalog:datasource:edit`
   - `catalog:template:edit`
   - `catalog:animation:edit`
   - `catalog:agent:edit`
   - `catalog:skill:edit`
2. Validation routes require `validate:run`.
3. Release publish/rollback requires `release:publish` / `release:rollback`.
4. Release history requires `release:read`.
5. `admin:*` still acts as wildcard and can pass all checks.

Validation execution notes:

1. `POST /admin/validate/run` requires:
   - `runType` in `catalog_validate|pre_publish|post_publish`
   - `domain` in the domain enum above
   - `scope.itemId` (required)
   - `scope.version` (optional; if omitted, server resolves latest draft revision for `scope.itemId`)
2. Result payload now includes real `checks[]` with:
   - `schema`
   - `dependency`
   - `compatibility`
   - `scope_revision_exists`
3. A run returns `status=failed` when any blocking check fails.

Catalog write validation notes:

1. `POST /admin/catalog/:domain`
2. `POST /admin/catalog/:domain/:itemId/revisions`
3. `PUT /admin/catalog/:domain/:itemId/revisions/:version` (draft-save)
4. For `datasource` and `planning_template`, manifest is validated before DB write.
5. Invalid manifest returns:
   - `400` + `CATALOG_MANIFEST_SCHEMA_INVALID`
   - `error.details.checks` for failed checks and field-level reasons
6. Draft-save is allowed only when target revision status is `draft`.
   - blocked case: `409` + `CATALOG_DRAFT_NOT_EDITABLE`

Revision diff notes:

1. `GET /admin/catalog/:domain/:itemId/diff?fromVersion=<x>&toVersion=<y>`
2. Both versions are required and must be different.
3. Response includes:
   - revision metadata (`fromRevision`, `toRevision`)
   - manifest diff summary (`added/removed/changed/total`)
   - path-level changes (`addedPaths`, `removedPaths`, `changedPaths`)

Datasource preview notes:

1. `POST /admin/catalog/datasource/preview/structure`
   - Requires `catalog:datasource:edit`.
   - Body:
     - `manifest` (required, object)
   - Returns:
     - datasource field/path mapping summary
     - path tree and `sourceContextPreview`
     - strict validation check result (`schema/dependency/compatibility`)
2. `POST /admin/catalog/datasource/preview/data`
   - Requires `catalog:datasource:edit`.
   - Body:
     - `manifest` (required, object)
     - `limit` (optional, 1-20, default 5)
     - `statuses` (optional, array or csv)
   - Returns:
     - sampled match rows from DB
     - per-row datasource field values extracted from configured paths

Datasource collection governance notes:

Reference runbook:

1. `docs/server/24-cn-jczq-collection-interface-and-script.md`

1. Collector management (`/admin/data-collections/collectors*`)
   - Create/update collector metadata:
     - `sourceId`
     - `provider` (`match_snapshot|manual_import`)
     - `config` (sample limit, status filters, etc.)
   - Trigger collection run:
     - `POST /admin/data-collections/collectors/:collectorId/run`
     - server creates:
       - collection run record
       - collection snapshot (`confirmationStatus=pending`, `releaseStatus=draft`)
   - Import external payload (script/ETL):
     - `POST /admin/data-collections/collectors/:collectorId/import`
     - body requires:
       - `payload` (JSON object)
     - body optional:
       - `allowDuplicate` (default `false`)
       - `force` (default `false`, bypass disabled collector check)
       - `contentHash` (hex string, override server-side payload hash)
     - server creates:
       - succeeded collection run (`datasource.collection.import`)
       - pending snapshot for confirm/release workflow
     - dedup behavior (default):
       - when `sourceId + contentHash` already exists and snapshot is not rejected
       - returns existing snapshot with `data.deduplicated=true`
       - still writes a succeeded run record for auditability
2. Snapshot confirmation:
   - `POST /admin/data-collections/snapshots/:snapshotId/confirm`
   - body `action`:
     - `confirm`
     - `reject`
3. Snapshot release:
   - `POST /admin/data-collections/snapshots/:snapshotId/release`
   - requires snapshot `confirmationStatus=confirmed`
   - release channel:
     - `internal|beta|stable`
   - previous released snapshot in same `sourceId + channel` is marked `deprecated`
4. Permission baseline:
   - collector/runs/snapshots read-write-confirm:
     - `catalog:datasource:edit`
   - collection health and snapshot replay:
     - `catalog:datasource:edit`
   - snapshot release:
     - `release:publish`
5. Import safety limits:
   - max record count:
     - env `COLLECTION_MAX_IMPORT_RECORDS` (default `20000`)
   - max payload bytes:
     - env `COLLECTION_MAX_IMPORT_PAYLOAD_BYTES` (default `8388608`)
   - over-limit returns:
     - `400` + `COLLECTION_IMPORT_RECORD_COUNT_EXCEEDED`
     - `413` + `COLLECTION_IMPORT_PAYLOAD_TOO_LARGE`
   - invalid override hash:
      - `400` + `COLLECTION_IMPORT_CONTENT_HASH_INVALID`
   - disabled collector import without force:
      - `409` + `COLLECTION_COLLECTOR_DISABLED`

Publish gate note:

1. `POST /admin/catalog/:domain/:itemId/publish` requires the target revision to have a successful validation-run summary.
2. Publish without successful validation-run returns:
   - `409` + `CATALOG_RELEASE_BLOCKED_BY_VALIDATION`

DB dependency note:

1. Without DB connectivity, these routes return:
   - `503` + `CATALOG_DB_REQUIRED`
2. Input validation errors are returned before DB access:
   - `400` + `VALIDATION_SCOPE_INVALID`
   - `400` + `VALIDATION_RUN_TYPE_INVALID`
   - `400` + `CATALOG_DOMAIN_INVALID`

## 6. Error Shape

Typical error format:

```json
{
  "error": {
    "message": "..."
  }
}
```

Common authz error:

```json
{
  "error": {
    "code": "AUTH_FORBIDDEN",
    "message": "..."
  }
}
```

## ZH

## 1. 基本规则

1. `GET /health` 为公开接口。
2. 其余接口需携带：

```http
Authorization: Bearer <API_KEY>
```

## 2. 比赛读取接口

1. `GET /matches`
   - 查询参数：`date`、`status`、`search`、`limit`、`offset`
2. `GET /matches/live`
3. `GET /matches/:id`
4. `GET /teams`
5. `GET /teams/:id/matches`
6. `GET /leagues`

兼容性说明：

1. 赛事数据结构保持兼容现有客户端字段。
2. 可选返回 `analysisConfig.planning` 作为规划提示。

## 3. 分析配置接口

1. `GET /analysis/config/match/:id`
2. `POST /analysis/config/resolve`

返回结构示例：

```json
{
  "data": {
    "matchId": "m2",
    "sourceContext": {
      "planning": {
        "mode": "template",
        "templateId": "live_market_pro",
        "requiredAgents": ["momentum_agent"],
        "requiredSkills": ["select_plan_template_v2"],
        "hub": {
          "baseUrl": "http://host:3001",
          "autoInstall": true
        }
      }
    }
  }
}
```

## 4. Hub Manifest 接口

支持类型：

1. `agent`
2. `skill`
3. `template`

路径别名（全部支持）：

1. `/hub/{kind}s/:id`
2. `/hub/{kind}/:id`
3. `/extensions/{kind}s/:id`
4. `/extensions/{kind}/:id`

可选查询参数：

1. `version=<semver>`
2. `channel=<stable|beta|internal>`

## 5. 管理接口

## 5.1 比赛与球队管理

1. `POST /admin/init`
2. `POST /admin/teams`
3. `POST /admin/matches`
4. `PUT /admin/matches/:id/score`
5. `DELETE /admin/matches/:id`
6. `DELETE /admin/teams/:id`

## 5.2 扩展管理

1. `GET /admin/extensions`
2. `POST /admin/extensions`
3. `PUT /admin/extensions/:kind/:id/:version`
4. `POST /admin/extensions/publish`

## 6. 错误返回格式

常见错误结构：

```json
{
  "error": {
    "message": "..."
  }
}
```
