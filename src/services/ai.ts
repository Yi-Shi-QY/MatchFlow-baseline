import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { getSettings } from "./settings";
import { REMOTION_RULES } from "./remotionRules";
import { availableSkills, executeSkill } from "../skills";

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

function convertToOpenAITools(declarations: any[]) {
  return declarations.map(decl => {
    const parameters = JSON.parse(JSON.stringify(decl.parameters));
    const lowercaseTypes = (obj: any) => {
      if (obj && obj.type && typeof obj.type === 'string') {
        obj.type = obj.type.toLowerCase();
      }
      if (obj && obj.properties) {
        for (const key in obj.properties) {
          lowercaseTypes(obj.properties[key]);
        }
      }
      if (obj && obj.items) {
        lowercaseTypes(obj.items);
      }
    };
    lowercaseTypes(parameters);

    return {
      type: "function",
      function: {
        name: decl.name,
        description: decl.description,
        parameters: parameters
      }
    };
  });
}

async function* streamAIRequest(prompt: string, includeReasoning: boolean = false, allowedSkills?: string[]) {
  const settings = getSettings();
  const activeSkills = allowedSkills 
    ? availableSkills.filter(s => allowedSkills.includes(s.name))
    : [];

  if (settings.provider === "deepseek") {
    if (!settings.deepseekApiKey) {
      yield "[错误] 未配置 DeepSeek API Key。请在设置中配置。";
      return;
    }

    let messages: any[] = [{ role: "user", content: prompt }];
    const openAITools = convertToOpenAITools(activeSkills);
    let useTools = true;

    while (true) {
      try {
        const requestBody: any = {
          model: settings.model || "deepseek-chat",
          messages: messages,
          stream: true,
        };

        if (useTools && openAITools.length > 0) {
          requestBody.tools = openAITools;
        }

        const response = await fetch(
          "https://api.deepseek.com/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${settings.deepseekApiKey}`,
            },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          if (response.status === 400 && err.error?.message?.toLowerCase().includes("tool")) {
            yield `\n[系统提示] 当前模型 (${settings.model}) 原生不支持工具调用，将降级为普通对话。\n`;
            useTools = false;
            continue;
          }
          throw new Error(err.error?.message || `HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error("No reader available");

        let currentContent = "";
        let currentReasoning = "";
        let toolCalls: any[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n").filter((line) => line.trim() !== "");

          for (const line of lines) {
            if (line === "data: [DONE]") continue;
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                const delta = data.choices[0]?.delta;

                if (delta?.reasoning_content && includeReasoning) {
                  currentReasoning += delta.reasoning_content;
                  yield delta.reasoning_content;
                } else if (delta?.content) {
                  currentContent += delta.content;
                  yield delta.content;
                }

                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    if (!toolCalls[tc.index]) {
                      toolCalls[tc.index] = {
                        id: tc.id,
                        type: "function",
                        function: { name: tc.function?.name || "", arguments: "" }
                      };
                    }
                    if (tc.function?.arguments) {
                      toolCalls[tc.index].function.arguments += tc.function.arguments;
                    }
                  }
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }

        const validToolCalls = toolCalls.filter(Boolean);
        if (validToolCalls.length > 0) {
          messages.push({
            role: "assistant",
            content: currentContent || null,
            tool_calls: validToolCalls
          });

          for (const tc of validToolCalls) {
            yield `\n[系统] 正在调用工具: ${tc.function.name}...\n`;
            try {
              const args = JSON.parse(tc.function.arguments);
              const result = await executeSkill(tc.function.name, args);
              yield `[系统] 工具调用结果: ${JSON.stringify(result)}\n`;
              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(result)
              });
            } catch (err: any) {
              yield `\n[错误] 工具调用失败: ${err.message}\n`;
              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify({ error: err.message })
              });
            }
          }
          // Loop continues to send tool results back
        } else {
          break; // No tool calls, we are done
        }
      } catch (e: any) {
        yield `\n[错误] DeepSeek API 错误: ${
          e.message === "Failed to fetch" ? "网络或跨域(CORS)错误" : e.message
        }`;
        break;
      }
    }
  } else {
    // Gemini
    const ai = getGeminiAI();
    try {
      const config: any = {};
      if (activeSkills.length > 0) {
        config.tools = [{ functionDeclarations: activeSkills }];
      }

      const chat = ai.chats.create({
        model: settings.model || "gemini-3-flash-preview",
        config,
      });

      let response = await chat.sendMessageStream({ message: prompt });

      for await (const chunk of response) {
        const c = chunk as GenerateContentResponse;
        if (c.text) {
          yield c.text;
        }

        if (c.functionCalls && c.functionCalls.length > 0) {
          for (const call of c.functionCalls) {
            try {
              yield `\n[系统] 正在调用工具: ${call.name}...\n`;
              const result = await executeSkill(call.name, call.args);
              yield `[系统] 工具调用结果: ${JSON.stringify(result)}\n`;
              
              // Send the result back to the model
              const followUpResponse = await chat.sendMessageStream({
                message: [{
                  functionResponse: {
                    name: call.name,
                    response: { result },
                  }
                }] as any
              });

              for await (const followUpChunk of followUpResponse) {
                const fc = followUpChunk as GenerateContentResponse;
                if (fc.text) {
                  yield fc.text;
                }
              }
            } catch (err: any) {
              yield `\n[错误] 工具调用失败: ${err.message}\n`;
              // Send error back to model
              const errorResponse = await chat.sendMessageStream({
                message: [{
                  functionResponse: {
                    name: call.name,
                    response: { error: err.message },
                  }
                }] as any
              });
              for await (const errChunk of errorResponse) {
                const ec = errChunk as GenerateContentResponse;
                if (ec.text) {
                  yield ec.text;
                }
              }
            }
          }
        }
      }
    } catch (e: any) {
      yield `\n[错误] Gemini API 错误: ${e.message}`;
    }
  }
}

import { getAgent } from "../agents";

export async function generateAnalysisPlan(matchData: any): Promise<any[]> {
  const agent = getAgent('planner');
  const prompt = agent.systemPrompt({ matchData });

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
        "homeValue": 10, "awayValue": 5,
        "metric": "REPLACE_WITH_REAL_METRIC"
      }
    }
    </animation>`;

  const agent = getAgent(segmentPlan.agentType || 'general');
  const prompt = agent.systemPrompt({ matchData, segmentPlan, animationSchema });

  yield* streamAIRequest(prompt, false, agent.skills);
}

export async function* streamTagAgent(analysisText: string) {
  const agent = getAgent('tag');
  const prompt = agent.systemPrompt({ analysisText });

  yield* streamAIRequest(prompt, false, agent.skills);
}

export async function* streamSummaryAgent(matchData: any, previousAnalysis: string) {
  const agent = getAgent('summary');
  const prompt = agent.systemPrompt({ matchData, previousAnalysis });

  yield* streamAIRequest(prompt, false, agent.skills);
}

export interface AnalysisResumeState {
  plan: any[];
  completedSegmentIndices: number[];
  fullAnalysisText: string;
}

export async function* streamAgentThoughts(
  matchData: any, 
  includeAnimations: boolean = true,
  resumeState?: AnalysisResumeState,
  onStateUpdate?: (state: AnalysisResumeState) => void
) {
  // 1. Planning Phase (Hidden)
  let plan = resumeState?.plan || [];
  let completedSegmentIndices = resumeState?.completedSegmentIndices || [];
  let fullAnalysisText = resumeState?.fullAnalysisText || "";

  if (!resumeState) {
    try {
      plan = await generateAnalysisPlan(matchData);
    } catch (e) {
      plan = [{ title: "Analysis", focus: "General analysis", animationType: "none", agentType: "general" }];
    }
    onStateUpdate?.({ plan, completedSegmentIndices, fullAnalysisText });
  }

  // 2. Analysis Phase (Iterative)
  for (let i = 0; i < plan.length; i++) {
    if (completedSegmentIndices.includes(i)) {
      continue;
    }

    const segment = plan[i];
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
    
    completedSegmentIndices.push(i);
    onStateUpdate?.({ plan, completedSegmentIndices, fullAnalysisText });
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

export async function* streamRemotionCode(segmentData: any, customInstruction?: string) {
  const prompt = `
    ${REMOTION_RULES}

    Create a Remotion component for the following scene data:
    ${JSON.stringify(segmentData, null, 2)}
    
    ${customInstruction ? `\nUSER CUSTOM INSTRUCTION FOR THIS ANIMATION:\n${customInstruction}\nPlease follow this instruction carefully when generating the animation code.\n` : ''}

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
