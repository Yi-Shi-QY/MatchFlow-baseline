# Development Guide / 开发指南

## EN

## 1. Prerequisites

1. Node.js 18+
2. npm
3. Android Studio (Android builds)
4. Xcode (iOS builds on macOS)
5. Optional:
   - Docker + PostgreSQL for server integration testing

## 2. App Development

Install:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Type-check:

```bash
npm run lint
```

Build web bundle:

```bash
npm run build
```

## 3. Capacitor Workflow

Sync web assets to native:

```bash
npm run cap:sync
```

Generate app assets:

```bash
npm run cap:assets
```

Open projects:

```bash
npx cap open android
npx cap open ios
```

## 4. Match Data Server

Start local server:

```bash
cd match-data-server
npm install
npm run dev
```

When no PostgreSQL is configured, server runs in mock mode.

## 5. High-Frequency Debug Scenarios

1. Match list empty:
   - Check Settings: `matchDataServerUrl` + `matchDataApiKey`.
   - Server may be unreachable or unauthorized.
2. Analysis route unexpected:
   - Inspect payload `sourceContext`.
   - Check server `/analysis/config/*` response.
3. Extension auto-install fails:
   - Verify hub endpoints and auth.
   - Validate manifest schema (`kind/id/version/...`).
4. Chinese text corrupted:
   - Ensure file encoding is UTF-8.
   - Check i18n dictionaries and prompt files.

## 6. Commit Discipline

1. Keep feature + docs updates in same commit/PR.
2. Run at least `npm run lint` before commit.
3. For server API changes, update docs:
   - `08-server-api-guide.md`
   - `09-server-deploy-and-database-guide.md`

## ZH

## 1. 前置环境

1. Node.js 18+
2. npm
3. Android Studio（Android）
4. Xcode（macOS 下 iOS）
5. 可选：
   - Docker + PostgreSQL（服务端联调）

## 2. 前端开发

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run dev
```

类型检查：

```bash
npm run lint
```

构建产物：

```bash
npm run build
```

## 3. Capacitor 工作流

同步 Web 构建到原生工程：

```bash
npm run cap:sync
```

生成图标和启动图：

```bash
npm run cap:assets
```

打开原生工程：

```bash
npx cap open android
npx cap open ios
```

## 4. 数据服务端

本地启动：

```bash
cd match-data-server
npm install
npm run dev
```

未配置 PostgreSQL 时，服务端会进入 mock 模式。

## 5. 常见调试场景

1. 赛事列表为空：
   - 检查设置中的 `matchDataServerUrl`、`matchDataApiKey`。
   - 服务端可能不可达或鉴权失败。
2. 分析路由不符合预期：
   - 检查请求 payload 的 `sourceContext`。
   - 检查 `/analysis/config/*` 返回。
3. 扩展自动安装失败：
   - 检查 hub 接口和鉴权。
   - 检查 manifest 结构合法性。
4. 中文乱码：
   - 确认文件编码 UTF-8。
   - 检查 i18n 词典与 prompt 文件。

## 6. 提交规范

1. 功能改动与文档更新同一提交或同一 PR 完成。
2. 提交前至少执行 `npm run lint`。
3. 服务端 API 改动后必须更新：
   - `08-server-api-guide.md`
   - `09-server-deploy-and-database-guide.md`

