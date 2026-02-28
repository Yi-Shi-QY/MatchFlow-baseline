# 数据分析 Agent 修改与扩展指南

本文档旨在指导开发者如何修改或扩展 MatchFlow 的数据分析 Agent。当你添加了新的数据源（如赔率、天气、裁判数据）后，你需要更新 Agent 的逻辑，使其能够理解并分析这些新数据。

## 1. Agent 架构概览

MatchFlow 的分析系统由多个专门的 Agent 协作完成，采用 **"规划 -> 执行 -> 总结"** 的流水线架构。

```mermaid
graph TD
    Start[开始分析] --> Input(输入 Match Data)
    Input --> Planner[规划 Agent (generateAnalysisPlan)]
    
    Planner -- 生成分析大纲 --> PlanList{分析计划列表}
    
    subgraph "循环执行 (针对每个 Segment)"
        PlanList -->|Segment N| Analyst[分析 Agent (streamAnalysisAgent)]
        Analyst -- 生成分析文本 & 动画数据 --> StreamOutput[流式输出]
        StreamOutput --> Tagger[标签生成 Agent (streamTagAgent)]
        Tagger -- 提取关键词 --> EnrichedSegment[完整片段数据]
    end
    
    EnrichedSegment --> UI[前端渲染]
    
    PlanList -->|所有片段完成| Summarizer[总结 Agent (streamSummaryAgent)]
    Summarizer --> FinalResult[最终预测 & 总结]
```

### 核心文件说明

- **`src/agents/`**: [核心] 包含所有 Agent 的定义。每个 Agent 都有自己的文件（如 `odds.ts`, `stats.ts`）。
- **`src/services/ai.ts`**: 包含 AI 请求的核心逻辑、流式处理以及多 Agent 的编排逻辑（如 `streamAgentThoughts`）。
- **`src/services/agentParser.ts`**: 负责解析 Agent 返回的流式文本（XML 风格标签），将其转换为结构化对象。

---

## 2. 实战演练：添加 "赔率分析" Agent (已内置)

**注意**: 本节内容作为教程保留，实际上 MatchFlow 2.0 已经内置了完整的赔率分析 Agent (`src/agents/odds.ts`)。你可以参考以下步骤来理解其实现原理，或用于添加其他类型的 Agent（如天气分析）。

假设你已经按照《赛事数据源扩展指南》在 `matchData` 中添加了 `odds` 字段。现在我们需要让 AI 分析这些赔率数据。

### 步骤 1: 修改规划逻辑 (Planning)

**目标**: 让规划 Agent 识别到新数据，并决定生成一个对应的分析片段。

MatchFlow 2.0 采用了双规划 Agent 模式：
- **模板规划 (`src/agents/planner_template.ts`)**: 使用工具选择预设模板。
- **自主规划 (`src/agents/planner_autonomous.ts`)**: 手动生成 JSON 计划。

如果你添加了新数据（如天气），你需要：
1. **更新模板规划**: 修改 `src/skills/planner/templates/` 下的模板定义，或者在 `planner_template.ts` 的 Prompt 中引导 AI 选择包含新数据的模板。
2. **更新自主规划**: 修改 `src/agents/planner_autonomous.ts` 的 Prompt，添加规则：`If weather data exists -> Add "Weather Impact" segment`。

### 步骤 2: 定义新的 Agent 角色 (Analysis)

**目标**: 为新类型的片段定义专门的 Agent，赋予它特定的人设。

1. **创建 Agent 文件**: 在 `src/agents/` 下创建新文件（如 `weather.ts`）。
2. **定义 Agent 配置**:
```typescript
// src/agents/weather.ts
import { AgentConfig } from './types';

export const weatherAgent: AgentConfig = {
  id: 'weather',
  name: 'Weather Analyst',
  description: 'Analyzes weather impact on the match.',
  systemPrompt: ({ matchData, language }) => {
    // 返回针对天气的 Prompt
    return language === 'zh' ? '你是一位气象专家...' : 'You are a weather expert...';
  }
};
```
3. **注册 Agent**: 在 `src/agents/index.ts` 中导出并添加到 `agents` 对象中。

### 步骤 3: 验证解析器 (Parser)
// ... 保持不变 ...

通常情况下，**不需要修改** `src/services/agentParser.ts`。

只要你的新 Agent 遵循 `basePrompt` 中的输出格式（即输出 `<title>`, `<thought>`, `<animation>` 标签），现有的解析器就能自动处理它，并将其渲染到前端。

**注意**: 如果你要求 Agent 输出特殊的自定义标签（例如 `<betting-tip>`），那么你才需要去修改 `agentParser.ts` 中的正则匹配逻辑。

---

## 3. 高级技巧：自定义动画数据

如果你希望 "赔率分析" 片段能展示一个特殊的图表（例如 "赔率变化趋势图"），你需要修改动画数据的生成逻辑。

1.  **修改 Prompt 中的 Animation Schema**:
    在 `streamAnalysisAgent` 函数中，`animationSchema` 定义了 AI 应该返回的 JSON 结构。你可以告诉 AI 在 `data` 字段中放入赔率特有的数据。

    ```typescript
    // src/services/ai.ts -> streamAnalysisAgent
    
    const animationSchema = `
      <animation>
      {
        "type": "${segmentPlan.animationType}", // AI 会根据 Plan 填入 'odds-chart'
        "data": {
           // 告诉 AI 这里可以放任意它觉得合适的数据
           "homeOdds": 1.5,
           "awayOdds": 4.0,
           "impliedHomeWin": "65%"
        }
      }
      </animation>`;
    ```

2.  **前端渲染适配**:
    你需要确保前端组件（`src/components/MatchAnalysis/AnalysisCard.tsx` 或 Remotion 组件）能够识别 `type: 'odds-chart'` 并渲染对应的 UI。

---

## 4. 调试与测试

1.  **查看日志**: 在 `streamAnalysisAgent` 中添加 `console.log(prompt)`，查看生成的 Prompt 是否包含了你的新指令。
2.  **模拟数据**: 在 `src/data/matches.ts` 的 `MOCK_MATCHES` 中手动添加测试用的 `odds` 数据，触发新逻辑。
3.  **检查流输出**: 观察控制台输出的 chunk，确认 AI 是否生成了 `<thought>` 和 `<animation>` 标签。
