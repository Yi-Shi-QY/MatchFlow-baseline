import { AgentContext } from './types';
import { en, zh, AnalysisPromptTemplate } from './prompts';

export function getPromptTemplate(language?: 'en' | 'zh'): AnalysisPromptTemplate {
  return language === 'zh' ? zh : en;
}

export function buildAnalysisPrompt(rolePrompt: string, context: AgentContext) {
  const { segmentPlan, matchData, language, previousAnalysis, animationSchema } = context;
  const template = getPromptTemplate(language);
  
  // Override role prompt if provided, otherwise use default from template
  const role = rolePrompt || template.rolePrompt;

  let previousContextStr = '';
  if (previousAnalysis && previousAnalysis.trim().length > 0) {
    const mode = segmentPlan.contextMode || 'build_upon';
    let modeInstructionEn = '';
    let modeInstructionZh = '';

    if (mode === 'independent') {
      modeInstructionEn = 'NOTE: You are provided with previous analysis for reference, but you should conduct an INDEPENDENT analysis from your specific perspective. It is okay to overlap or re-evaluate the same data if your angle is different (e.g., different betting markets).';
      modeInstructionZh = '注意：提供之前的分析仅供参考，你应该从你特定的角度进行【独立分析】。如果你的视角不同（例如不同的盘口），重复提及或重新评估相同的数据是允许的。';
    } else if (mode === 'compare') {
      modeInstructionEn = 'NOTE: Please explicitly COMPARE your findings with the previous analysis. Highlight agreements or contradictions based on your specific domain.';
      modeInstructionZh = '注意：请明确将你的发现与之前的分析进行【对比】。基于你的专业领域，指出一致或矛盾之处。';
    } else {
      // default: build_upon
      modeInstructionEn = 'NOTE: Please build upon the existing analysis above. **DO NOT repeat** basic information or conclusions already covered. Focus strictly on your specific domain.';
      modeInstructionZh = '注意：请基于上述已有的分析进行深入，**不要重复**已经提到的基本信息或结论，专注于你负责的特定领域。';
    }

    previousContextStr = `
    **${language === 'zh' ? '之前的分析（上下文参考）' : 'PREVIOUS ANALYSIS (CONTEXT REFERENCE)'}:**
    ${previousAnalysis}
    
    *${language === 'zh' ? modeInstructionZh : modeInstructionEn}*
    `;
  }

  const animationInstruction = animationSchema ? `
    **${language === 'zh' ? '动画 JSON 架构' : 'ANIMATION JSON SCHEMA'}:**
    ${animationSchema}
    
    ${language === 'zh' ? '注意：在 <animation> 块中，你必须为 "narration" 字段编写一段简短、引人入胜的解说词（配音稿）。这与书面报告不同，它是为视频演示准备的。' : 'NOTE: In the <animation> block, you MUST write a short, engaging voiceover script for the "narration" field. This is separate from the written report and is intended for the video presentation.'}
  ` : '';

  return `
    ${role}
    ${previousContextStr}

    **${language === 'zh' ? '片段详情' : 'SEGMENT DETAILS'}:**
    - ${template.segmentDetails.title}: "${segmentPlan.title}"
    - ${template.segmentDetails.focus}: "${segmentPlan.focus}"
    - ${template.segmentDetails.animationNeeded}: ${segmentPlan.animationType !== 'none' ? 'YES (' + segmentPlan.animationType + ')' : 'NO'}

    **${language === 'zh' ? '指令' : 'INSTRUCTIONS'}:**
    1. ${template.instructions.report}
    2. ${template.instructions.focus}

    **${language === 'zh' ? '输出格式' : 'OUTPUT FORMAT'}:**
    <${template.outputFormat.title}>${segmentPlan.title}</${template.outputFormat.title}>
    <${template.outputFormat.thought}>
    (${language === 'zh' ? '你的专业报告。使用 Markdown 格式。' : 'Your professional report here. Use Markdown formatting.'})
    </${template.outputFormat.thought}>

    Match Data: ${JSON.stringify(matchData)}
  `;
}
