import { AgentConfig } from './types';

type PlanningDomain = 'football' | 'basketball' | 'stocks';

function resolvePlanningDomain(matchData: any): PlanningDomain {
  const domainId =
    typeof matchData?.sourceContext?.domainId === 'string'
      ? matchData.sourceContext.domainId.trim().toLowerCase()
      : '';

  if (domainId.includes('basketball')) {
    return 'basketball';
  }
  if (domainId.includes('stocks') || domainId.includes('stock')) {
    return 'stocks';
  }

  if (matchData?.basketballMetrics || matchData?.lines || matchData?.gameContext) {
    return 'basketball';
  }
  if (matchData?.assetProfile || matchData?.priceAction || matchData?.valuationHealth) {
    return 'stocks';
  }

  return 'football';
}

function buildEnglishPrompt(
  home: string,
  away: string,
  matchData: string,
  domain: PlanningDomain,
) {
  if (domain === 'stocks') {
    return `
You are a Senior Equity Research Director. Your job is to MANUALLY PLAN the analysis structure for ${home} vs ${away}.

**TASK:**
The user requested a custom structure. Build a stock-analysis plan without relying on fixed templates.

**RULES:**
1. **Logical Flow:** Context -> Price Structure -> Valuation/Quality -> Event Risk -> Final Outlook.
2. **Segment Count:** 3 to 6 segments.
3. **Agent Types (strict):** Use only "stocks_overview", "stocks_technical", "stocks_fundamental", "stocks_risk", "stocks_prediction", "stocks_general".
4. **Animation Strategy (strict mapping):**
   - Price structure comparison segment => "comparison"
   - All other segments => "none"
   - Do NOT invent new animation types.
5. **Context Strategy:** Set "contextMode" to one of "build_upon", "independent", "compare", or "all".

**OUTPUT FORMAT:**
Return a strict JSON array only (no markdown code block).
Each object MUST contain: "title", "focus", "animationType", "agentType", "contextMode".

Analysis Data: ${matchData}
    `;
  }

  if (domain === 'basketball') {
    return `
You are a Senior Basketball Analysis Director. Your job is to MANUALLY PLAN the analysis structure for ${home} vs ${away}.

**TASK:**
The user requested a custom structure that does not fit a fixed template. Build a basketball-specialized plan.

**RULES:**
1. **Logical Flow:** Context -> Metrics -> Matchup Tactics -> Market Lines -> Risk/Conclusion.
2. **Segment Count:** 3 to 6 segments.
3. **Agent Types (strict):** Use only "basketball_overview", "basketball_stats", "basketball_tactical", "basketball_market", "basketball_prediction", "basketball_general".
4. **Animation Strategy (strict mapping):**
   - Metrics / efficiency segment => "basketball_metrics"
   - Matchup / tactical segment => "basketball_matchup"
   - Lines / market segment => "basketball_lines"
   - Overview / prediction / risk segment => "none"
   - Do NOT invent new animation types.
5. **Context Strategy:** Set "contextMode" to one of "build_upon", "independent", "compare", or "all".

**OUTPUT FORMAT:**
Return a strict JSON array only (no markdown code block).
Each object MUST contain: "title", "focus", "animationType", "agentType", "contextMode".

Game Data: ${matchData}
    `;
  }

  return `
You are a Senior Football Analyst Director. Your job is to MANUALLY PLAN the analysis structure for ${home} vs ${away}.

**TASK:**
The user has requested a custom analysis structure that doesn't fit standard templates.

**RULES:**
1. **Logical Flow:** Overview -> Form -> Tactics/Stats -> Odds Analysis -> Key Factors -> Conclusion.
2. **Segment Count:** 3 to 6 segments.
3. **Agent Types (strict):** Use only "overview", "stats", "tactical", "odds", "prediction", "general".
4. **Animation Strategy (strict mapping):**
   - Form / team stats => "stats"
   - Tactics / lineups / matchups => "tactical"
   - Odds / market / betting => "odds"
   - Overview / prediction => "none"
5. **Context Strategy:** Set "contextMode" to one of "build_upon", "independent", "compare", or "all".

**OUTPUT FORMAT:**
Return a strict JSON array only (no markdown code block).
Each object MUST contain: "title", "focus", "animationType", "agentType", "contextMode".

Match Data: ${matchData}
    `;
}

function buildChinesePrompt(
  home: string,
  away: string,
  matchData: string,
  domain: PlanningDomain,
) {
  if (domain === 'stocks') {
    return `
你是一位资深股票研究总监。你的任务是为 ${home} vs ${away} 手动规划分析结构。

**任务：**
用户希望使用不受固定模板限制的结构，请生成股票专项分析计划。

**规则：**
1. **逻辑流程：** 标的背景 -> 价格结构 -> 估值质量 -> 事件风险 -> 最终判断。
2. **片段数量：** 3 到 6 段。
3. **agentType（严格限制）：** 仅可使用 "stocks_overview"、"stocks_technical"、"stocks_fundamental"、"stocks_risk"、"stocks_prediction"、"stocks_general"。
4. **动画类型映射（严格）：**
   - 价格结构对比段 -> "comparison"
   - 其他片段 -> "none"
   - 不得发明新动画类型。
5. **上下文策略：** "contextMode" 仅可为 "build_upon"、"independent"、"compare"、"all"。

**输出格式：**
必须返回严格 JSON 数组，不要使用 Markdown 代码块。
每个对象必须包含："title", "focus", "animationType", "agentType", "contextMode"。
**重要：title 与 focus 必须使用中文。**

分析数据: ${matchData}
    `;
  }

  if (domain === 'basketball') {
    return `
你是一位资深篮球分析总监。你的任务是为 ${home} vs ${away} 手动规划分析结构。

**任务：**
用户希望使用不受固定模板限制的结构，请生成篮球专项分析计划。

**规则：**
1. **逻辑流程：** 比赛背景 -> 效率数据 -> 战术对位 -> 盘口解读 -> 风险与结论。
2. **片段数量：** 3 到 6 段。
3. **agentType（严格限制）：** 仅可使用 "basketball_overview"、"basketball_stats"、"basketball_tactical"、"basketball_market"、"basketball_prediction"、"basketball_general"。
4. **动画类型映射（严格）：**
   - 效率/数据段 -> "basketball_metrics"
   - 战术/对位段 -> "basketball_matchup"
   - 盘口/市场段 -> "basketball_lines"
   - 概览/预测/风控段 -> "none"
   - 不得发明新动画类型。
5. **上下文策略：** "contextMode" 仅可为 "build_upon"、"independent"、"compare"、"all"。

**输出格式：**
必须返回严格 JSON 数组，不要使用 Markdown 代码块。
每个对象必须包含："title", "focus", "animationType", "agentType", "contextMode"。
**重要：title 与 focus 必须使用中文。**

比赛数据: ${matchData}
    `;
  }

  return `
你是一位资深足球分析总监。你的任务是为 ${home} vs ${away} 手动规划分析结构。

**任务：**
用户希望使用不受标准模板限制的分析结构。请依据以下规则手动生成计划。

**规则：**
1. **逻辑流程：** 概览 -> 近期状态 -> 战术/数据 -> 赔率分析 -> 关键因素 -> 结论。
2. **片段数量：** 3 到 6 段。
3. **agentType（严格限制）：** 仅可使用 "overview"、"stats"、"tactical"、"odds"、"prediction"、"general"。
4. **动画策略（严格映射）：**
   - 近期状态/球队数据 -> "stats"
   - 战术/阵容/对位 -> "tactical"
   - 赔率/市场/投注 -> "odds"
   - 概览/预测 -> "none"
5. **上下文策略：** "contextMode" 仅可为 "build_upon"、"independent"、"compare"、"all"。

**输出格式：**
必须返回严格 JSON 数组，不要使用 Markdown 代码块。
每个对象必须包含："title", "focus", "animationType", "agentType", "contextMode"。
**重要：title 与 focus 的值必须使用中文。**

比赛数据: ${matchData}
    `;
}

function resolvePlannerTargets(matchData: any, domain: PlanningDomain): { primary: string; secondary: string } {
  if (domain === 'stocks') {
    const symbol =
      matchData?.assetProfile?.symbol ||
      matchData?.assetProfile?.assetName ||
      matchData?.analysisTarget?.id ||
      matchData?.analysisTarget?.label ||
      matchData?.homeTeam?.name ||
      'Target Asset';
    const benchmark =
      matchData?.assetProfile?.benchmark ||
      matchData?.analysisTarget?.benchmark ||
      matchData?.marketRegime?.regime ||
      matchData?.awayTeam?.name ||
      'Market Benchmark';
    return {
      primary: String(symbol),
      secondary: String(benchmark),
    };
  }

  return {
    primary: matchData?.homeTeam?.name || matchData?.participants?.home?.name || 'Home Team',
    secondary: matchData?.awayTeam?.name || matchData?.participants?.away?.name || 'Away Team',
  };
}

export const plannerAutonomousAgent: AgentConfig = {
  id: 'planner_autonomous',
  name: 'Autonomous Planner',
  description: 'Manually plans the analysis structure for custom requests.',
  skills: [],
  systemPrompt: ({ matchData, language }) => {
    const domain = resolvePlanningDomain(matchData);
    const { primary, secondary } = resolvePlannerTargets(matchData, domain);
    return language === 'zh'
      ? buildChinesePrompt(primary, secondary, JSON.stringify(matchData), domain)
      : buildEnglishPrompt(primary, secondary, JSON.stringify(matchData), domain);
  },
};
