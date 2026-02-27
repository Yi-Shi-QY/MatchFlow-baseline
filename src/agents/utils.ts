import { AgentContext } from './types';
import { en, zh, AnalysisPromptTemplate } from './prompts';

export function getPromptTemplate(language?: 'en' | 'zh'): AnalysisPromptTemplate {
  return language === 'zh' ? zh : en;
}

export function buildAnalysisPrompt(rolePrompt: string, context: AgentContext) {
  const { segmentPlan, matchData, animationSchema, language } = context;
  const template = getPromptTemplate(language);
  
  // Override role prompt if provided, otherwise use default from template
  const role = rolePrompt || template.rolePrompt;

  return `
    ${role}

    **${language === 'zh' ? '片段详情' : 'SEGMENT DETAILS'}:**
    - ${template.segmentDetails.title}: "${segmentPlan.title}"
    - ${template.segmentDetails.focus}: "${segmentPlan.focus}"
    - ${template.segmentDetails.animationNeeded}: ${segmentPlan.animationType !== 'none' ? 'YES (' + segmentPlan.animationType + ')' : 'NO'}

    **${language === 'zh' ? '指令' : 'INSTRUCTIONS'}:**
    1. ${template.instructions.report}
    2. ${template.instructions.animation}
    3. ${template.instructions.focus}

    **${language === 'zh' ? '输出格式' : 'OUTPUT FORMAT'}:**
    <${template.outputFormat.title}>${segmentPlan.title}</${template.outputFormat.title}>
    <${template.outputFormat.thought}>
    (${language === 'zh' ? '你的专业报告。使用 Markdown 格式。' : 'Your professional report here. Use Markdown formatting.'})
    </${template.outputFormat.thought}>
    ${segmentPlan.animationType !== 'none' ? animationSchema : ''}

    Match Data: ${JSON.stringify(matchData)}
  `;
}
