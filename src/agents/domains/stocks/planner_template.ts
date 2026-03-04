import { AgentConfig } from '../../types';

function resolveTargets(matchData: any): { asset: string; benchmark: string } {
  const fromProfile = matchData?.assetProfile;
  return {
    asset:
      fromProfile?.symbol ||
      fromProfile?.assetName ||
      matchData?.homeTeam?.name ||
      'Target Asset',
    benchmark:
      fromProfile?.benchmark ||
      matchData?.awayTeam?.name ||
      'Benchmark',
  };
}

function buildPrompt(
  asset: string,
  benchmark: string,
  payload: string,
  language: 'en' | 'zh',
) {
  return `
You are a Senior Equity Analysis Director. Select the best plan template for ${asset} against ${benchmark}.
${language === 'zh' ? '如需自然语言，请使用中文。只输出工具调用。' : ''}

TASK:
Choose one template through \`select_plan_template\` based on source richness and analysis intent.

INSTRUCTIONS:
1. Review sourceContext and all available signals.
2. Choose exactly one template from: (stocks_basic, stocks_standard, stocks_risk_focused, stocks_comprehensive).
3. Call \`select_plan_template\` with \`templateType\`, \`language\` ("${language}"), and \`includeAnimations\`.
4. IMPORTANT: Output only the tool call with no extra text.
5. Stop after the tool call.

Input Data: ${payload}
`;
}

export const stocksPlannerTemplateAgent: AgentConfig = {
  id: 'stocks_planner_template',
  name: 'Stocks Template Planner',
  description: 'Selects a stock-analysis template based on available signals.',
  skills: ['select_plan_template'],
  systemPrompt: ({ matchData, language, includeAnimations }) => {
    const lang = language === 'zh' ? 'zh' : 'en';
    const { asset, benchmark } = resolveTargets(matchData);
    const base = buildPrompt(asset, benchmark, JSON.stringify(matchData), lang);
    return `${base}\n\nUSER PREFERENCE:\nInclude Animations: ${includeAnimations ? 'Yes' : 'No'}`;
  },
};
