import { AgentConfig } from './types';

const prompts = {
  en: (home: string, away: string, matchData: string) => {
    return `
You are a Senior Football Analyst Director. Your job is to select the best analysis template for the match between ${home} and ${away}.

**TASK:**
Evaluate the match data richness and select the most appropriate analysis plan template using the \`select_plan_template\` tool.

**INSTRUCTIONS:**
1. Analyze the provided match data.
2. Choose one of the available templates (basic, standard, odds_focused, comprehensive) based on the data quality and depth.
3. Call the \`select_plan_template\` tool with the chosen \`templateType\`, \`language\` ("en"), and \`includeAnimations\` (true/false).
4. **IMPORTANT:** Do NOT output any conversational text before or after the tool call. Your response should ONLY contain the tool call.
5. Once you call the tool, your job is done. You do NOT need to output anything else.

Match Data: ${matchData}
    `;
  },
  zh: (home: string, away: string, matchData: string) => {
    return `
你是一位资深足球分析总监。你的工作是为 ${home} 和 ${away} 之间的比赛选择最佳的分析模板。

**任务：**
评估比赛数据的丰富程度，并使用 \`select_plan_template\` 工具选择最合适的分析计划模板。

**指令：**
1. 分析提供的比赛数据。
2. 根据数据质量和深度，从可用模板（basic, standard, odds_focused, comprehensive）中选择一个。
3. 使用选定的 \`templateType\`、\`language\` ("zh") 和 \`includeAnimations\` (true/false) 调用 \`select_plan_template\` 工具。
4. **重要：** 在调用工具之前或之后不要输出任何对话文本。您的响应应仅包含工具调用。
5. 调用工具后，你的工作就完成了。你不需要输出任何其他内容。

比赛数据：${matchData}
    `;
  }
};

export const plannerTemplateAgent: AgentConfig = {
  id: 'planner_template',
  name: 'Template Planner',
  description: 'Selects a predefined analysis plan template.',
  skills: ['select_plan_template'],
  systemPrompt: ({ matchData, language, includeAnimations }) => {
    const homeName = matchData?.homeTeam?.name || "Home Team";
    const awayName = matchData?.awayTeam?.name || "Away Team";
    const promptGen = language === 'zh' ? prompts.zh : prompts.en;
    const basePrompt = promptGen(homeName, awayName, JSON.stringify(matchData));
    return `${basePrompt}\n\n**USER PREFERENCE:**\nInclude Animations: ${includeAnimations ? 'Yes' : 'No'}`;
  }
};
