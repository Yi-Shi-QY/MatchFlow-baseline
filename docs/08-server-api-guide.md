# Match Data Server API Guide / 数据服务端 API 指南

## EN

## 1. Base Rules

1. Health endpoint is public: `GET /health`
2. Other endpoints require:

```http
Authorization: Bearer <API_KEY>
```

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

## 5. Admin APIs

## 5.1 Match and Team Admin

1. `POST /admin/init`
2. `POST /admin/teams`
3. `POST /admin/matches`
4. `PUT /admin/matches/:id/score`
5. `DELETE /admin/matches/:id`
6. `DELETE /admin/teams/:id`

## 5.2 Extension Admin

1. `GET /admin/extensions`
2. `POST /admin/extensions`
3. `PUT /admin/extensions/:kind/:id/:version`
4. `POST /admin/extensions/publish`

## 6. Error Shape

Typical error format:

```json
{
  "error": {
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

