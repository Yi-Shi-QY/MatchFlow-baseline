import { GenerateContentResponse } from "@google/genai";
import { executeSkill, getAvailableSkills } from "../../skills";
import { getSettings, type AIProvider } from "../settings";
import { getGeminiAI } from "./geminiClient";
import { resolveRuntimeModelRoute } from "./runtimeModel";

function normalizeOpenAICompatibleBaseUrl(rawBaseUrl: string): string {
  const trimmed = String(rawBaseUrl || "").trim();
  if (!trimmed) return "";
  const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

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

type TokenUsageSource = "provider" | "estimated";

export type StreamRequestTelemetryEvent =
  | {
      type: "request_start";
      timestamp: number;
      provider: AIProvider;
      model: string;
      inputTokensEstimate: number;
    }
  | {
      type: "request_end";
      timestamp: number;
      provider: AIProvider;
      model: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      tokenSource: TokenUsageSource;
    }
  | {
      type: "tool_call";
      timestamp: number;
      provider: AIProvider;
      model: string;
      toolName: string;
      success: boolean;
    };

export type StreamRequestTelemetryHandler = (
  event: StreamRequestTelemetryEvent,
) => void;

function safeTrimString(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim();
}

function estimateTokensFromText(input: string): number {
  const normalized = safeTrimString(input);
  if (!normalized) return 0;
  // Lightweight approximation for display-level usage when provider usage is unavailable.
  return Math.max(1, Math.ceil(normalized.length / 4));
}

function estimateTokensFromMessage(message: any): number {
  if (!message || typeof message !== "object") return 0;

  let aggregateText = "";
  if (typeof message.role === "string") {
    aggregateText += message.role;
  }

  const content = message.content;
  if (typeof content === "string") {
    aggregateText += `\n${content}`;
  } else if (Array.isArray(content)) {
    for (const part of content) {
      if (typeof part === "string") {
        aggregateText += `\n${part}`;
        continue;
      }
      if (part && typeof part === "object") {
        if (typeof part.text === "string") aggregateText += `\n${part.text}`;
        if (typeof part.content === "string") aggregateText += `\n${part.content}`;
      }
    }
  }

  if (message.tool_calls) {
    aggregateText += `\n${JSON.stringify(message.tool_calls)}`;
  }
  if (message.tool_call_id) {
    aggregateText += `\n${String(message.tool_call_id)}`;
  }

  return estimateTokensFromText(aggregateText);
}

function estimateTokensFromMessages(messages: any[]): number {
  if (!Array.isArray(messages) || messages.length === 0) return 0;
  return messages.reduce((sum, message) => sum + estimateTokensFromMessage(message), 0);
}

function toFiniteTokenCount(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) {
    return Math.max(0, Math.floor(input));
  }
  if (typeof input === "string" && input.trim().length > 0) {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed));
    }
  }
  return null;
}

function buildTokenTelemetryPayload(args: {
  providerUsageInput: number | null;
  providerUsageOutput: number | null;
  providerUsageTotal: number | null;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
}): {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  tokenSource: TokenUsageSource;
} {
  const {
    providerUsageInput,
    providerUsageOutput,
    providerUsageTotal,
    estimatedInputTokens,
    estimatedOutputTokens,
  } = args;

  const hasProviderUsage =
    providerUsageTotal !== null ||
    (providerUsageInput !== null && providerUsageOutput !== null);

  if (!hasProviderUsage) {
    const inputTokens = Math.max(0, estimatedInputTokens);
    const outputTokens = Math.max(0, estimatedOutputTokens);
    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      tokenSource: "estimated",
    };
  }

  const inputTokens =
    providerUsageInput !== null
      ? providerUsageInput
      : Math.max(
          0,
          (providerUsageTotal ?? 0) - Math.max(0, providerUsageOutput ?? 0),
        );
  const outputTokens =
    providerUsageOutput !== null
      ? providerUsageOutput
      : Math.max(0, (providerUsageTotal ?? 0) - inputTokens);
  const totalTokens =
    providerUsageTotal !== null
      ? providerUsageTotal
      : Math.max(0, inputTokens + outputTokens);

  return {
    inputTokens,
    outputTokens,
    totalTokens,
    tokenSource: "provider",
  };
}

export async function* streamAIRequest(
  prompt: string,
  includeReasoning: boolean = false,
  allowedSkills?: string[],
  stopAfterToolCall: boolean = false,
  agentId?: string,
  abortSignal?: AbortSignal,
  onTelemetry?: StreamRequestTelemetryHandler,
) {
  const settings = getSettings();
  const runtimeModel = resolveRuntimeModelRoute(settings, agentId);
  const provider = runtimeModel.provider;
  const model = runtimeModel.model;
  const availableSkills = getAvailableSkills();
  const activeSkills = allowedSkills
    ? availableSkills.filter((s) => allowedSkills.includes(s.name))
    : [];
  const emitTelemetry = (event: StreamRequestTelemetryEvent) => {
    if (!onTelemetry) return;
    try {
      onTelemetry(event);
    } catch (error) {
      console.warn("streamAIRequest telemetry listener failed", error);
    }
  };

  if (provider === "deepseek" || provider === "openai_compatible") {
    if (provider === "deepseek" && !settings.deepseekApiKey) {
      yield "[ERROR] DeepSeek API Key is not configured in settings.";
      return;
    }
    const normalizedOpenAIBaseUrl = normalizeOpenAICompatibleBaseUrl(
      String(settings.openaiCompatibleBaseUrl || ""),
    );
    if (provider === "openai_compatible" && !normalizedOpenAIBaseUrl) {
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
        : `${normalizedOpenAIBaseUrl}/chat/completions`;
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

      const requestInputTokensEstimate = estimateTokensFromMessages(messages);
      emitTelemetry({
        type: "request_start",
        timestamp: Date.now(),
        provider,
        model,
        inputTokensEstimate: requestInputTokensEstimate,
      });

      let requestOutputText = "";
      let providerUsageInput: number | null = null;
      let providerUsageOutput: number | null = null;
      let providerUsageTotal: number | null = null;
      let emittedRequestEnd = false;

      const emitRequestEndTelemetry = () => {
        if (emittedRequestEnd) return;
        emittedRequestEnd = true;
        const payload = buildTokenTelemetryPayload({
          providerUsageInput,
          providerUsageOutput,
          providerUsageTotal,
          estimatedInputTokens: requestInputTokensEstimate,
          estimatedOutputTokens: estimateTokensFromText(requestOutputText),
        });
        emitTelemetry({
          type: "request_end",
          timestamp: Date.now(),
          provider,
          model,
          inputTokens: payload.inputTokens,
          outputTokens: payload.outputTokens,
          totalTokens: payload.totalTokens,
          tokenSource: payload.tokenSource,
        });
      };

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
            emitRequestEndTelemetry();
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
            requestOutputText += singleText;
            yield String(singleText);
          }

          const usage = single?.usage || single?.x_groq?.usage || null;
          if (usage) {
            providerUsageInput = toFiniteTokenCount(
              usage?.prompt_tokens ?? usage?.input_tokens ?? usage?.promptTokenCount,
            );
            providerUsageOutput = toFiniteTokenCount(
              usage?.completion_tokens ??
                usage?.output_tokens ??
                usage?.candidatesTokenCount,
            );
            providerUsageTotal = toFiniteTokenCount(
              usage?.total_tokens ?? usage?.totalTokenCount,
            );
          }
          emitRequestEndTelemetry();
          break;
        }

        let currentContent = "";
        let toolCalls: any[] = [];
        let pendingLine = "";

        function* processSseLine(rawLine: string): Generator<string, void, unknown> {
          const line = rawLine.trim();
          if (!line) return;
          if (line === "data: [DONE]") return;
          if (!line.startsWith("data: ")) return;

          try {
            const data = JSON.parse(line.slice(6));
            const usage = data?.usage;
            if (usage) {
              providerUsageInput = toFiniteTokenCount(
                usage?.prompt_tokens ?? usage?.input_tokens ?? usage?.promptTokenCount,
              );
              providerUsageOutput = toFiniteTokenCount(
                usage?.completion_tokens ??
                  usage?.output_tokens ??
                  usage?.candidatesTokenCount,
              );
              providerUsageTotal = toFiniteTokenCount(
                usage?.total_tokens ?? usage?.totalTokenCount,
              );
            }

            const delta = data.choices[0]?.delta;
            const reasoningChunk =
              delta?.reasoning_content ||
              (typeof delta?.reasoning === "string" ? delta.reasoning : "");

            if (reasoningChunk) {
              requestOutputText += reasoningChunk;
              if (includeReasoning) {
                yield reasoningChunk;
              }
            }

            if (delta?.content) {
              requestOutputText += delta.content;
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
            // Ignore parse errors for incomplete/corrupted lines
          }
        }

        while (true) {
          if (abortSignal?.aborted) return;
          const { done, value } = await reader.read();
          if (done) {
            pendingLine += decoder.decode();
            if (pendingLine.trim()) {
              yield* processSseLine(pendingLine);
            }
            break;
          }

          pendingLine += decoder.decode(value, { stream: true });
          const lines = pendingLine.split("\n");
          pendingLine = lines.pop() || "";

          for (const line of lines) {
            yield* processSseLine(line);
          }
        }

        emitRequestEndTelemetry();

        const validToolCalls = toolCalls.filter(Boolean);
        if (validToolCalls.length > 0) {
          messages.push({
            role: "assistant",
            content: currentContent || null,
            tool_calls: validToolCalls,
          });

          for (const tc of validToolCalls) {
            const toolName =
              typeof tc?.function?.name === "string" && tc.function.name.trim().length > 0
                ? tc.function.name.trim()
                : "unknown_tool";
            yield `\n[SYSTEM] Calling tool: ${toolName}...\n`;
            try {
              const args = JSON.parse(tc.function.arguments);
              const result = await executeSkill(toolName, args);
              emitTelemetry({
                type: "tool_call",
                timestamp: Date.now(),
                provider,
                model,
                toolName,
                success: true,
              });
              yield `[SYSTEM] Tool result: ${JSON.stringify(result)}\n`;
              if (stopAfterToolCall) return;
              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(result),
              });
            } catch (err: any) {
              emitTelemetry({
                type: "tool_call",
                timestamp: Date.now(),
                provider,
                model,
                toolName,
                success: false,
              });
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
            let toolName = "unknown_tool";
            try {
              const cleanJson = match[1].replace(/```json/g, "").replace(/```/g, "").trim();
              const tc = JSON.parse(cleanJson);
              toolName =
                typeof tc?.name === "string" && tc.name.trim().length > 0
                  ? tc.name.trim()
                  : "unknown_tool";
              yield `\n[SYSTEM] Calling tool (manual mode): ${toolName}...\n`;
              const result = await executeSkill(toolName, tc.arguments);
              emitTelemetry({
                type: "tool_call",
                timestamp: Date.now(),
                provider,
                model,
                toolName,
                success: true,
              });
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
              emitTelemetry({
                type: "tool_call",
                timestamp: Date.now(),
                provider,
                model,
                toolName,
                success: false,
              });
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
        emitRequestEndTelemetry();
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

      const initialInputTokensEstimate = estimateTokensFromText(prompt);
      emitTelemetry({
        type: "request_start",
        timestamp: Date.now(),
        provider,
        model,
        inputTokensEstimate: initialInputTokensEstimate,
      });
      let initialOutputText = "";
      let initialUsageInput: number | null = null;
      let initialUsageOutput: number | null = null;
      let initialUsageTotal: number | null = null;
      let emittedInitialRequestEnd = false;
      const emitInitialRequestEndTelemetry = () => {
        if (emittedInitialRequestEnd) return;
        emittedInitialRequestEnd = true;
        const initialTokenPayload = buildTokenTelemetryPayload({
          providerUsageInput: initialUsageInput,
          providerUsageOutput: initialUsageOutput,
          providerUsageTotal: initialUsageTotal,
          estimatedInputTokens: initialInputTokensEstimate,
          estimatedOutputTokens: estimateTokensFromText(initialOutputText),
        });
        emitTelemetry({
          type: "request_end",
          timestamp: Date.now(),
          provider,
          model,
          inputTokens: initialTokenPayload.inputTokens,
          outputTokens: initialTokenPayload.outputTokens,
          totalTokens: initialTokenPayload.totalTokens,
          tokenSource: initialTokenPayload.tokenSource,
        });
      };

      const response = await chat.sendMessageStream({ message: prompt });

      for await (const chunk of response) {
        if (abortSignal?.aborted) {
          return;
        }
        const c = chunk as GenerateContentResponse;
        const usage = (c as any)?.usageMetadata;
        if (usage) {
          initialUsageInput = toFiniteTokenCount(
            usage?.promptTokenCount ?? usage?.inputTokenCount,
          );
          initialUsageOutput = toFiniteTokenCount(
            usage?.candidatesTokenCount ?? usage?.outputTokenCount,
          );
          initialUsageTotal = toFiniteTokenCount(
            usage?.totalTokenCount ?? usage?.total_tokens,
          );
        }
        if (c.text) {
          initialOutputText += c.text;
          yield c.text;
        }

        if (c.functionCalls && c.functionCalls.length > 0) {
          for (const call of c.functionCalls) {
            const toolName =
              typeof call?.name === "string" && call.name.trim().length > 0
                ? call.name.trim()
                : "unknown_tool";
            try {
              yield `\n[SYSTEM] Calling tool: ${toolName}...\n`;
              const result = await executeSkill(toolName, call.args);
              emitTelemetry({
                type: "tool_call",
                timestamp: Date.now(),
                provider,
                model,
                toolName,
                success: true,
              });
              yield `[SYSTEM] Tool result: ${JSON.stringify(result)}\n`;
              if (stopAfterToolCall) {
                emitInitialRequestEndTelemetry();
                return;
              }

              // Send the result back to the model
              const followUpInput = JSON.stringify(result);
              const followUpInputTokensEstimate = estimateTokensFromText(followUpInput);
              emitTelemetry({
                type: "request_start",
                timestamp: Date.now(),
                provider,
                model,
                inputTokensEstimate: followUpInputTokensEstimate,
              });
              let followUpOutputText = "";
              let followUpUsageInput: number | null = null;
              let followUpUsageOutput: number | null = null;
              let followUpUsageTotal: number | null = null;

              const followUpResponse = await chat.sendMessageStream({
                message: [
                  {
                    functionResponse: { name: toolName, response: { result } },
                  },
                ] as any,
              });

              for await (const followUpChunk of followUpResponse) {
                if (abortSignal?.aborted) {
                  return;
                }
                const fc = followUpChunk as GenerateContentResponse;
                const followUsage = (fc as any)?.usageMetadata;
                if (followUsage) {
                  followUpUsageInput = toFiniteTokenCount(
                    followUsage?.promptTokenCount ?? followUsage?.inputTokenCount,
                  );
                  followUpUsageOutput = toFiniteTokenCount(
                    followUsage?.candidatesTokenCount ?? followUsage?.outputTokenCount,
                  );
                  followUpUsageTotal = toFiniteTokenCount(
                    followUsage?.totalTokenCount ?? followUsage?.total_tokens,
                  );
                }
                if (fc.text) {
                  followUpOutputText += fc.text;
                  yield fc.text;
                }
              }

              const followUpTokenPayload = buildTokenTelemetryPayload({
                providerUsageInput: followUpUsageInput,
                providerUsageOutput: followUpUsageOutput,
                providerUsageTotal: followUpUsageTotal,
                estimatedInputTokens: followUpInputTokensEstimate,
                estimatedOutputTokens: estimateTokensFromText(followUpOutputText),
              });
              emitTelemetry({
                type: "request_end",
                timestamp: Date.now(),
                provider,
                model,
                inputTokens: followUpTokenPayload.inputTokens,
                outputTokens: followUpTokenPayload.outputTokens,
                totalTokens: followUpTokenPayload.totalTokens,
                tokenSource: followUpTokenPayload.tokenSource,
              });
            } catch (err: any) {
              emitTelemetry({
                type: "tool_call",
                timestamp: Date.now(),
                provider,
                model,
                toolName,
                success: false,
              });
              yield `\n[ERROR] Tool call failed: ${err.message}\n`;
              if (stopAfterToolCall) {
                emitInitialRequestEndTelemetry();
                return;
              }
              // Send error back to model
              const errorInput = String(err?.message || "unknown_error");
              const errorInputTokensEstimate = estimateTokensFromText(errorInput);
              emitTelemetry({
                type: "request_start",
                timestamp: Date.now(),
                provider,
                model,
                inputTokensEstimate: errorInputTokensEstimate,
              });
              let errorOutputText = "";
              let errorUsageInput: number | null = null;
              let errorUsageOutput: number | null = null;
              let errorUsageTotal: number | null = null;

              const errorResponse = await chat.sendMessageStream({
                message: [
                  {
                    functionResponse: {
                      name: toolName,
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
                const errorUsage = (ec as any)?.usageMetadata;
                if (errorUsage) {
                  errorUsageInput = toFiniteTokenCount(
                    errorUsage?.promptTokenCount ?? errorUsage?.inputTokenCount,
                  );
                  errorUsageOutput = toFiniteTokenCount(
                    errorUsage?.candidatesTokenCount ?? errorUsage?.outputTokenCount,
                  );
                  errorUsageTotal = toFiniteTokenCount(
                    errorUsage?.totalTokenCount ?? errorUsage?.total_tokens,
                  );
                }
                if (ec.text) {
                  errorOutputText += ec.text;
                  yield ec.text;
                }
              }

              const errorTokenPayload = buildTokenTelemetryPayload({
                providerUsageInput: errorUsageInput,
                providerUsageOutput: errorUsageOutput,
                providerUsageTotal: errorUsageTotal,
                estimatedInputTokens: errorInputTokensEstimate,
                estimatedOutputTokens: estimateTokensFromText(errorOutputText),
              });
              emitTelemetry({
                type: "request_end",
                timestamp: Date.now(),
                provider,
                model,
                inputTokens: errorTokenPayload.inputTokens,
                outputTokens: errorTokenPayload.outputTokens,
                totalTokens: errorTokenPayload.totalTokens,
                tokenSource: errorTokenPayload.tokenSource,
              });
            }
          }
        }
      }

      emitInitialRequestEndTelemetry();
    } catch (e: any) {
      yield `\n[ERROR] Gemini API error: ${e.message}`;
    }
  }
}
