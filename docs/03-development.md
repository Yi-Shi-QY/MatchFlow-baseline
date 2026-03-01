# Development Guide / 开发指南

## EN

### 1. Prerequisites

1. Node.js 22+
2. npm
3. Android Studio (for Android builds)
4. Xcode (for iOS builds on macOS)
5. Optional: Docker + PostgreSQL (for server integration testing)

### 2. App Development

Install dependencies:

```bash
npm install
```

Run web dev server:

```bash
npm run dev
```

Lint / type checks:

```bash
npm run lint
```

Build web bundle:

```bash
npm run build
```

### 3. Capacitor Workflow

Sync web assets to native projects:

```bash
npm run cap:sync
```

Generate app assets:

```bash
npm run cap:assets
```

Open native projects:

```bash
npx cap open android
npx cap open ios
```

### 4. Match Data Server

Start local server:

```bash
cd match-data-server
npm install
npm run dev
```

If PostgreSQL is not configured, server runs in mock mode.

### 5. Android Emulator + Local Server Debug Checklist

Use this when Android emulator cannot connect to local `match-data-server`.

1. Start server and verify logs:

```bash
cd match-data-server
npm run dev
```

Expected log:

- `Match Data Server running on port 3001`

2. Verify server from host machine:

```powershell
Invoke-WebRequest http://localhost:3001/health
$h=@{Authorization='Bearer your-secret-key'}
Invoke-WebRequest -Uri "http://localhost:3001/matches?limit=1" -Headers $h
```

3. In app Settings (on emulator), use:

- `Server URL`: `http://10.0.2.2:3001`
- `API Key`: value from `match-data-server/.env` (`API_KEY`)
  If `.env` is missing, default is `your-secret-key`.

4. In emulator browser, open:

- `http://10.0.2.2:3001/health`

If browser cannot open this URL, issue is emulator network/firewall, not app logic.

5. Re-sync native project and reinstall app:

```bash
npx cap sync android
```

Then rebuild/reinstall in Android Studio.

6. Address mapping:

- Android Studio Emulator -> host: `10.0.2.2`
- Genymotion -> host: `10.0.3.2`
- Physical phone (same LAN) -> host Wi-Fi IPv4 (e.g. `192.168.x.x`)

### 6. Android Emulator + External AI Model Debug Checklist

Use this when emulator cannot connect to DeepSeek / OpenAI-compatible / Gemini endpoints.

1. Verify emulator internet access in browser (open any HTTPS site).
2. Test AI connection from Settings page and check error message.
3. For DeepSeek:
   - Provider: `DeepSeek`
   - Model: `deepseek-chat` or `deepseek-reasoner`
   - API key must be valid and non-empty.
4. For OpenAI-compatible:
   - Base URL must include protocol, for example `https://api.openai.com/v1`
   - Do not append `/chat/completions` manually.
5. If using local proxy/certificate tools:
   - Ensure emulator proxy is configured correctly.
   - If HTTPS certificate is intercepted, install/trust the required user certificate in emulator.
6. After native config changes, always run:

```bash
npx cap sync android
```

### 7. High-Frequency Debug Scenarios

1. Match list is empty:
   - Check Settings: `matchDataServerUrl` and `matchDataApiKey`.
   - Server may be unreachable or unauthorized.
2. Analysis route is unexpected:
   - Inspect payload `sourceContext`.
   - Check `/analysis/config/*` response from server.
3. Extension auto-install fails:
   - Verify hub endpoints and auth.
   - Validate extension manifest schema (`kind/id/version/...`).
4. Chinese text is corrupted:
   - Ensure UTF-8 encoding.
   - Check i18n dictionaries and prompt files.

### 8. Commit Discipline

1. Keep feature and docs updates in same commit/PR.
2. Run at least `npm run lint` before commit.
3. For server API changes, update:
   - `docs/08-server-api-guide.md`
   - `docs/09-server-deploy-and-database-guide.md`

## ZH

### 1. 前置条件

1. Node.js 22+
2. npm
3. Android Studio（用于 Android 构建）
4. Xcode（用于 macOS 上的 iOS 构建）
5. 可选：Docker + PostgreSQL（用于服务端联调）

### 2. App 开发

安装依赖：

```bash
npm install
```

启动前端开发服务：

```bash
npm run dev
```

执行 Lint / 类型检查：

```bash
npm run lint
```

构建 Web 产物：

```bash
npm run build
```

### 3. Capacitor 工作流

同步 Web 产物到原生工程：

```bash
npm run cap:sync
```

生成 App 资源：

```bash
npm run cap:assets
```

打开原生工程：

```bash
npx cap open android
npx cap open ios
```

### 4. Match Data Server

启动本地服务端：

```bash
cd match-data-server
npm install
npm run dev
```

如果未配置 PostgreSQL，服务端会使用 mock 模式运行。

### 5. Android 模拟器连接本地服务端排查清单

当 Android 模拟器无法连接本机 `match-data-server` 时，按以下步骤排查。

1. 启动服务端并确认日志：

```bash
cd match-data-server
npm run dev
```

期望日志包含：

- `Match Data Server running on port 3001`

2. 在宿主机本地验证接口：

```powershell
Invoke-WebRequest http://localhost:3001/health
$h=@{Authorization='Bearer your-secret-key'}
Invoke-WebRequest -Uri "http://localhost:3001/matches?limit=1" -Headers $h
```

3. 在模拟器 App 的设置页填写：

- `Server URL`：`http://10.0.2.2:3001`
- `API Key`：`match-data-server/.env` 中的 `API_KEY`
  若无 `.env`，默认是 `your-secret-key`。

4. 在模拟器浏览器直接访问：

- `http://10.0.2.2:3001/health`

如果浏览器也无法访问，优先检查模拟器网络或 Windows 防火墙，不是 App 业务逻辑问题。

5. 每次原生配置变更后都执行：

```bash
npx cap sync android
```

然后在 Android Studio 里重新安装 App。

6. 地址映射规则：

- Android Studio 模拟器访问宿主机：`10.0.2.2`
- Genymotion 访问宿主机：`10.0.3.2`
- 真机同一局域网访问宿主机：宿主机 Wi-Fi IPv4（例如 `192.168.x.x`）

### 6. Android 模拟器连接外部 AI 模型排查清单

当模拟器无法连接 DeepSeek / OpenAI-Compatible / Gemini 时，按以下步骤排查。

1. 先在模拟器浏览器确认可访问任意 HTTPS 网站。
2. 在设置页执行“测试 AI 连接”，记录错误信息。
3. DeepSeek 模式检查：
   - Provider 选择 `DeepSeek`
   - Model 使用 `deepseek-chat` 或 `deepseek-reasoner`
   - API Key 必须有效且非空
4. OpenAI-Compatible 模式检查：
   - Base URL 必须带协议，例如 `https://api.openai.com/v1`
   - 不要手动拼接 `/chat/completions`
5. 如果使用代理/证书工具：
   - 确认模拟器代理设置正确
   - 若 HTTPS 被拦截，需要在模拟器安装并信任对应用户证书
6. 原生网络配置改动后，务必执行：

```bash
npx cap sync android
```

### 7. 高频问题排查

1. 赛事列表为空：
   - 检查设置中的 `matchDataServerUrl` 与 `matchDataApiKey`
   - 服务端可能不可达或鉴权失败
2. 分析路由不符合预期：
   - 检查请求 payload 的 `sourceContext`
   - 检查服务端 `/analysis/config/*` 返回
3. 扩展自动安装失败：
   - 检查 hub 接口与鉴权
   - 检查扩展 manifest 结构（`kind/id/version/...`）
4. 中文乱码：
   - 确认文件编码为 UTF-8
   - 检查 i18n 字典和 prompt 文件

### 8. 提交流程建议

1. 功能改动和文档更新尽量放在同一个 commit/PR。
2. 提交前至少执行一次 `npm run lint`。
3. 服务端 API 变更后，同步更新：
   - `docs/08-server-api-guide.md`
   - `docs/09-server-deploy-and-database-guide.md`
