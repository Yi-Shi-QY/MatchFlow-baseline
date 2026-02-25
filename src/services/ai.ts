import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { getSettings } from "./settings";
import { REMOTION_RULES } from "./remotionRules";

let aiInstance: GoogleGenAI | null = null;

export function getGeminiAI(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export interface MatchAnalysis {
  prediction: string;
  keyFactors: string[];
  winProbability: {
    home: number;
    draw: number;
    away: number;
  };
  expectedGoals: {
    home: number;
    away: number;
  };
}

export async function analyzeMatch(matchData: any): Promise<MatchAnalysis> {
  const settings = getSettings();
  const prompt = `
    Analyze the following football match data and provide a detailed prediction, key factors, win probabilities, and expected goals (xG).
    Match Data: ${JSON.stringify(matchData)}
    
    You MUST return the response in strict JSON format matching this schema:
    {
      "prediction": "A short, engaging prediction text for the match outcome.",
      "keyFactors": ["factor 1", "factor 2", "factor 3"],
      "winProbability": { "home": 40, "draw": 30, "away": 30 },
      "expectedGoals": { "home": 1.5, "away": 1.2 }
    }
  `;

  if (settings.provider === "deepseek") {
    if (!settings.deepseekApiKey) {
      throw new Error("DeepSeek API Key is not configured in settings.");
    }

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: settings.model || "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(
        err.error?.message || `DeepSeek API error: ${response.statusText}`
      );
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || "";

    // Attempt to extract JSON from the text, as DeepSeek might wrap it in markdown
    const jsonMatch =
      text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;

    try {
      return JSON.parse(jsonStr) as MatchAnalysis;
    } catch (e) {
      console.error("Failed to parse DeepSeek JSON response:", text);
      throw new Error("Invalid JSON response from DeepSeek");
    }
  } else {
    // Gemini
    const ai = getGeminiAI();
    const response = await ai.models.generateContent({
      model: settings.model || "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prediction: {
              type: Type.STRING,
              description:
                "A short, engaging prediction text for the match outcome.",
            },
            keyFactors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "3-5 key tactical or statistical factors that will decide the match.",
            },
            winProbability: {
              type: Type.OBJECT,
              properties: {
                home: {
                  type: Type.NUMBER,
                  description: "Home team win probability (0-100)",
                },
                draw: {
                  type: Type.NUMBER,
                  description: "Draw probability (0-100)",
                },
                away: {
                  type: Type.NUMBER,
                  description: "Away team win probability (0-100)",
                },
              },
              required: ["home", "draw", "away"],
            },
            expectedGoals: {
              type: Type.OBJECT,
              properties: {
                home: {
                  type: Type.NUMBER,
                  description: "Home team expected goals (e.g., 1.5)",
                },
                away: {
                  type: Type.NUMBER,
                  description: "Away team expected goals (e.g., 0.8)",
                },
              },
              required: ["home", "away"],
            },
          },
          required: [
            "prediction",
            "keyFactors",
            "winProbability",
            "expectedGoals",
          ],
        },
      },
    });

    const jsonStr = response.text?.trim() || "{}";
    return JSON.parse(jsonStr) as MatchAnalysis;
  }
}

export async function testConnection(settings: any): Promise<boolean> {
  try {
    if (settings.provider === "deepseek") {
      if (!settings.deepseekApiKey) {
        throw new Error("DeepSeek API Key is not configured.");
      }
      const response = await fetch(
        "https://api.deepseek.com/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.deepseekApiKey}`,
          },
          body: JSON.stringify({
            model: settings.model || "deepseek-chat",
            messages: [{ role: "user", content: "Hello" }],
            max_tokens: 5,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          err.error?.message || `HTTP error! status: ${response.status}`
        );
      }
      return true;
    } else {
      const ai = getGeminiAI();
      await ai.models.generateContent({
        model: settings.model || "gemini-3-flash-preview",
        contents: "Hello",
      });
      return true;
    }
  } catch (e: any) {
    console.error("Connection test failed:", e);
    // Provide a more helpful message for Failed to fetch
    if (e.message === "Failed to fetch") {
      throw new Error(
        "网络请求失败。这可能是由于网络问题、API地址无效或跨域(CORS)限制导致。请检查您的网络连接或API密钥。"
      );
    }
    throw e;
  }
}

async function* streamAIRequest(prompt: string, includeReasoning: boolean = false) {
  const settings = getSettings();
  if (settings.provider === "deepseek") {
    if (!settings.deepseekApiKey) {
      yield "[错误] 未配置 DeepSeek API Key。请在设置中配置。";
      return;
    }

    try {
      const response = await fetch(
        "https://api.deepseek.com/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.deepseekApiKey}`,
          },
          body: JSON.stringify({
            model: settings.model || "deepseek-chat",
            messages: [{ role: "user", content: prompt }],
            stream: true,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          err.error?.message || `HTTP error! status: ${response.status}`
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No reader available");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          if (line === "data: [DONE]") return;
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              let content = "";
              if (includeReasoning && data.choices[0]?.delta?.reasoning_content) {
                content = data.choices[0]?.delta?.reasoning_content;
              } else if (data.choices[0]?.delta?.content) {
                content = data.choices[0]?.delta?.content;
              }
              if (content) {
                yield content;
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (e: any) {
      yield `\n[错误] DeepSeek API 错误: ${
        e.message === "Failed to fetch" ? "网络或跨域(CORS)错误" : e.message
      }`;
    }
  } else {
    // Gemini
    const ai = getGeminiAI();
    try {
      const response = await ai.models.generateContentStream({
        model: settings.model || "gemini-3-flash-preview",
        contents: prompt,
      });

      for await (const chunk of response) {
        yield (chunk as GenerateContentResponse).text;
      }
    } catch (e: any) {
      yield `\n[错误] Gemini API 错误: ${e.message}`;
    }
  }
}

export async function generateAnalysisPlan(matchData: any): Promise<any[]> {
  const homeName = matchData?.homeTeam?.name || "Home Team";
  const awayName = matchData?.awayTeam?.name || "Away Team";
  
  const prompt = `
    You are a Senior Football Analyst Director. Your job is to PLAN the analysis structure for the match between ${homeName} and ${awayName}.
    
    **CRITICAL PLANNING RULES:**
    1. **Analyze Data Richness:** Look at the provided Match Data.
       - If only basic info -> Plan 3 segments (Overview, Form, Prediction).
       - If stats available -> Add "Tactical Analysis" segments.
       - If custom info available -> Add specific segments.
    2. **Avoid Redundancy:** Group related stats.
    3. **Logical Flow:** Overview -> Form -> Tactics/Stats -> Key Factors -> Conclusion.
    4. **Segment Count:** 3 to 6 segments.

    **OUTPUT FORMAT:**
    Return a STRICT JSON array of objects. Do NOT use markdown code blocks.
    Each object MUST include an "agentType" field: 'overview' | 'stats' | 'tactical' | 'prediction' | 'general'.
    
    Example:
    [
      { "title": "Match Overview", "focus": "Context and stakes", "animationType": "none", "agentType": "overview" },
      { "title": "Recent Form", "focus": "Compare last 5 games", "animationType": "stats", "agentType": "stats" },
      { "title": "Tactical Battle", "focus": "Possession and control", "animationType": "tactical", "agentType": "tactical" }
    ]

    Match Data: ${JSON.stringify(matchData)}
  `;

  const settings = getSettings();
  let responseText = "";

  if (settings.provider === "deepseek") {
    if (!settings.deepseekApiKey) throw new Error("DeepSeek API Key missing");
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: settings.model || "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        stream: false
      }),
    });
    const data = await response.json();
    responseText = data.choices[0]?.message?.content || "[]";
  } else {
    const ai = getGeminiAI();
    const response = await ai.models.generateContent({
      model: settings.model || "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });
    responseText = response.text || "[]";
  }

  try {
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("Failed to parse plan JSON", e);
    return [
      { title: "Match Overview", focus: "General context", animationType: "none", agentType: "overview" },
      { title: "Key Analysis", focus: "Main talking points", animationType: "none", agentType: "general" }
    ];
  }
}

function getAnalysisPrompt(agentType: string, segmentPlan: any, matchData: any, animationSchema: string): string {
  const basePrompt = `
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
    2. If Animation is needed, generate the <animation> block with REAL data.
    3. Do NOT output any other segments. Focus ONLY on this one.

    **OUTPUT FORMAT:**
    <title>${segmentPlan.title}</title>
    <thought>
    (Your professional report here. Use Markdown formatting.)
    </thought>
    ${segmentPlan.animationType !== 'none' ? animationSchema : ''}

    Match Data: ${JSON.stringify(matchData)}
  `;

  switch (agentType) {
    case 'overview':
      return `You are a Lead Sports Journalist. Write a compelling introduction setting the stage, history, and stakes of the match.\n${basePrompt}`;
    case 'stats':
      return `You are a Data Scientist. Analyze the numbers deeply. Compare form, head-to-head records, and key metrics. Be precise.\n${basePrompt}`;
    case 'tactical':
      return `You are a Tactical Analyst (like Gary Neville). Break down the formations, key battles, and strategic approaches. Use technical terms.\n${basePrompt}`;
    case 'prediction':
      return `You are a Senior Pundit. Weigh all factors and provide a reasoned prediction. Discuss psychological factors.\n${basePrompt}`;
    default:
      return `You are a Senior Football Analyst.\n${basePrompt}`;
  }
}

export async function* streamAnalysisAgent(matchData: any, segmentPlan: any) {
  const homeName = matchData?.homeTeam?.name || "Home Team";
  const awayName = matchData?.awayTeam?.name || "Away Team";
  
  const animationSchema = `
    <animation>
    {
      "type": "${segmentPlan.animationType}",
      "title": "${segmentPlan.title}",
      "narration": "A short, engaging voiceover script for this animation.",
      "data": {
        "homeLabel": "${homeName}", "awayLabel": "${awayName}",
        "homeValue": 0, "awayValue": 0,
        "metric": "Label"
      }
    }
    </animation>`;

  const prompt = getAnalysisPrompt(segmentPlan.agentType || 'general', segmentPlan, matchData, animationSchema);

  yield* streamAIRequest(prompt, false);
}

export async function* streamTagAgent(analysisText: string) {
  const prompt = `
    Analyze the following football analysis text and extract 3-5 key "tags" or insights.
    
    **ANALYSIS TEXT:**
    ${analysisText}

    **RULES:**
    - Tags should be short (2-4 words).
    - Classify each tag by team ('home', 'away') or 'neutral'.
    - Assign a sentiment/type if applicable.

    **OUTPUT FORMAT:**
    Output ONLY a <tags> block containing a valid JSON array.
    <tags>
    [
      { "label": "High Pressing", "team": "home", "color": "emerald" },
      { "label": "Weak Defense", "team": "away", "color": "blue" },
      { "label": "Title Decider", "team": "neutral", "color": "zinc" }
    ]
    </tags>
  `;

  yield* streamAIRequest(prompt, false);
}

export async function* streamSummaryAgent(matchData: any, previousAnalysis: string) {
  const prompt = `
    You are a Senior Football Analyst. Based on the detailed analysis segments provided below, generate a final match summary and prediction.

    **PREVIOUS ANALYSIS:**
    ${previousAnalysis}

    **MATCH DATA:**
    ${JSON.stringify(matchData)}

    **OUTPUT FORMAT:**
    Output ONLY the summary tag with valid JSON content.
    <summary>
    {
      "prediction": "Final match prediction text (concise, decisive)",
      "winProbability": { "home": 40, "draw": 30, "away": 30 },
      "expectedGoals": { "home": 1.5, "away": 1.2 },
      "keyFactors": ["factor 1", "factor 2", "factor 3"]
    }
    </summary>
  `;

  yield* streamAIRequest(prompt, false);
}

export async function* streamAgentThoughts(matchData: any, includeAnimations: boolean = true) {
  // 1. Planning Phase (Hidden)
  let plan = [];
  try {
    plan = await generateAnalysisPlan(matchData);
  } catch (e) {
    plan = [{ title: "Analysis", focus: "General analysis", animationType: "none", agentType: "general" }];
  }

  // 2. Analysis Phase (Iterative)
  let fullAnalysisText = "";
  
  for (const segment of plan) {
    if (!includeAnimations) {
      segment.animationType = 'none';
    }

    // A. Run Analysis Agent
    let segmentText = "";
    const segmentStream = streamAnalysisAgent(matchData, segment);
    for await (const chunk of segmentStream) {
      segmentText += chunk;
      fullAnalysisText += chunk;
      yield chunk;
    }

    // B. Run Tag Generation Agent (After analysis is done for this segment)
    // We need to extract the pure text content from the segment output to feed the tag agent
    // Simple regex to strip tags for the prompt
    const cleanText = segmentText.replace(/<[^>]+>/g, ' ').trim();
    const tagStream = streamTagAgent(cleanText);
    for await (const chunk of tagStream) {
      yield chunk;
    }

    yield "\n";
    fullAnalysisText += "\n";
  }

  // 3. Summary Phase
  const summaryStream = streamSummaryAgent(matchData, fullAnalysisText);
  for await (const chunk of summaryStream) {
    yield chunk;
  }
}

export async function* streamRegenerateSegment(matchData: any, segmentIndex: number) {
  const homeName = matchData?.homeTeam?.name || "Home Team";
  const awayName = matchData?.awayTeam?.name || "Away Team";
  const prompt = `
    You are an expert football analyst director.
    Please regenerate ONLY Segment ${segmentIndex + 1} for the match between ${homeName} and ${awayName}.
    
    You MUST output your response as XML-like tags:
    <thought>
    Your detailed analysis and reasoning for this specific segment.
    </thought>
    <animation>
    {
      "type": "comparison" | "tactical" | "stats",
      "title": "Segment Title",
      "narration": "Voiceover script",
      "data": { "homeValue": "...", "awayValue": "..." }
    }
    </animation>

    Match Data: ${JSON.stringify(matchData)}
  `;

  yield* streamAIRequest(prompt, false);
}

export async function* streamRemotionCode(segmentData: any) {
  const prompt = `
    ${REMOTION_RULES}

    Create a Remotion component for the following scene data:
    ${JSON.stringify(segmentData, null, 2)}
    
    Remember: Return ONLY valid TSX code. No markdown formatting.
  `;

  yield* streamAIRequest(prompt, false);
}

export async function* streamFixRemotionCode(segmentData: any, wrongCode: string, errors: string[]) {
  const prompt = `
    ${REMOTION_RULES}

    The following Remotion component code has errors and violates the rules:
    ERRORS:
    ${errors.join('\n')}

    WRONG CODE:
    ${wrongCode}

    Please fix the code for the following scene data:
    ${JSON.stringify(segmentData, null, 2)}
    
    Remember: Return ONLY valid TSX code. No markdown formatting.
  `;

  yield* streamAIRequest(prompt, false);
}
