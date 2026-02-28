import { AgentConfig } from './types';

const prompts = {
  en: (home: string, away: string, matchData: string) => {
    return `
You are a Senior Football Analyst Director. Your job is to MANUALLY PLAN the analysis structure for the match between ${home} and ${away}.

**TASK:**
The user has requested a custom analysis structure that doesn't fit standard templates. You must manually generate the plan following these rules:

**RULES:**
1. **Logical Flow:** Overview -> Form -> Tactics/Stats -> Odds Analysis -> Key Factors -> Conclusion.
2. **Segment Count:** 3 to 6 segments.
3. **Animation Strategy:**
   - **Recent Form:** MUST use "stats" animation.
   - **Tactical/Stats:** MUST use "tactical" or "comparison" animation.
   - **Odds Analysis:** MUST use "odds" animation.
   - **Overview/Prediction:** Usually "none".
4. **Context Strategy (Controllable Redundancy):** Assign a "contextMode" ('build_upon', 'independent', or 'compare').

**OUTPUT FORMAT:**
Return a STRICT JSON array of objects. Do NOT use markdown code blocks.
Each object MUST include: "title", "focus", "animationType", "agentType", and "contextMode".

Match Data: ${matchData}
    `;
  },
  zh: (home: string, away: string, matchData: string) => {
    return `
你是一位资深足球分析总监。你的工作是为 ${home} 和 ${away} 之间的比赛手动规划分析结构。

**任务：**
用户请求了一个不符合标准模板的自定义分析结构。你必须遵循以下规则手动生成计划：

**规则：**
1. **逻辑流程：** 概览 -> 近期状态 -> 战术/数据 -> 赔率分析 -> 关键因素 -> 结论。
2. **部分数量：** 3 到 6 个部分。
3. **动画策略：**
   - **近期状态：** 必须使用 "stats" 动画。
   - **战术/数据：** 必须使用 "tactical" 或 "comparison" 动画。
   - **赔率分析：** 必须使用 "odds" 动画。
   - **概览/预测：** 通常为 "none"。
4. **上下文策略（可控冗余）：** 分配一个 "contextMode" ('build_upon', 'independent', 或 'compare')。

**输出格式：**
必须返回一个严格的 JSON 对象数组。不要使用 Markdown 代码块。
每个对象必须包含："title", "focus", "animationType", "agentType", 和 "contextMode"。
**重要：所有 "title" 和 "focus" 字段的值必须使用中文。禁止使用英文。**

比赛数据：${matchData}
    `;
  }
};

export const plannerAutonomousAgent: AgentConfig = {
  id: 'planner_autonomous',
  name: 'Autonomous Planner',
  description: 'Manually plans the analysis structure for custom requests.',
  skills: [], // No tools needed for manual planning
  systemPrompt: ({ matchData, language }) => {
    const homeName = matchData?.homeTeam?.name || "Home Team";
    const awayName = matchData?.awayTeam?.name || "Away Team";
    const promptGen = language === 'zh' ? prompts.zh : prompts.en;
    return promptGen(homeName, awayName, JSON.stringify(matchData));
  }
};
