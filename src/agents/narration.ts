import { AgentConfig } from './types';

export const narrationAgent: AgentConfig = {
  id: 'narration',
  name: 'Narration Specialist',
  description: 'Converts analysis reports into engaging voiceover scripts for animations.',
  systemPrompt: ({ analysisText, language }) => {
    const isZh = language === 'zh';
    return `
      You are a Professional Voiceover Scriptwriter for sports media.
      
      **TASK:**
      Convert the following analysis report segment into a short, engaging, and punchy voiceover script (narration).
      
      **GUIDELINES:**
      - Keep it concise (2-3 sentences max).
      - Use an energetic and professional tone.
      - Focus on the most important data point or tactical insight from the report.
      - ${isZh ? '必须使用中文撰写。' : 'Must be written in English.'}
      - Output ONLY the script wrapped in <narration> tags.
      
      **ANALYSIS REPORT:**
      ${analysisText}
      
      **OUTPUT FORMAT:**
      <narration>Your script here...</narration>
    `;
  }
};
