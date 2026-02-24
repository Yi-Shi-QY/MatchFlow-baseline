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

export async function* streamPlanningAgent(matchData: any, includeAnimations: boolean = true) {
  const homeName = matchData?.homeTeam?.name || "Home Team";
  const awayName = matchData?.awayTeam?.name || "Away Team";
  
  const animationSchema = `
    <animation>
    {
      "type": "comparison" | "tactical" | "stats" | "formation",
      "title": "Segment Title (e.g., 控球率对比)",
      "narration": "A short, engaging voiceover script for this animation.",
      "data": {
        // For 'comparison' or 'stats':
        "homeLabel": "${homeName}", "awayLabel": "${awayName}",
        "homeValue": 55, "awayValue": 45,
        "metric": "Possession %",
        
        // For 'tactical' or 'formation':
        "formation": "4-3-3",
        "keyPlayer": { "name": "Player Name", "x": 50, "y": 70 }, // x,y in percentage (0-100)
        "movement": "attack" | "defense"
      }
    }
    </animation>`;

  const animationRules = includeAnimations ? `
    **ANIMATION DECISION RULES:**
    - For EACH segment, you must DECIDE if a visual animation is necessary.
    - **INCLUDE** an <animation> block if the segment involves:
      - Comparing stats (Possession, Shots, xG) -> Use "comparison" or "stats".
      - Team Form (W/D/L) -> Use "stats".
      - Tactical formations or player positions -> Use "formation" or "tactical".
    - **OMIT** the <animation> block if the segment is purely narrative, abstract, or if the data is insufficient for a visualization.
    - If including an animation, use this format:
    ${animationSchema}
  ` : `
    **ANIMATION RULES:**
    - Do NOT generate any <animation> tags. Text analysis only.
  `;

  const prompt = `
    You are a Senior Football Analyst Director. Your job is to PLAN the analysis structure for the match between ${homeName} and ${awayName}.
    
    **CRITICAL PLANNING RULES:**
    1. **Analyze Data Richness:** Look at the provided Match Data.
       - If only basic info (names, league) is available -> Plan 3 segments (Overview, Form, Prediction).
       - If stats (possession, shots) are available -> Add "Tactical Analysis" segments.
       - If custom info (injuries, weather) is available -> Add specific segments for those factors.
    2. **Avoid Redundancy:** Do NOT create multiple segments for the same data point. Group related stats together.
    3. **Logical Flow:** Overview -> Form -> Tactics/Stats -> Key Factors -> Conclusion.
    4. **Segment Count:** Typically 3 to 6 segments. Do not force a specific number.

    ${animationRules}

    **OUTPUT FORMAT:**
    1. First, output a <plan> block with your structural reasoning. This is for your internal use.
    2. Then, output the ACTUAL analysis segments.
    
    **CRITICAL:**
    - Inside <thought>, write the **FINAL NARRATION SCRIPT** for the video, not a description of what the segment will be.
    - Do NOT say "In this segment I will analyze...".
    - DO say "Arsenal's form has been impeccable..." (Direct analysis).

    **ONE-SHOT EXAMPLE (Follow this structure exactly):**
    
    <plan>
    Data shows Arsenal (Home) vs Man City (Away). Stats available. Form available.
    Plan:
    1. Overview: Title race context.
    2. Form: Arsenal 4 wins vs City 2 wins. (Needs Animation)
    3. Tactics: Possession stats. (Needs Animation)
    4. Prediction.
    </plan>

    <title>Match Overview</title>
    <thought>
    Welcome to the Emirates Stadium for this crucial Premier League clash. Arsenal hosts Manchester City in a match that could decide the title race. The atmosphere is electric as the two giants of English football prepare to face off.
    </thought>

    <title>Recent Form</title>
    <thought>
    Looking at recent form, the momentum is clearly with the Gunners. They have won 4 of their last 5 matches, showing incredible consistency. City, uncharacteristically, have struggled, managing only 2 wins in the same period.
    </thought>
    <animation>
    {
      "type": "stats",
      "title": "近期状态对比",
      "narration": "阿森纳近期状态火热，过去五场比赛赢下了四场。相比之下，曼城则显得有些挣扎，仅取得了两个胜场。",
      "data": {
        "homeLabel": "Arsenal", "awayLabel": "Man City",
        "homeValue": 4, "awayValue": 2,
        "metric": "近5场胜场"
      }
    }
    </animation>

    <title>Tactical Analysis</title>
    <thought>
    Tactically, this will be a battle for control...
    </thought>

    Match Data: ${JSON.stringify(matchData)}
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
  // 1. Run Planning Agent
  let fullAnalysisText = "";
  const planStream = streamPlanningAgent(matchData, includeAnimations);
  
  for await (const chunk of planStream) {
    fullAnalysisText += chunk;
    yield chunk;
  }

  // 2. Run Summary Agent
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
