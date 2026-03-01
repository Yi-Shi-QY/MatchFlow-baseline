# CI/CD Guide / 持续集成与持续交付指南

## EN

## 1. Workflow Overview

This repository uses GitHub Actions with two workflows:

1. `.github/workflows/ci.yml`
   - Runs on pull requests and pushes to `main` / `develop`
   - Checks app quality and server runtime health
2. `.github/workflows/cd.yml`
   - Runs on pushes to `main`, version tags (`v*.*.*`), and manual dispatch
   - Builds web artifact, publishes server Docker image, and creates release on tags

## 2. CI Pipeline (Quality Gate)

## 2.1 App Quality Job

1. `npm ci`
2. `npm run lint` (TypeScript check)
3. `npm run build`

## 2.2 Server Quality Job

1. `npm install` in `match-data-server`
2. `node --check` for entry and route/service modules
3. Mock-mode startup smoke:
   - start server with `API_KEY=ci-secret`
   - check `/health`
   - check authenticated `/matches`

## 3. CD Pipeline (Delivery)

## 3.1 Web Artifact Job

1. Build app (`npm ci`, `npm run build`)
2. Compress `dist` into `web-dist.tar.gz`
3. Upload artifact `web-dist`

## 3.2 Docker Image Job

1. Build `match-data-server` Docker image
2. Push image to `ghcr.io/<owner>/<repo>/match-data-server`
3. Tag strategy:
   - branch ref
   - git tag
   - commit sha
   - `latest` on default branch

## 3.3 GitHub Release Job

1. Triggered only on `v*.*.*` tags
2. Attaches `web-dist.tar.gz` to release
3. Auto-generates release notes

## 4. Required Permissions and Secrets

Current setup uses built-in `GITHUB_TOKEN`:

1. `packages: write` for GHCR push
2. `contents: write` for release creation

No additional secrets are required for base pipeline.

Optional future secrets:

1. cloud deployment credentials
2. production API keys for post-release smoke tests

## 5. Release Convention

1. Merge stable changes into `main`
2. Create annotated tag:

```bash
git tag -a vX.Y.Z -m "release vX.Y.Z"
git push origin vX.Y.Z
```

3. CD workflow publishes:
   - web artifact
   - server image
   - GitHub release

## 6. Recommended Next Enhancements

1. Add unit/integration test jobs when test suite is available.
2. Add security scan (dependency and container scan).
3. Add deployment jobs (staging/prod) after environment decision.

## ZH

## 1. 工作流总览

仓库采用两条 GitHub Actions 工作流：

1. `.github/workflows/ci.yml`
   - 在 PR 与 `main/develop` push 时执行
   - 负责质量门禁（前端检查 + 服务端运行检查）
2. `.github/workflows/cd.yml`
   - 在 `main` push、版本 tag（`v*.*.*`）与手动触发时执行
   - 负责构建 Web 产物、发布服务端 Docker 镜像、按 tag 创建 Release

## 2. CI 流程（质量门禁）

## 2.1 前端质量任务

1. `npm ci`
2. `npm run lint`（TypeScript 检查）
3. `npm run build`

## 2.2 服务端质量任务

1. 在 `match-data-server` 执行 `npm install`
2. 对入口和模块执行 `node --check`
3. mock 模式启动冒烟：
   - `API_KEY=ci-secret` 启动服务
   - 验证 `/health`
   - 验证带鉴权的 `/matches`

## 3. CD 流程（交付）

## 3.1 Web 产物任务

1. 构建前端（`npm ci` + `npm run build`）
2. 将 `dist` 打包为 `web-dist.tar.gz`
3. 上传构建产物 `web-dist`

## 3.2 Docker 镜像任务

1. 构建 `match-data-server` 镜像
2. 推送到 `ghcr.io/<owner>/<repo>/match-data-server`
3. 标签策略：
   - 分支名
   - Git Tag
   - Commit SHA
   - 默认分支的 `latest`

## 3.3 GitHub Release 任务

1. 仅在 `v*.*.*` tag 触发
2. 将 `web-dist.tar.gz` 附加到 Release
3. 自动生成 Release Notes

## 4. 权限与 Secrets

当前方案仅依赖内置 `GITHUB_TOKEN`：

1. `packages: write` 用于 GHCR 推送
2. `contents: write` 用于创建 Release

基础方案无需额外 secrets。

后续可选：

1. 云平台部署凭据
2. 发布后验收所需生产密钥

## 5. 发布约定

1. 稳定代码合并到 `main`
2. 打版本 tag：

```bash
git tag -a vX.Y.Z -m "release vX.Y.Z"
git push origin vX.Y.Z
```

3. CD 自动发布：
   - Web 构建产物
   - 服务端镜像
   - GitHub Release

## 6. 后续增强建议

1. 测试体系完善后加入单元/集成测试任务。
2. 增加安全扫描（依赖与镜像）。
3. 确定环境后加入 staging/prod 自动部署任务。

