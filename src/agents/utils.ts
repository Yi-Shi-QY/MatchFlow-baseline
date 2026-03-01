import { AgentContext } from './types';
import { en, zh, AnalysisPromptTemplate } from './prompts';

export function getPromptTemplate(language?: 'en' | 'zh'): AnalysisPromptTemplate {
  return language === 'zh' ? zh : en;
}

export function buildAnalysisPrompt(rolePrompt: string, context: AgentContext) {
  const { segmentPlan, matchData, language, previousAnalysis } = context;
  const template = getPromptTemplate(language);

  const role = rolePrompt || template.rolePrompt;

  let previousContextStr = '';
  if (previousAnalysis && previousAnalysis.trim().length > 0) {
    const mode = segmentPlan.contextMode || 'build_upon';
    let modeInstructionEn = '';
    let modeInstructionZh = '';

    if (mode === 'independent') {
      modeInstructionEn =
        'NOTE: You are provided with previous analysis for reference, but you should conduct an INDEPENDENT analysis from your specific perspective. It is okay to overlap or re-evaluate the same data if your angle is different (e.g., different betting markets).';
      modeInstructionZh =
        '注意：之前的分析仅供参考，你应从当前片段的专业视角进行独立分析。若分析角度不同（例如不同盘口），可以重复提及或重新评估同一组数据。';
    } else if (mode === 'compare') {
      modeInstructionEn =
        'NOTE: Please explicitly COMPARE your findings with the previous analysis. Highlight agreements or contradictions based on your specific domain.';
      modeInstructionZh =
        '注意：请明确将你的结论与前文分析进行对比，并基于你的专业领域指出一致点或矛盾点。';
    } else {
      modeInstructionEn =
        'NOTE: Please build upon the existing analysis above. **DO NOT repeat** basic information or conclusions already covered. Focus strictly on your specific domain.';
      modeInstructionZh =
        '注意：请在已有分析基础上继续深入，**不要重复**已出现的基础信息或结论，只聚焦你负责的细分领域。';
    }

    previousContextStr = `
    **${language === 'zh' ? '前序分析（上下文参考）' : 'PREVIOUS ANALYSIS (CONTEXT REFERENCE)'}:**
    ${previousAnalysis}

    *${language === 'zh' ? modeInstructionZh : modeInstructionEn}*
    `;
  }

  return `
    ${role}
    ${previousContextStr}

    **${language === 'zh' ? '片段信息' : 'SEGMENT DETAILS'}:**
    - ${template.segmentDetails.title}: "${segmentPlan.title}"
    - ${template.segmentDetails.focus}: "${segmentPlan.focus}"
    - ${template.segmentDetails.animationNeeded}: ${segmentPlan.animationType !== 'none' ? (language === 'zh' ? '是' : 'YES') + ' (' + segmentPlan.animationType + ')' : language === 'zh' ? '否' : 'NO'}

    **${language === 'zh' ? '指令' : 'INSTRUCTIONS'}:**
    1. ${template.instructions.report}
    2. ${template.instructions.animation}
    3. ${template.instructions.focus}

    **${language === 'zh' ? '输出格式' : 'OUTPUT FORMAT'}:**
    <${template.outputFormat.title}>${segmentPlan.title}</${template.outputFormat.title}>
    <${template.outputFormat.thought}>
    (${language === 'zh' ? '请在此输出你的专业分析报告，使用 Markdown 格式。' : 'Your professional report here. Use Markdown formatting.'})
    </${template.outputFormat.thought}>

    Match Data: ${JSON.stringify(matchData)}
  `;
}
