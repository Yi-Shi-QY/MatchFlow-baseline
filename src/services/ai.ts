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
import { getAgent } from "../agents";
import { resolveRuntimeModelRoute } from "./ai/runtimeModel";
import { buildFallbackPlan, normalizePlan, resolvePlanningRoute } from "./ai/planning";

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
    } else if (settings.provider === "openai_compatible") {
      const baseUrl = (settings.openaiCompatibleBaseUrl || "").trim();
      if (!baseUrl) {
        throw new Error("OpenAI-compatible base URL is not configured.");
      }

      const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (settings.openaiCompatibleApiKey) {
        headers.Authorization = `Bearer ${settings.openaiCompatibleApiKey}`;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: settings.model || "gpt-4o-mini",
          messages: [{ role: "user", content: "Hello" }],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          err.error?.message || `HTTP error! status: ${response.status}`,
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
        "Network request failed. Please check connectivity, endpoint URL, API key, or CORS settings."
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

async function* streamAIRequest(
  prompt: string,
  includeReasoning: boolean = false,
  allowedSkills?: string[],
  stopAfterToolCall: boolean = false,
  agentId?: string,
) {
  const settings = getSettings();
  const runtimeModel = resolveRuntimeModelRoute(settings, agentId);
  const provider = runtimeModel.provider;
  const model = runtimeModel.model;
  const activeSkills = allowedSkills 
    ? availableSkills.filter(s => allowedSkills.includes(s.name))
    : [];

  if (provider === "deepseek" || provider === "openai_compatible") {
    if (provider === "deepseek" && !settings.deepseekApiKey) {
      yield "[ERROR] DeepSeek API Key is not configured in settings.";
      return;
    }
    if (provider === "openai_compatible" && !settings.openaiCompatibleBaseUrl) {
      yield "[ERROR] OpenAI-compatible base URL is not configured in settings.";
      return;
    }

    let messages: any[] = [{ role: "user", content: prompt }];
    const openAITools = convertToOpenAITools(activeSkills);
    const lowerModel = model.toLowerCase();
    const likelyReasoningOnly =
      lowerModel.includes("reasoner") ||
      /(^|[^a-z0-9])r1([^a-z0-9]|$)/.test(lowerModel);
    let useTools = !likelyReasoningOnly;
    const endpoint = provider === "deepseek"
      ? "https://api.deepseek.com/chat/completions"
      : `${String(settings.openaiCompatibleBaseUrl).replace(/\/+$/, "")}/chat/completions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (provider === "deepseek" && settings.deepseekApiKey) {
      headers.Authorization = `Bearer ${settings.deepseekApiKey}`;
    }
    if (provider === "openai_compatible" && settings.openaiCompatibleApiKey) {
      headers.Authorization = `Bearer ${settings.openaiCompatibleApiKey}`;
    }

    if (!useTools && openAITools.length > 0) {
      const toolInstructions = `\n\n[SYSTEM WARNING: You are running in an environment that requires manual tool calling. You have access to the following tools:\n${JSON.stringify(openAITools, null, 2)}\n\nIf you need to use a tool, you MUST output exactly this format and stop generating:\n<tool_call>{"name": "tool_name", "arguments": {"arg1": "val"}}</tool_call>\n\nThe system will provide the result in the next message.]`;
      messages[0].content += toolInstructions;
    }

    while (true) {
      try {
        const requestBody: any = {
          model,
          messages: messages,
          stream: true,
        };

        if (useTools && openAITools.length > 0) {
          requestBody.tools = openAITools;
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const errMessage = String(err.error?.message || "").toLowerCase();
          if (
            response.status === 400 &&
            (errMessage.includes("tool") || errMessage.includes("function"))
          ) {
            yield `\n[SYSTEM_NOTICE] Current model (${model}) does not support native tool calls, switching to manual tool-call mode.\n`;
            useTools = false;
            const toolInstructions = `\n\n[SYSTEM WARNING: You are running in an environment that requires manual tool calling. You have access to the following tools:\n${JSON.stringify(openAITools, null, 2)}\n\nIf you need to use a tool, you MUST output exactly this format and stop generating:\n<tool_call>{"name": "tool_name", "arguments": {"arg1": "val"}}</tool_call>\n\nThe system will provide the result in the next message.]`;
            messages[0].content += toolInstructions;
            continue;
          }
          throw new Error(err.error?.message || `HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) {
          const single = await response.json().catch(() => ({}));
          const messageContent = single?.choices?.[0]?.message?.content;
          let singleText = "";
          if (typeof messageContent === "string") {
            singleText = messageContent;
          } else if (Array.isArray(messageContent)) {
            singleText = messageContent
              .map((item: any) =>
                typeof item === "string"
                  ? item
                  : item?.text || item?.content || "",
              )
              .join("");
          } else {
            singleText = single?.choices?.[0]?.delta?.content || "";
          }
          if (singleText) {
            yield String(singleText);
          }
          break;
        }

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
                const reasoningChunk =
                  delta?.reasoning_content ||
                  (typeof delta?.reasoning === "string" ? delta.reasoning : "");

                if (reasoningChunk && includeReasoning) {
                  currentReasoning += reasoningChunk;
                  yield reasoningChunk;
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
            yield `\n[SYSTEM] Calling tool: ${tc.function.name}...\n`;
            try {
              const args = JSON.parse(tc.function.arguments);
              const result = await executeSkill(tc.function.name, args);
              yield `[SYSTEM] Tool result: ${JSON.stringify(result)}\n`;
              if (stopAfterToolCall) return;
              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(result)
              });
            } catch (err: any) {
              yield `\n[ERROR] Tool call failed: ${err.message}\n`;
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
              yield `\n[SYSTEM] Calling tool (manual mode): ${tc.name}...\n`;
              const result = await executeSkill(tc.name, tc.arguments);
              yield `[SYSTEM] Tool result: ${JSON.stringify(result)}\n`;
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
              yield `\n[ERROR] Tool call failed: ${err.message}\n`;
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
        const label = provider === "deepseek" ? "DeepSeek" : "OpenAI-compatible";
        yield `\n[ERROR] ${label} API error: ${
          e.message === "Failed to fetch" ? "Network or CORS error" : e.message
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
        model,
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
              yield `\n[SYSTEM] Calling tool: ${call.name}...\n`;
              const result = await executeSkill(call.name, call.args);
              yield `[SYSTEM] Tool result: ${JSON.stringify(result)}\n`;
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
              yield `\n[ERROR] Tool call failed: ${err.message}\n`;
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
      yield `\n[ERROR] Gemini API error: ${e.message}`;
    }
  }
}

export async function generateAnalysisPlan(matchData: any, includeAnimations: boolean = true): Promise<any[]> {
  const settings = getSettings();
  const route = resolvePlanningRoute(matchData, settings);
  const language = settings.language === "zh" ? "zh" : "en";

  try {
    // Deterministic path: route source/capabilities directly to a fixed template.
    if (route.mode === "template" && route.templateType) {
      const directResult = await executeSkill("select_plan_template", {
        templateType: route.templateType,
        language,
        includeAnimations,
      });
      if (Array.isArray(directResult)) {
        return normalizePlan(directResult, includeAnimations, route.allowedAgentTypes, language);
      }
    }

    // Fallback path: ask planner agent to generate plan.
    const agentId = route.mode === "autonomous" ? "planner_autonomous" : "planner_template";
    const agent = getAgent(agentId);

    const prompt = agent.systemPrompt({
      matchData,
      language,
      includeAnimations,
    });

    let responseText = "";
    const stopAfterToolCall = agentId === "planner_template";
    const stream = streamAIRequest(
      prompt,
      false,
      agent.skills,
      stopAfterToolCall,
      agent.id,
    );

    for await (const chunk of stream) {
      responseText += chunk;
    }

    if (stopAfterToolCall) {
      const toolResultMatch = responseText.match(/\[SYSTEM\] Tool result: (.*)\n?/);
      if (toolResultMatch) {
        try {
          const parsedResult = JSON.parse(toolResultMatch[1].trim());
          if (Array.isArray(parsedResult)) {
            return normalizePlan(parsedResult, includeAnimations, route.allowedAgentTypes, language);
          }
        } catch (e) {
          console.error("Failed to parse tool result", e);
        }
      }
    }

    const cleanText = responseText
      .replace(/\[SYSTEM\].*?\n/g, "")
      .replace(/\[SYSTEM_NOTICE\].*?\n/g, "")
      .replace(/\[ERROR\].*?\n/g, "")
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    const jsonMatch = cleanText.match(/\[\s*\{[\s\S]*\}\s*\]/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(cleanText);
    return normalizePlan(parsed, includeAnimations, route.allowedAgentTypes, language);
  } catch (e) {
    console.error("Failed to parse plan JSON", e, "route:", route.reason);
    return normalizePlan(buildFallbackPlan(language), includeAnimations, route.allowedAgentTypes, language);
  }
}

export async function* streamAnalysisAgent(matchData: any, segmentPlan: any, previousAnalysis: string = "") {
  const settings = getSettings();
  const agent = getAgent(segmentPlan.agentType || 'general');
  // No animation schema passed here anymore
  const prompt = agent.systemPrompt({ matchData, segmentPlan, language: settings.language, previousAnalysis });

  yield* streamAIRequest(prompt, false, agent.skills, false, agent.id);
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

  yield* streamAIRequest(prompt, false, agent.skills, false, agent.id);
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

  yield* streamAIRequest(prompt, false, undefined, false, "animation");
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

  yield* streamAIRequest(prompt, false, agent.skills, false, agent.id);
}

export async function* streamSummaryAgent(matchData: any, previousAnalysis: string) {
  const settings = getSettings();
  const agent = getAgent('summary');
  const prompt = agent.systemPrompt({ matchData, previousAnalysis, language: settings.language });

  yield* streamAIRequest(prompt, false, agent.skills, false, agent.id);
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



