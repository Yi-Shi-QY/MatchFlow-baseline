# Server 2.0 Production Readiness Checklist / 服务端 2.0 生产就绪检查清单

## EN

## 1. Goal

This checklist defines the minimum production gate for Server 2.0 before deployment.

Pass criteria:

1. Startup configuration passes strict production validation.
2. Database readiness probe is healthy.
3. Security baseline is enabled (security headers + controlled CORS).
4. Regression and joint-smoke suites are green.

## 2. Runtime Baseline

Implemented baseline:

1. Startup validation:
   - rejects weak/default secrets in production mode
   - requires database URL in production mode
2. Health endpoints:
   - `GET /livez` (liveness)
   - `GET /readyz` (readiness with DB ping)
3. Security headers:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: no-referrer`
4. Graceful shutdown:
   - handles `SIGTERM` and `SIGINT`
   - closes HTTP server and DB pool
5. Docker readiness:
   - container healthcheck calls `/readyz`

## 3. Required Environment Variables

Minimum required for production:

1. `NODE_ENV=production`
2. `API_KEY` (non-default, recommended >= 24 chars)
3. `ACCESS_TOKEN_SECRET` (recommended >= 32 chars)
4. `REFRESH_TOKEN_SECRET` (recommended >= 32 chars)
5. `DATABASE_URL`
6. `CORS_ALLOWED_ORIGINS` (avoid `*` in production)

Database SSL knobs:

1. `DB_SSL_MODE`:
   - `require` for managed cloud DB
   - `disable` for local Docker Postgres
2. `DB_SSL_REJECT_UNAUTHORIZED`:
   - `true` by default
   - set to `false` only when certificate chain handling requires it

## 4. Gate Commands

Run in this order:

```bash
cd match-data-server
npm test
npm run test:db-phase
npm run test:phase-e
npm run test:joint-smoke
npm run test:web-joint-smoke
npm run admin-web:e2e
npm run test:prod-ready
npm run preflight:prod
```

If local DB has no SSL, run preflight with:

```bash
DB_SSL_MODE=disable npm run preflight:prod
```

Expected result:

1. All test commands finish with `0 failed`.
2. `preflight:prod` ends with:
   - `[preflight] PASS: production readiness checks completed`

## 5. Deployment Sign-Off Template

Before release:

1. Date/time:
2. Commit SHA:
3. Target environment:
4. Gate command outputs:
5. Approver (Backend owner):
6. Approver (QA/Release owner):

---

## ZH

## 1. 目标

本清单用于定义服务端 2.0 上线前的最小生产门禁。

通过标准：

1. 启动配置通过生产模式严格校验。
2. 数据库就绪探针健康。
3. 安全基线开启（安全响应头 + 可控 CORS）。
4. 回归与联调冒烟套件全部通过。

## 2. 运行时基线

已落地能力：

1. 启动校验：
   - 生产模式下拒绝弱密钥/默认密钥
   - 生产模式下要求配置数据库 URL
2. 健康探针：
   - `GET /livez`（存活）
   - `GET /readyz`（含 DB ping 的就绪）
3. 安全响应头：
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: no-referrer`
4. 优雅停机：
   - 处理 `SIGTERM` 与 `SIGINT`
   - 关闭 HTTP 服务与 DB 连接池
5. Docker 就绪检查：
   - 容器健康检查调用 `/readyz`

## 3. 生产环境变量要求

生产最小必填：

1. `NODE_ENV=production`
2. `API_KEY`（非默认值，建议至少 24 字符）
3. `ACCESS_TOKEN_SECRET`（建议至少 32 字符）
4. `REFRESH_TOKEN_SECRET`（建议至少 32 字符）
5. `DATABASE_URL`
6. `CORS_ALLOWED_ORIGINS`（生产环境避免使用 `*`）

数据库 SSL 开关：

1. `DB_SSL_MODE`：
   - 云数据库建议 `require`
   - 本地 Docker Postgres 使用 `disable`
2. `DB_SSL_REJECT_UNAUTHORIZED`：
   - 默认 `true`
   - 仅在证书链场景明确需要时设置为 `false`

## 4. 门禁命令

按顺序执行：

```bash
cd match-data-server
npm test
npm run test:db-phase
npm run test:phase-e
npm run test:joint-smoke
npm run test:web-joint-smoke
npm run test:prod-ready
npm run preflight:prod
```

若本地数据库未启用 SSL，可使用：

```bash
DB_SSL_MODE=disable npm run preflight:prod
```

预期结果：

1. 所有测试命令为 `0 failed`。
2. `preflight:prod` 输出：
   - `[preflight] PASS: production readiness checks completed`

## 5. 发布签字模板

发布前记录：

1. 时间：
2. 提交 SHA：
3. 目标环境：
4. 门禁命令输出：
5. 审批人（后端负责人）：
6. 审批人（QA/发布负责人）：
