import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { getSettings } from "./settings";
import { availableSkills, executeSkill } from "../skills";
import { extractJson } from "../utils/json";
import {
  buildAnimationBlock,
  buildFallbackAnimationPayload,
  buildTemplatePromptSpec,
  getTemplateDeclaration,
  validateAndNormalizeAnimationPayload,
} from "./remotion/templateParams";

let aiInstance: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

export function getGeminiAI(): GoogleGenAI {
  const settings = getSettings();
  const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined");
  }

  if (!aiInstance || currentApiKey !== apiKey) {
    aiInstance = new GoogleGenAI({ apiKey });
    currentApiKey = apiKey;
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
      const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined");
      }
      const ai = new GoogleGenAI({ apiKey });
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

async function* streamAIRequest(prompt: string, includeReasoning: boolean = false, allowedSkills?: string[], stopAfterToolCall: boolean = false) {
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
    let useTools = settings.model !== 'deepseek-reasoner';

    if (!useTools && openAITools.length > 0) {
      const toolInstructions = `\n\n[SYSTEM WARNING: You are running in an environment that requires manual tool calling. You have access to the following tools:\n${JSON.stringify(openAITools, null, 2)}\n\nIf you need to use a tool, you MUST output exactly this format and stop generating:\n<tool_call>{"name": "tool_name", "arguments": {"arg1": "val"}}</tool_call>\n\nThe system will provide the result in the next message.]`;
      messages[0].content += toolInstructions;
    }

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
            yield `\n[系统提示] 当前模型 (${settings.model}) 原生不支持工具调用，切换为手动工具调用模式...\n`;
            useTools = false;
            const toolInstructions = `\n\n[SYSTEM WARNING: You are running in an environment that requires manual tool calling. You have access to the following tools:\n${JSON.stringify(openAITools, null, 2)}\n\nIf you need to use a tool, you MUST output exactly this format and stop generating:\n<tool_call>{"name": "tool_name", "arguments": {"arg1": "val"}}</tool_call>\n\nThe system will provide the result in the next message.]`;
            messages[0].content += toolInstructions;
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
              if (stopAfterToolCall) return;
              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(result)
              });
            } catch (err: any) {
              yield `\n[错误] 工具调用失败: ${err.message}\n`;
              if (stopAfterToolCall) return;
              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify({ error: err.message })
              });
            }
          }
          // Loop continues to send tool results back
        } else if (!useTools && currentContent.includes("<tool_call>")) {
          const match = currentContent.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
          if (match) {
            try {
              const cleanJson = match[1].replace(/```json/g, '').replace(/```/g, '').trim();
              const tc = JSON.parse(cleanJson);
              yield `\n[系统] 正在调用工具 (R1模式): ${tc.name}...\n`;
              const result = await executeSkill(tc.name, tc.arguments);
              yield `[系统] 工具调用结果: ${JSON.stringify(result)}\n`;
              if (stopAfterToolCall) return;
              
              messages.push({
                role: "assistant",
                content: currentContent
              });
              messages.push({
                role: "user",
                content: `<tool_result>${JSON.stringify(result)}</tool_result>\n\nPlease continue your analysis based on this result.`
              });
              continue; // Make another API call with the result
            } catch (err: any) {
              yield `\n[错误] 工具调用失败: ${err.message}\n`;
              if (stopAfterToolCall) return;
              messages.push({
                role: "assistant",
                content: currentContent
              });
              messages.push({
                role: "user",
                content: `<tool_result>{"error": "${err.message}"}</tool_result>\n\nPlease fix the error or continue without the tool.`
              });
              continue;
            }
          } else {
            break;
          }
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
              if (stopAfterToolCall) return;
              
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
              if (stopAfterToolCall) return;
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

export async function generateAnalysisPlan(matchData: any, includeAnimations: boolean = true): Promise<any[]> {
  const settings = getSettings();
  const agentId = settings.enableAutonomousPlanning ? 'planner_autonomous' : 'planner_template';
  const agent = getAgent(agentId);
  
  const prompt = agent.systemPrompt({ 
    matchData, 
    language: settings.language,
    includeAnimations
  });

  let responseText = "";
  
  try {
    // Only stop after tool call if we are using the template planner (which uses tools)
    const stopAfterToolCall = agentId === 'planner_template';
    const stream = streamAIRequest(prompt, false, agent.skills, stopAfterToolCall);
    
    for await (const chunk of stream) {
      responseText += chunk;
    }

    // Check if there's a tool result before cleaning up (only for template planner)
    if (stopAfterToolCall) {
      const toolResultMatch = responseText.match(/\[系统\] 工具调用结果: (.*)\n?/);
      if (toolResultMatch) {
        try {
          const parsedResult = JSON.parse(toolResultMatch[1].trim());
          if (Array.isArray(parsedResult)) {
            return parsedResult;
          }
        } catch (e) {
          console.error("Failed to parse tool result", e);
        }
      }
    }

    // Clean up system logs and markdown formatting
    const cleanText = responseText
      .replace(/\[系统\].*?\n/g, '')
      .replace(/\[系统提示\].*?\n/g, '')
      .replace(/\[错误\].*?\n/g, '')
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // Find the first occurrence of a JSON array
    const jsonMatch = cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Failed to parse plan JSON", e);
    return [
      { title: "Match Overview", focus: "General context", animationType: "none", agentType: "overview", contextMode: "independent" },
      { title: "Key Analysis", focus: "Main talking points", animationType: "none", agentType: "general", contextMode: "build_upon" }
    ];
  }
}

export async function* streamAnalysisAgent(matchData: any, segmentPlan: any, previousAnalysis: string = "") {
  const settings = getSettings();
  const agent = getAgent(segmentPlan.agentType || 'general');
  // No animation schema passed here anymore
  const prompt = agent.systemPrompt({ matchData, segmentPlan, language: settings.language, previousAnalysis });

  yield* streamAIRequest(prompt, false, agent.skills);
}

async function collectStreamText(stream: AsyncGenerator<string>): Promise<string> {
  let output = '';
  for await (const chunk of stream) {
    output += chunk;
  }
  return output;
}

function extractAnimationPayload(outputText: string): any {
  const blockMatch = outputText.match(/<animation>([\s\S]*?)(?:<\/animation>|$)/);
  const raw = (blockMatch?.[1] ?? outputText).trim();
  return extractJson(raw);
}

export async function* streamAnimationAgent(matchData: any, segmentPlan: any, analysisText: string) {
  const homeName = matchData?.homeTeam?.name || "Home Team";
  const awayName = matchData?.awayTeam?.name || "Away Team";
  const declaration = getTemplateDeclaration(segmentPlan.animationType || 'stats');
  const fallback = buildFallbackAnimationPayload(
    segmentPlan.animationType || 'stats',
    segmentPlan.title || 'Data Visualization',
    homeName,
    awayName,
  );

  const animationSchema = `
  ${buildTemplatePromptSpec(segmentPlan.animationType || 'stats', segmentPlan.title || '', homeName, awayName)}

  OUTPUT CONTRACT (STRICT):
  <animation>
  {
    "type": "${segmentPlan.animationType || 'stats'}",
    "templateId": "${declaration.templateId}",
    "title": "${segmentPlan.title || 'Data Visualization'}",
    "narration": "A short voiceover script in the same language as the analysis.",
    "params": ${JSON.stringify(fallback.params, null, 2)},
    "data": ${JSON.stringify(fallback.params, null, 2)}
  }
  </animation>

  IMPORTANT:
  - "params" MUST contain only template parameters.
  - "data" MUST be exactly the same object as "params" (for backward compatibility).
  - Do NOT output any explanation outside the <animation> block.
  `;

  const settings = getSettings();
  const agent = getAgent('animation');
  const prompt = agent.systemPrompt({
    matchData,
    segmentPlan,
    analysisText,
    animationSchema,
    language: settings.language
  });

  yield* streamAIRequest(prompt, false, agent.skills);
}

export async function* streamFixAnimationParams(
  matchData: any,
  segmentPlan: any,
  analysisText: string,
  wrongOutput: string,
  errors: string[],
) {
  const homeName = matchData?.homeTeam?.name || "Home Team";
  const awayName = matchData?.awayTeam?.name || "Away Team";
  const declaration = getTemplateDeclaration(segmentPlan.animationType || 'stats');

  const prompt = `
  You are fixing animation template parameters.
  You are NOT writing Remotion component code.
  You must return exactly one <animation> JSON block with valid params.

  TEMPLATE CONTRACT:
  ${buildTemplatePromptSpec(segmentPlan.animationType || 'stats', segmentPlan.title || '', homeName, awayName)}

  EXPECTED TEMPLATE ID: ${declaration.templateId}

  CONTEXT:
  MATCH DATA:
  ${JSON.stringify(matchData)}

  EXPERT ANALYSIS:
  ${analysisText}

  INVALID OUTPUT:
  ${wrongOutput}

  VALIDATION ERRORS:
  ${errors.join('\n')}

  STRICT OUTPUT:
  <animation>
  {
    "type": "${segmentPlan.animationType || 'stats'}",
    "templateId": "${declaration.templateId}",
    "title": "${segmentPlan.title || 'Data Visualization'}",
    "narration": "Short voiceover",
    "params": { ... },
    "data": { ...same as params... }
  }
  </animation>
  `;

  yield* streamAIRequest(prompt, false);
}

async function generateValidatedAnimationBlock(
  matchData: any,
  segmentPlan: any,
  analysisText: string,
): Promise<string> {
  const homeName = matchData?.homeTeam?.name || "Home Team";
  const awayName = matchData?.awayTeam?.name || "Away Team";
  const expectedType = segmentPlan.animationType || 'stats';
  const maxFixAttempts = 2;

  let candidateText = await collectStreamText(streamAnimationAgent(matchData, segmentPlan, analysisText));

  for (let attempt = 0; attempt <= maxFixAttempts; attempt++) {
    const rawPayload = extractAnimationPayload(candidateText);
    const validation = validateAndNormalizeAnimationPayload(rawPayload, expectedType);

    if (!validation.payload.title) {
      validation.payload.title = segmentPlan.title || 'Data Visualization';
    }
    if (!validation.payload.narration && typeof rawPayload?.narration === 'string') {
      validation.payload.narration = rawPayload.narration;
    }

    if (validation.isValid) {
      return buildAnimationBlock(validation.payload);
    }

    if (attempt < maxFixAttempts) {
      candidateText = await collectStreamText(
        streamFixAnimationParams(
          matchData,
          segmentPlan,
          analysisText,
          candidateText,
          validation.errors,
        ),
      );
    }
  }

  const fallback = buildFallbackAnimationPayload(
    expectedType,
    segmentPlan.title || 'Data Visualization',
    homeName,
    awayName,
  );
  fallback.narration = typeof segmentPlan?.focus === 'string' ? segmentPlan.focus : '';
  return buildAnimationBlock(fallback);
}

export async function* streamTagAgent(analysisText: string) {
  const settings = getSettings();
  const agent = getAgent('tag');
  const prompt = agent.systemPrompt({ analysisText, language: settings.language });

  yield* streamAIRequest(prompt, false, agent.skills);
}

export async function* streamSummaryAgent(matchData: any, previousAnalysis: string) {
  const settings = getSettings();
  const agent = getAgent('summary');
  const prompt = agent.systemPrompt({ matchData, previousAnalysis, language: settings.language });

  yield* streamAIRequest(prompt, false, agent.skills);
}

export interface SegmentResult {
  agentId: string;
  title: string;
  content: string;
}

export interface AnalysisResumeState {
  plan: any[];
  completedSegmentIndices: number[];
  fullAnalysisText: string;
  segmentResults?: SegmentResult[];
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
  let segmentResults: SegmentResult[] = resumeState?.segmentResults || [];

  if (!resumeState) {
    try {
      plan = await generateAnalysisPlan(matchData, includeAnimations);
    } catch (e) {
      plan = [{ title: "Analysis", focus: "General analysis", animationType: "none", agentType: "general" }];
    }
    onStateUpdate?.({ plan, completedSegmentIndices, fullAnalysisText, segmentResults });
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

    const agentId = segment.agentType || 'general';
    const agent = getAgent(agentId);
    
    let filteredContext = "";
    const deps = agent.contextDependencies || 'all';
    if (deps === 'none') {
      filteredContext = "";
    } else if (deps === 'all') {
      filteredContext = segmentResults.map(r => `[From ${r.agentId} - ${r.title}]:\n${r.content}`).join('\n\n');
    } else if (Array.isArray(deps)) {
      const relevantResults = segmentResults.filter(r => deps.includes(r.agentId));
      if (relevantResults.length > 0) {
        filteredContext = relevantResults.map(r => `[From ${r.agentId} - ${r.title}]:\n${r.content}`).join('\n\n');
      }
    }

    // A. Run Analysis Agent
    let segmentText = "";
    const segmentStream = streamAnalysisAgent(matchData, segment, filteredContext);
    for await (const chunk of segmentStream) {
      segmentText += chunk;
      fullAnalysisText += chunk;
      yield chunk;
    }

    // A.1 Run Animation Agent (if needed)
    if (includeAnimations && segment.animationType && segment.animationType !== 'none') {
      // Parameter-first flow:
      // 1) LLM extracts template params JSON
      // 2) System validates and retries if invalid
      // 3) System emits normalized <animation> block
      const animationOutput = await generateValidatedAnimationBlock(matchData, segment, segmentText);
      yield animationOutput;

      // Append animation output to the text tracking variables
      segmentText += "\n" + animationOutput;
      fullAnalysisText += "\n" + animationOutput;
    }

    // B. Run Tag Generation Agent (After analysis is done for this segment)
    // We need to extract the pure text content from the segment output to feed the tag agent
    // Simple regex to strip tags for the prompt
    const cleanText = segmentText.replace(/<[^>]+>/g, ' ').trim();
    const tagStream = streamTagAgent(cleanText);
    for await (const chunk of tagStream) {
      segmentText += chunk;
      yield chunk;
    }

    yield "\n";
    segmentText += "\n";
    fullAnalysisText += "\n";
    
    segmentResults.push({ agentId, title: segment.title, content: segmentText });
    completedSegmentIndices.push(i);
    onStateUpdate?.({ plan, completedSegmentIndices, fullAnalysisText, segmentResults });
  }

  // 3. Summary Phase
  const summaryStream = streamSummaryAgent(matchData, fullAnalysisText);
  for await (const chunk of summaryStream) {
    yield chunk;
  }
}
