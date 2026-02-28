# MatchFlow 2.0 项目架构与开发指南

本文档旨在为开发者提供 MatchFlow 2.0 项目的全面概览，包括项目结构、核心架构设计、以及如何进行维护和功能扩展。

## 1. 项目概览

**MatchFlow 2.0** 是一个基于 Web 技术构建的本地化智能足球分析平台，支持移动端（Android/iOS）打包。它利用大语言模型（LLM）对赛事数据进行深度分析，并生成可视化的动态演示视频。

### 核心特性

*   **双 AI 引擎**: 支持 Google Gemini 和 DeepSeek。
*   **智能分析流水线**: 采用 "Planner -> Analyst -> Tagger -> Summarizer" 的 Agent 协作模式。
*   **动态视频生成**: 使用 Remotion 技术将分析结果转化为 React 组件视频。
*   **本地优先**: 数据存储在本地，保护用户隐私。
*   **跨平台**: 一套代码，同时支持 Web、Android 和 iOS。

---

## 2. 项目结构

```
/
├── android/                 # Android 原生工程文件 (Capacitor 生成)
├── ios/                     # iOS 原生工程文件 (Capacitor 生成)
├── match-data-server/       # [独立服务] 赛事数据服务端 (Node.js + Express + PostgreSQL)
│   ├── index.js             # 服务端入口
│   ├── db.js                # 数据库连接池
│   ├── schema.sql           # 数据库结构定义
│   └── ...
├── src/                     # 前端核心代码 (React)
│   ├── agents/              # [核心] AI Agent 定义与逻辑
│   │   ├── planner_template.ts   # 模板规划 Agent
│   │   ├── planner_autonomous.ts # 自主规划 Agent
│   │   ├── odds.ts          # 赔率分析 Agent
│   │   ├── ...              # 其他 Agent (stats, tactical, etc.)
│   │   └── index.ts         # Agent 注册表
│   ├── components/          # UI 组件
│   │   ├── MatchAnalysis/   # 分析页相关组件 (AnalysisCard, AgentThoughtBubble)
│   │   ├── Remotion/        # 视频生成相关组件
│   │   └── ...
│   ├── data/                # 静态数据与 Mock 数据
│   ├── pages/               # 页面组件 (Home, MatchDetail, Settings)
│   ├── services/            # 业务逻辑服务
│   │   ├── ai.ts            # LLM 调用与流式处理核心
│   │   ├── matchService.ts  # 赛事数据获取
│   │   └── settings.ts      # 设置管理
│   ├── skills/              # Agent 可调用的工具函数 (Calculator, Search)
│   ├── App.tsx              # 根组件与路由配置
│   └── main.tsx             # 入口文件
├── capacitor.config.ts      # Capacitor 配置文件
├── vite.config.ts           # Vite 构建配置
└── ...
```

---

## 3. 核心架构设计

### 3.1 AI 分析流水线 (The Analysis Pipeline)

MatchFlow 的核心是一个流式的多 Agent 协作系统，位于 `src/services/ai.ts`。

1.  **Planner (规划)**:
    *   **输入**: 原始比赛数据 (Match Data)。
    *   **职责**: 分析数据丰富度，决定分析的“剧本”（Segment List）。
    *   **模式**: 支持“模板规划”和“自主规划”两种模式，通过设置开关切换。模板模式已优化为工具调用后立即返回，响应极快。
    *   **输出**: JSON 格式的分析计划数组。

2.  **Analyst (执行分析)**:
    *   **输入**: 比赛数据 + 当前环节的计划 (Segment Plan)。
    *   **职责**: 根据环节类型（如 `tactical`, `odds`），调用对应的 Agent Prompt 进行深度分析。
    *   **输出**: 流式文本，包含 `<thought>` (思考过程) 和 `<animation>` (动画描述数据)。

3.  **Renderer (渲染)**:
    *   **输入**: `<animation>` 标签中的 JSON 数据。
    *   **职责**: 前端解析这些数据，并动态加载对应的 Remotion 组件 (`src/components/Remotion/*`) 进行渲染。

### 3.2 数据流 (Data Flow)

*   **赛事数据**:
    *   **源头**: `match-data-server` (或 Mock 数据)。
    *   **获取**: `src/services/matchService.ts` 通过 HTTP 请求获取。
    *   **流转**: 数据被传递给 `Planner` 生成计划，随后被传递给各个 `Analyst` Agent。

*   **用户设置**:
    *   存储在 `localStorage`。
    *   通过 `src/services/settings.ts` 进行读写。
    *   包含 API Key、模型选择、数据源 URL 等。

### 3.3 移动端适配 (Mobile Adaptation)

*   使用 **Capacitor** 将 Web 应用封装为 Native App。
*   **路由**: 使用 `HashRouter` (在 `main.tsx` 中配置)，确保在文件系统协议 (`file://`) 下路由正常工作。
*   **安全**: 网络请求需配置 CORS 或使用 Capacitor 的 HTTP 插件（目前主要使用原生 `fetch`，依赖后端 CORS 配置）。

---

## 4. 维护与扩展指南

### 4.1 添加新的数据源 (例如：天气数据)

1.  **后端 (`match-data-server`)**:
    *   修改 `schema.sql`: `ALTER TABLE matches ADD COLUMN weather JSONB;`
    *   修改 `index.js`: 在 `POST /admin/matches` 和 `GET /matches` 中处理 `weather` 字段。
    *   更新 `DATABASE_GUIDE.md`。

2.  **前端数据层**:
    *   修改 `src/data/matches.ts`: 更新 `Match` 接口定义，添加 `weather` 字段。

3.  **AI 分析层**:
    *   **新建 Agent**: 创建 `src/agents/weather.ts`，定义 Prompt (如何分析天气对比赛的影响)。
    *   **注册 Agent**: 在 `src/agents/index.ts` 中注册。
    *   **更新 Planner**: 修改 `src/agents/planner_template.ts` 或 `src/agents/planner_autonomous.ts`，增加规则：`If weather data exists -> Add "Weather Impact" segment`。

4.  **UI 层**:
    *   (可选) 在 `MatchDetail.tsx` 中展示天气图标。
    *   (可选) 创建新的 Remotion 组件 `WeatherAnimation.tsx`，并在 `src/components/Remotion/index.tsx` 中注册。

### 4.2 切换/升级 AI 模型

*   **配置**: 用户可在“设置”页面直接修改模型名称（例如从 `gemini-1.5-flash` 切换到 `gemini-1.5-pro`）。
*   **代码适配**: `src/services/ai.ts` 封装了模型调用逻辑。如果引入新的模型提供商（如 Anthropic），需在此文件中添加适配逻辑。

### 4.3 调试技巧

*   **Agent 调试**: 在 `src/services/ai.ts` 的 `streamAnalysisAgent` 中打印 `prompt`，查看生成的提示词是否符合预期。
*   **动画调试**: Remotion 提供了一个可视化的预览器。你可以单独运行 Remotion 预览命令（需在 `package.json` 中配置）来调试动画组件。
*   **真机调试**: 使用 `npx cap open android` 或 `npx cap open ios` 打开原生工程，利用 IDE 的 Logcat/Console 查看原生日志。

---

## 5. 常见问题 (FAQ)

*   **Q: 为什么生成的视频在手机上无法播放？**
    *   A: 检查视频编码格式。Remotion 默认生成 MP4 (H.264)，通常兼容性良好。确保设备有足够的内存进行渲染。

*   **Q: 如何更新数据库 Schema？**
    *   A: 请参考 `match-data-server/DATABASE_GUIDE.md`。生产环境建议使用迁移工具（如 Knex.js 或 Prisma），目前开发环境直接使用 SQL 脚本。

*   **Q: 扫码功能在 Web 端不可用？**
    *   A: 浏览器的摄像头权限策略要求必须在 HTTPS 环境下才能调用摄像头。本地开发 (`localhost`) 通常支持，但在局域网 IP 访问时可能受限。

---

**文档版本**: 1.0
**最后更新**: 2026-02-26
