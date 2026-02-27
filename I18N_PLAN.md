# MatchFlow 2.0 国际化 (i18n) 实施规划

为了支持多语言（当前主要为 **中文** 和 **英文**），我们需要在 **GUI 交互层** 和 **Agent 逻辑层** 分别实施国际化策略。

---

## 1. 架构概览

我们将采用 **双层 i18n 架构**：

1.  **GUI 层**: 使用 `react-i18next` 管理界面文本（按钮、标签、静态文案）。
2.  **Agent 层**: 通过 **动态 Prompt 注入** 机制，确保 AI 的思考过程、输出结果（分析报告、视频旁白）与用户选择的语言一致。

**核心原则**: 用户的语言选择（Language Preference）是单一数据源，存储在本地设置中，同时驱动 UI 渲染和 Agent 的 System Prompt 构建。

---

## 2. 第一部分：GUI 国际化 (界面)

### 2.1 技术选型
*   **库**: `i18next`, `react-i18next`
*   **检测**: `i18next-browser-languagedetector` (自动检测浏览器语言)
*   **后端**: `i18next-http-backend` (可选，如果想动态加载 JSON，但本项目建议直接打包进 bundle 以支持离线/本地环境)

### 2.2 文件结构
```
src/
  i18n/
    index.ts          # i18n 初始化配置
    locales/
      zh-CN.json      # 中文翻译资源
      en-US.json      # 英文翻译资源
```

### 2.3 实施细节
*   **资源文件**: 将 `MatchDetail.tsx` 等页面中的硬编码中文提取到 `zh-CN.json`，并翻译对应的 `en-US.json`。
*   **组件改造**: 使用 `useTranslation` Hook 替换文本。
    ```tsx
    // Before
    <Button>开始分析</Button>

    // After
    const { t } = useTranslation();
    <Button>{t('analysis.start')}</Button>
    ```

---

## 3. 第二部分：Agent 国际化 (提示词)

这是本项目的特殊之处。仅仅翻译 UI 是不够的，我们需要 AI 用对应的语言进行思考和输出。

### 3.1 挑战
*   **结构化数据**: Planner Agent 输出的是 JSON。我们需要它生成的 Key (如 `animationType`) 保持英文（代码逻辑依赖），但 Value (如 `title`, `focus`) 必须是目标语言。
*   **语境差异**: 某些足球术语在不同语言下的表达习惯不同（例如 "让球胜平负" vs "Handicap Win/Draw/Loss"）。

### 3.2 解决方案：Prompt 模板化

我们需要改造 `src/agents/types.ts` 中的 `AgentConfig` 接口，使其 `systemPrompt` 能够接收语言参数。

**修改前**:
```typescript
systemPrompt: (context: any) => string;
```

**修改后**:
```typescript
// 定义支持的语言类型
export type Language = 'zh' | 'en';

// Context 中增加 lang 字段
export interface AgentContext {
  matchData: any;
  lang: Language; // <--- 新增
  // ...其他字段
}

systemPrompt: (context: AgentContext) => string;
```

### 3.3 各 Agent 的适配策略

#### A. Planner Agent (规划者)
*   **策略**: 在 System Prompt 中明确约束 JSON 内容的语言。
*   **Prompt 示例 (动态拼接)**:
    ```typescript
    const prompt = `
      You are a Senior Football Analyst.
      ...
      OUTPUT RULES:
      1. The JSON Keys (e.g., "title", "focus", "agentType") MUST be in English.
      2. The JSON Values for "title" and "focus" MUST be in ${lang === 'zh' ? 'CHINESE (Simplified)' : 'ENGLISH'}.
    `;
    ```

#### B. Odds Agent (赔率专家)
*   **策略**: 赔率术语（HAD, HHAD）通常通用，但解读分析需要本地化。
*   **Prompt 示例**:
    *   **CN**: "你是一个竞彩分析师，请分析胜平负和让球数据..."
    *   **EN**: "You are a betting analyst. Please analyze the 1X2 and Handicap odds..."
    *   *建议*: 针对 Odds Agent，维护两套完全独立的 Prompt 模板，因为中文竞彩（Jingcai）的规则描述与国际博彩有细微差异。

#### C. Analyst Agent (分析师)
*   **策略**: 控制输出的 `<thought>` 和 `<animation>` 内容。
*   **Prompt 注入**:
    ```
    IMPORTANT: All your analysis, narration scripts, and chart labels MUST be in ${lang === 'zh' ? 'Chinese' : 'English'}.
    ```

---

## 4. 实施路线图

### 阶段一：基础设施搭建
1.  安装 `i18next` 相关依赖。
2.  创建 `src/i18n` 目录并配置初始化文件。
3.  在 `Settings` (设置服务) 中添加 `language` 字段，并与 i18next 同步。

### 阶段二：Agent 核心改造 (高优先级)
1.  修改 `AgentConfig` 接口。
2.  更新 `src/services/ai.ts`，在调用 Agent 时传入当前语言设置。
3.  重构 `Planner` 和 `Odds` Agent 的 Prompt 生成逻辑，支持多语言。

### 阶段三：UI 文本替换 (工作量最大)
1.  提取 `MatchDetail.tsx` 中的文本。
2.  提取 `Home.tsx` 和 `Settings.tsx` 中的文本。
3.  提取组件库中的文本。

### 阶段四：验证
1.  切换语言为英文。
2.  执行一次完整的分析流程。
3.  检查：
    *   UI 按钮是否变英文。
    *   Agent 的思考气泡 (`<thought>`) 是否为英文。
    *   生成的视频中，标题和旁白是否为英文。
    *   PDF 导出是否正常（英文环境下无需特殊字体处理，但需确保布局兼容）。

---
