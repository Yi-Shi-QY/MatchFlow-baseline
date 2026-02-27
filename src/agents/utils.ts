import { AgentContext } from './types';

export function buildAnalysisPrompt(rolePrompt: string, { segmentPlan, matchData, animationSchema }: AgentContext) {
  return `
    ${rolePrompt}

    **SEGMENT DETAILS:**
    - Title: "${segmentPlan.title}"
    - Focus: "${segmentPlan.focus}"
    - Animation Needed: ${segmentPlan.animationType !== 'none' ? 'YES (' + segmentPlan.animationType + ')' : 'NO'}

    **INSTRUCTIONS:**
    1. Write a **PROFESSIONAL ANALYSIS REPORT** for this segment. 
       - Do NOT write a "narration script" or "voiceover". 
       - Use a formal, analytical tone suitable for a written report.
       - Use bullet points, bold text, and clear structure.
       - Focus on data-driven insights.
    2. **MANDATORY ANIMATION:**
       - You MUST generate the <animation> block if "Animation Needed" is YES.
       - Populate the JSON with REAL numbers from the Match Data.
       - Do NOT use placeholder values like 0.
    3. Do NOT output any other segments. Focus ONLY on this one.

    **OUTPUT FORMAT:**
    <title>${segmentPlan.title}</title>
    <thought>
    (Your professional report here. Use Markdown formatting.)
    </thought>
    ${segmentPlan.animationType !== 'none' ? animationSchema : ''}

    Match Data: ${JSON.stringify(matchData)}
  `;
}
