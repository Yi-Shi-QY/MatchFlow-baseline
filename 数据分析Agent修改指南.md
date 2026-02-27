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

- **`src/services/ai.ts`**: 包含所有 Agent 的 Prompt 定义和调用逻辑。
- **`src/services/agentParser.ts`**: 负责解析 Agent 返回的流式文本（XML 风格标签），将其转换为结构化对象。

---

## 2. 实战演练：添加 "赔率分析" Agent (已内置)

**注意**: 本节内容作为教程保留，实际上 MatchFlow 2.0 已经内置了完整的赔率分析 Agent (`src/agents/odds.ts`)。你可以参考以下步骤来理解其实现原理，或用于添加其他类型的 Agent（如天气分析）。

假设你已经按照《赛事数据源扩展指南》在 `matchData` 中添加了 `odds` 字段。现在我们需要让 AI 分析这些赔率数据。

### 步骤 1: 修改规划逻辑 (Planning)

**目标**: 让规划 Agent 识别到赔率数据，并决定生成一个 "Odds Analysis" 的分析片段。

打开 `src/services/ai.ts`，找到 `generateAnalysisPlan` 函数。

1.  **修改 Prompt**: 在 `prompt` 变量中，明确告诉 AI 如果发现赔率数据该怎么做。

```typescript
// src/services/ai.ts

const prompt = `
  // ... 原有内容 ...
  
  **CRITICAL PLANNING RULES:**
  1. **Analyze Data Richness:**
     - If only basic info -> Plan 3 segments.
     - If stats available -> Add "Tactical Analysis".
     - [新增] If "odds" data is available -> You MUST add a segment with agentType: 'odds'.
  
  // ... 原有内容 ...
  
  **OUTPUT FORMAT:**
  // ...
  agentType: 'overview' | 'stats' | 'tactical' | 'prediction' | 'general' | 'odds' // [新增] 'odds' 类型
`;
```

### 步骤 2: 定义新的 Agent 角色 (Analysis)

**目标**: 为 `odds` 类型的片段定义专门的 Prompt，赋予它 "博彩分析师" 的人设。

打开 `src/services/ai.ts`，找到 `getAnalysisPrompt` 函数。

1.  **添加 Case 分支**: 在 `switch (agentType)` 中添加 `case 'odds'`。

```typescript
// src/services/ai.ts

function getAnalysisPrompt(agentType: string, segmentPlan: any, matchData: any, animationSchema: string): string {
  // ... basePrompt 定义保持不变 ...

  switch (agentType) {
    case 'overview':
      return `You are a Lead Sports Journalist...`;
    
    // [新增] 赔率分析师角色
    case 'odds':
      return `
        You are a Professional Betting Analyst. 
        Your goal is to interpret the market sentiment based on the provided odds.
        
        **Specific Instructions:**
        - Analyze the 'odds' object in the Match Data.
        - Compare Home/Draw/Away odds to determine the implied probability.
        - Identify if there is a clear favorite or if the market is split.
        - Do NOT encourage gambling; focus on what the numbers say about the match expectation.
        
        ${basePrompt}
      `;

    case 'stats':
      // ...
  }
}
```

### 步骤 3: 验证解析器 (Parser)

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
