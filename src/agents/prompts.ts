import { AgentContext } from './types';

export interface AnalysisPromptTemplate {
  rolePrompt: string;
  segmentDetails: {
    title: string;
    focus: string;
    animationNeeded: string;
  };
  instructions: {
    report: string;
    animation: string;
    focus: string;
  };
  outputFormat: {
    title: string;
    thought: string;
  };
}

export const en: AnalysisPromptTemplate = {
  rolePrompt: "You are a Senior Football Analyst.",
  segmentDetails: {
    title: "Title",
    focus: "Focus",
    animationNeeded: "Animation Needed"
  },
  instructions: {
    report: `Write a **PROFESSIONAL ANALYSIS REPORT** for this segment. 
       - Do NOT write a "narration script" or "voiceover". 
       - Use a formal, analytical tone suitable for a written report.
       - Use bullet points, bold text, and clear structure.
       - Focus on data-driven insights.`,
    animation: `**MANDATORY ANIMATION:**
       - You MUST generate the <animation> block if "Animation Needed" is YES.
       - Populate the JSON with REAL numbers from the Match Data.
       - Do NOT use placeholder values like 0.`,
    focus: "Do NOT output any other segments. Focus ONLY on this one."
  },
  outputFormat: {
    title: "title",
    thought: "thought"
  }
};

export const zh: AnalysisPromptTemplate = {
  rolePrompt: "你是一位资深足球分析师。",
  segmentDetails: {
    title: "标题",
    focus: "重点",
    animationNeeded: "需要动画"
  },
  instructions: {
    report: `为该片段撰写一份**专业分析报告**。
       - **必须使用中文撰写报告。**
       - 不要写“旁白脚本”或“配音稿”。
       - 使用适合书面报告的正式、分析性语气。
       - 使用项目符号、粗体文本和清晰的结构。
       - 专注于数据驱动的见解。`,
    animation: `**强制动画生成：**
       - 如果“需要动画”为 YES，你必须生成 <animation> 块。
       - 使用比赛数据中的真实数字填充 JSON。
       - 不要使用像 0 这样的占位符。`,
    focus: "不要输出任何其他片段。只关注这一个。"
  },
  outputFormat: {
    title: "title", // Keep XML tags in English for easier parsing
    thought: "thought"
  }
};
