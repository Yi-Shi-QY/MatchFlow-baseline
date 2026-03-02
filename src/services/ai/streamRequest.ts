import { GenerateContentResponse } from "@google/genai";
import { executeSkill, getAvailableSkills } from "../../skills";
import { getSettings } from "../settings";
import { getGeminiAI } from "./geminiClient";
import { resolveRuntimeModelRoute } from "./runtimeModel";

function convertToOpenAITools(declarations: any[]) {
  return declarations.map((decl) => {
    const parameters = JSON.parse(JSON.stringify(decl.parameters));
    const lowercaseTypes = (obj: any) => {
      if (obj && obj.type && typeof obj.type === "string") {
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
        parameters: parameters,
      },
    };
  });
}

export async function* streamAIRequest(
  prompt: string,
  includeReasoning: boolean = false,
  allowedSkills?: string[],
  stopAfterToolCall: boolean = false,
  agentId?: string,
  abortSignal?: AbortSignal,
) {
  const settings = getSettings();
  const runtimeModel = resolveRuntimeModelRoute(settings, agentId);
  const provider = runtimeModel.provider;
  const model = runtimeModel.model;
  const availableSkills = getAvailableSkills();
  const activeSkills = allowedSkills
    ? availableSkills.filter((s) => allowedSkills.includes(s.name))
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
    const endpoint =
      provider === "deepseek"
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
      if (abortSignal?.aborted) {
        return;
      }
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
          signal: abortSignal,
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
          if (abortSignal?.aborted) return;
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
                        function: { name: tc.function?.name || "", arguments: "" },
                      };
                    }
                    if (tc.function?.arguments) {
                      toolCalls[tc.index].function.arguments += tc.function.arguments;
                    }
                  }
                }
              } catch (_e) {
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
            tool_calls: validToolCalls,
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
                content: JSON.stringify(result),
              });
            } catch (err: any) {
              yield `\n[ERROR] Tool call failed: ${err.message}\n`;
              if (stopAfterToolCall) return;
              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify({ error: err.message }),
              });
            }
          }
          // Loop continues to send tool results back
        } else if (!useTools && currentContent.includes("<tool_call>")) {
          const match = currentContent.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
          if (match) {
            try {
              const cleanJson = match[1].replace(/```json/g, "").replace(/```/g, "").trim();
              const tc = JSON.parse(cleanJson);
              yield `\n[SYSTEM] Calling tool (manual mode): ${tc.name}...\n`;
              const result = await executeSkill(tc.name, tc.arguments);
              yield `[SYSTEM] Tool result: ${JSON.stringify(result)}\n`;
              if (stopAfterToolCall) return;

              messages.push({
                role: "assistant",
                content: currentContent,
              });
              messages.push({
                role: "user",
                content: `<tool_result>${JSON.stringify(result)}</tool_result>\n\nPlease continue your analysis based on this result.`,
              });
              continue; // Make another API call with the result
            } catch (err: any) {
              yield `\n[ERROR] Tool call failed: ${err.message}\n`;
              if (stopAfterToolCall) return;
              messages.push({
                role: "assistant",
                content: currentContent,
              });
              messages.push({
                role: "user",
                content: `<tool_result>{"error": "${err.message}"}</tool_result>\n\nPlease fix the error or continue without the tool.`,
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
        if (abortSignal?.aborted || e?.name === "AbortError") {
          return;
        }
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
      if (abortSignal?.aborted) {
        return;
      }
      const config: any = {};
      if (activeSkills.length > 0) {
        config.tools = [{ functionDeclarations: activeSkills }];
      }

      const chat = ai.chats.create({
        model,
        config,
      });

      const response = await chat.sendMessageStream({ message: prompt });

      for await (const chunk of response) {
        if (abortSignal?.aborted) {
          return;
        }
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
                message: [
                  {
                    functionResponse: {
                      name: call.name,
                      response: { result },
                    },
                  },
                ] as any,
              });

              for await (const followUpChunk of followUpResponse) {
                if (abortSignal?.aborted) {
                  return;
                }
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
                message: [
                  {
                    functionResponse: {
                      name: call.name,
                      response: { error: err.message },
                    },
                  },
                ] as any,
              });
              for await (const errChunk of errorResponse) {
                if (abortSignal?.aborted) {
                  return;
                }
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
