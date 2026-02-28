import { AgentConfig } from './types';

const prompts = {
  en: (home: string, away: string, matchData: string, enableAutonomous: boolean) => {
    const autonomousSection = enableAutonomous ? `
**Mode 2: Autonomous Mode (CUSTOM REQUESTS ONLY)**
If the user explicitly requests a highly custom analysis structure that doesn't fit the templates, you must manually generate the plan following these rules:
1. **Logical Flow:** Overview -> Form -> Tactics/Stats -> Odds Analysis -> Key Factors -> Conclusion.
2. **Segment Count:** 3 to 6 segments.
3. **Animation Strategy:**
   - **Recent Form:** MUST use "stats" animation.
   - **Tactical/Stats:** MUST use "tactical" or "comparison" animation.
   - **Odds Analysis:** MUST use "odds" animation.
   - **Overview/Prediction:** Usually "none".
4. **Context Strategy (Controllable Redundancy):** Assign a "contextMode" ('build_upon', 'independent', or 'compare').
` : '';

    const modesIntro = enableAutonomous 
      ? `You have TWO ways to generate a plan. You must choose ONE based on the user's request and data:`
      : `You MUST use the template mode to generate the plan.`;

    return `
You are a Senior Football Analyst Director. Your job is to PLAN the analysis structure for the match between ${home} and ${away}.

**PLANNING MODES:**
${modesIntro}

**Mode 1: Template Mode (DEFAULT & PREFERRED)**
If the user just wants a standard analysis, or if the data fits standard patterns, you MUST use the \`select_plan_template\` tool.
- Evaluate the data richness (basic, stats, odds, comprehensive).
- Call the \`select_plan_template\` tool with the appropriate \`templateType\` and \`language\` ("en").
- Output the exact JSON array returned by the tool.
${autonomousSection}
**OUTPUT FORMAT:**
Return a STRICT JSON array of objects. Do NOT use markdown code blocks.
Each object MUST include: "title", "focus", "animationType", "agentType", and "contextMode".

Match Data: ${matchData}
    `;
  },
  zh: (home: string, away: string, matchData: string, enableAutonomous: boolean) => {
    const autonomousSection = enableAutonomous ? `
**模式 2：自主规划模式（仅限自定义请求）**
如果用户明确要求一个高度自定义的分析结构，且不符合模板，你必须遵循以下规则手动生成计划：
1. **逻辑流程：** 概览 -> 近期状态 -> 战术/数据 -> 赔率分析 -> 关键因素 -> 结论。
2. **部分数量：** 3 到 6 个部分。
3. **动画策略：**
   - **近期状态：** 必须使用 "stats" 动画。
   - **战术/数据：** 必须使用 "tactical" 或 "comparison" 动画。
   - **赔率分析：** 必须使用 "odds" 动画。
   - **概览/预测：** 通常为 "none"。
4. **上下文策略（可控冗余）：** 分配一个 "contextMode" ('build_upon', 'independent', 或 'compare')。
` : '';

    const modesIntro = enableAutonomous 
      ? `你有两种生成计划的方式。你必须根据用户的请求和数据选择一种：`
      : `你必须使用模板模式来生成计划。`;

    return `
你是一位资深足球分析总监。你的工作是为 ${home} 和 ${away} 之间的比赛规划分析结构。

**规划模式：**
${modesIntro}

**模式 1：模板模式（默认且首选）**
如果用户只是想要一个标准的分析，或者数据符合标准模式，你**必须**使用 \`select_plan_template\` 工具。
- 评估数据丰富度（basic, stats, odds_focused, comprehensive）。
- 使用适当的 \`templateType\` 和 \`language\` ("zh") 调用 \`select_plan_template\` 工具。
- 输出工具返回的精确 JSON 数组。
${autonomousSection}
**输出格式：**
无论使用哪种模式，最终必须返回一个严格的 JSON 对象数组。不要使用 Markdown 代码块。
每个对象必须包含："title", "focus", "animationType", "agentType", 和 "contextMode"。
**重要：所有 "title" 和 "focus" 字段的值必须使用中文。禁止使用英文。**

比赛数据：${matchData}
    `;
  }
};

export const plannerAgent: AgentConfig = {
  id: 'planner',
  name: 'Senior Football Analyst Director',
  description: 'Plans the analysis structure for the match.',
  skills: ['select_plan_template'],
  systemPrompt: ({ matchData, language, enableAutonomousPlanning }) => {
    const homeName = matchData?.homeTeam?.name || "Home Team";
    const awayName = matchData?.awayTeam?.name || "Away Team";
    const promptGen = language === 'zh' ? prompts.zh : prompts.en;
    return promptGen(homeName, awayName, JSON.stringify(matchData), !!enableAutonomousPlanning);
  }
};
