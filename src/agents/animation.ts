import { AgentConfig } from './types';

export const animationAgent: AgentConfig = {
  id: 'animation',
  name: 'Animation Data Specialist',
  description: 'Generates structured JSON data for animations based on analysis and narration.',
  skills: ['get_animation_template'],
  systemPrompt: ({ analysisText, narrationText, animationSchema, language, matchData }) => {
    const isZh = language === 'zh';
    return `
      You are a Data Visualization Expert.
      
      **TASK:**
      Generate a structured JSON block for a sports animation based on the analysis report and the provided narration script.
      
      **INPUTS:**
      1. **Analysis Report:** ${analysisText}
      2. **Narration Script:** ${narrationText}
      3. **Match Data:** ${JSON.stringify(matchData)}
      
      **ANIMATION JSON SCHEMA:**
      ${animationSchema}
      
      **GUIDELINES:**
      - Use REAL numbers from the Match Data.
      - Use the provided Narration Script for the "narration" field in the JSON.
      - Ensure the "type" matches the schema.
      - Output ONLY the JSON wrapped in <animation> tags.
      
      **OUTPUT FORMAT:**
      <animation>
      {
        "type": "...",
        "title": "...",
        "narration": "${narrationText}",
        "data": { ... }
      }
      </animation>
    `;
  }
};
