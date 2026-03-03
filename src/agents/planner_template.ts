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

function getDomainTemplateOptions(domain: PlanningDomain): string[] {
  if (domain === 'basketball') {
    return [
      'basketball_basic',
      'basketball_standard',
      'basketball_lines_focused',
      'basketball_comprehensive',
    ];
  }
  if (domain === 'stocks') {
    return [
      'stocks_basic',
      'stocks_standard',
      'stocks_risk_focused',
      'stocks_comprehensive',
    ];
  }

  return ['basic', 'standard', 'odds_focused', 'comprehensive'];
}

function buildEnglishPrompt(
  home: string,
  away: string,
  matchData: string,
  domain: PlanningDomain,
) {
  const templateOptions = getDomainTemplateOptions(domain).join(', ');
  const domainLabel =
    domain === 'basketball'
      ? 'basketball game'
      : domain === 'stocks'
        ? 'stock analysis target'
        : 'football match';
  const directorRole =
    domain === 'basketball'
      ? 'Senior Basketball Analysis Director'
      : domain === 'stocks'
        ? 'Senior Equity Research Director'
        : 'Senior Football Analysis Director';

  return `
You are a ${directorRole}. Your job is to select the best analysis template for the ${domainLabel} between ${home} and ${away}.

**TASK:**
Evaluate data richness and select the most appropriate analysis plan template using the \`select_plan_template\` tool.

**INSTRUCTIONS:**
1. Analyze the provided game data and source context.
2. Choose one template from: (${templateOptions}).
3. Call \`select_plan_template\` with \`templateType\`, \`language\` ("en"), and \`includeAnimations\` (true/false).
4. **IMPORTANT:** Do NOT output conversational text before or after the tool call. Output only the tool call.
5. After calling the tool, stop.

Game Data: ${matchData}
  `;
}

function buildChinesePrompt(
  home: string,
  away: string,
  matchData: string,
  domain: PlanningDomain,
) {
  const templateOptions = getDomainTemplateOptions(domain).join(', ');
  const domainLabel =
    domain === 'basketball'
      ? '篮球比赛'
      : domain === 'stocks'
        ? '股票分析标的'
        : '足球比赛';
  const directorRole =
    domain === 'basketball'
      ? '资深篮球分析总监'
      : domain === 'stocks'
        ? '资深股票研究总监'
        : '资深足球分析总监';

  return `
你是一位${directorRole}。你的任务是为 ${home} vs ${away} 这场${domainLabel}选择最合适的分析模板。

**任务：**
评估数据丰富度，并通过 \`select_plan_template\` 工具选择最佳分析模板。

**指令：**
1. 分析给定数据和 sourceContext。
2. 必须从以下模板中选择一个：(${templateOptions})。
3. 使用选定的 \`templateType\`、\`language\` ("zh") 和 \`includeAnimations\` (true/false) 调用 \`select_plan_template\`。
4. **重要：** 不要在工具调用前后输出任何对话文本，回复中只能包含工具调用。
5. 调用工具后立即结束，不输出额外内容。

比赛数据: ${matchData}
  `;
}

export const plannerTemplateAgent: AgentConfig = {
  id: 'planner_template',
  name: 'Template Planner',
  description: 'Selects a predefined analysis plan template.',
  skills: ['select_plan_template'],
  systemPrompt: ({ matchData, language, includeAnimations }) => {
    const homeName = matchData?.homeTeam?.name || matchData?.participants?.home?.name || 'Home Team';
    const awayName = matchData?.awayTeam?.name || matchData?.participants?.away?.name || 'Away Team';
    const domain = resolvePlanningDomain(matchData);
    const basePrompt =
      language === 'zh'
        ? buildChinesePrompt(homeName, awayName, JSON.stringify(matchData), domain)
        : buildEnglishPrompt(homeName, awayName, JSON.stringify(matchData), domain);

    return `${basePrompt}\n\n**USER PREFERENCE:**\nInclude Animations: ${includeAnimations ? 'Yes' : 'No'}`;
  },
};
