import { getAgent } from '@/src/agents';
import type { RuntimeToolExecutionResult } from '@/src/domains/runtime/types';
import { resolveRuntimeModelRoute } from '@/src/services/ai/runtimeModel';
import { streamAIRequest } from '@/src/services/ai/streamRequest';
import { getSettings } from '@/src/services/settings';
import type { ManagerGatewayLlmPlanner } from '@/src/services/manager-gateway/types';
import {
  mapRuntimeManagerEffect,
  parseRuntimeManagerTaskIntakeSummary,
  parseRuntimeManagerPendingTask,
  runtimePackSupportsManagerLlm,
} from './runtimeIntentRouter';
import type { ManagerConversationEffect, ManagerLanguage } from './types';

function createAbortError(): Error & { name: string } {
  const error = new Error('Manager run aborted') as Error & { name: string };
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  throw createAbortError();
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: string }).name === 'AbortError'
  );
}

async function collectStreamText(
  stream: AsyncGenerator<string>,
  signal?: AbortSignal,
): Promise<string> {
  throwIfAborted(signal);
  let output = '';
  for await (const chunk of stream) {
    throwIfAborted(signal);
    output += chunk;
  }
  throwIfAborted(signal);
  return output;
}

function stripManagerReasoningArtifacts(text: string): string {
  if (!text) {
    return '';
  }

  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<\|begin_of_thought\|>[\s\S]*?<\|end_of_thought\|>/gi, '')
    .replace(/^\s*<(?:think|thinking|reasoning)>[\s\S]*$/i, '')
    .replace(/^\s*<\|begin_of_thought\|>[\s\S]*$/i, '')
    .trim();
}

function parseManagerToolResult(output: string): ManagerConversationEffect | null {
  const matches = [...output.matchAll(/\[SYSTEM\] Tool result: (.+)/g)];
  const raw = matches.length > 0 ? matches[matches.length - 1][1] : null;
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.agentText === 'string' &&
      (parsed.messageKind === 'text' || parsed.messageKind === 'draft_bundle')
    ) {
      return parsed as ManagerConversationEffect;
    }
  } catch (error) {
    console.error('Failed to parse manager tool result', error);
  }

  return null;
}

function extractManagerAssistantReply(output: string): string {
  return stripManagerReasoningArtifacts(
    output
    .replace(/\[SYSTEM_NOTICE\][^\n]*\n?/g, '')
    .replace(/\[SYSTEM\] Calling tool(?: \(manual mode\))?:[^\n]*\n?/g, '')
    .replace(/\[SYSTEM\] Tool result: [^\n]*\n?/g, '')
    .replace(/\[ERROR\][^\n]*\n?/g, '')
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
    .trim(),
  );
}

function extractManagerError(output: string): string | null {
  const matches = [...output.matchAll(/\[ERROR\]\s*([^\n]+)/g)];
  const raw = matches.length > 0 ? matches[matches.length - 1][1] : null;
  return raw && raw.trim().length > 0 ? raw.trim() : null;
}

function getManagerConnectionIssue(language: ManagerLanguage): string | null {
  const settings = getSettings();
  const route = resolveRuntimeModelRoute(settings, 'manager_command_center');

  if (route.provider === 'gemini') {
    const configuredApiKey =
      typeof settings.geminiApiKey === 'string' ? settings.geminiApiKey.trim() : '';
    const envApiKey =
      typeof process !== 'undefined' && typeof process.env.GEMINI_API_KEY === 'string'
        ? process.env.GEMINI_API_KEY.trim()
        : '';
    if (configuredApiKey.length > 0 || envApiKey.length > 0) {
      return null;
    }

    return language === 'zh'
      ? `当前对话正式分析实际使用 Gemini（${route.model}），但 Gemini API Key 尚未配置。`
      : `Formal conversation analysis currently uses Gemini (${route.model}), but the Gemini API key is missing.`;
  }

  if (route.provider === 'deepseek') {
    const configuredApiKey =
      typeof settings.deepseekApiKey === 'string' ? settings.deepseekApiKey.trim() : '';
    if (configuredApiKey.length > 0) {
      return null;
    }

    return language === 'zh'
      ? `当前对话正式分析实际使用 DeepSeek（${route.model}），但 DeepSeek API Key 尚未配置。`
      : `Formal conversation analysis currently uses DeepSeek (${route.model}), but the DeepSeek API key is missing.`;
  }

  const baseUrl =
    typeof settings.openaiCompatibleBaseUrl === 'string'
      ? settings.openaiCompatibleBaseUrl.trim()
      : '';
  if (baseUrl.length > 0) {
    return null;
  }

  return language === 'zh'
    ? `当前对话正式分析实际使用 OpenAI Compatible（${route.model}），但 Base URL 尚未配置。`
    : `Formal conversation analysis currently uses OpenAI Compatible (${route.model}), but the base URL is missing.`;
}

function buildAiSetupToolResult(language: ManagerLanguage, reason?: string): RuntimeToolExecutionResult {
  const suffix =
    typeof reason === 'string' && reason.trim().length > 0
      ? language === 'zh'
        ? ` 当前原因：${reason.trim()}。`
        : ` Current reason: ${reason.trim()}.`
      : '';

  const text =
    language === 'zh'
      ? `当前主管 Agent 没有可用的 AI 连接。请到设置页检查当前生效的提供商、模型和 API Key 后重试。${suffix}`
      : `The manager agent does not have a working AI connection. Open Settings, review the active provider, model, and API key, then try again.${suffix}`;

  return {
    blocks: [
      {
        blockType: 'assistant_text',
        role: 'assistant',
        text,
        payload: {
          action: {
            type: 'open_settings',
            label: language === 'zh' ? '打开设置' : 'Open Settings',
          },
        },
      },
    ],
    diagnostics: {
      feedbackMessage: text,
      shouldRefreshTaskState: false,
    },
  };
}

export function createLegacyManagerGatewayLlmPlanner(): ManagerGatewayLlmPlanner {
  return {
    async planTurn(input) {
      if (!runtimePackSupportsManagerLlm({ runtimePack: input.runtimePack })) {
        return input.requireLlm
          ? {
              blocks: [
                {
                  blockType: 'assistant_text',
                  role: 'assistant',
                  text:
                    input.language === 'zh'
                      ? '当前领域还没有接入 Gateway 的 AI 规划器。'
                      : 'This domain does not have a gateway AI planner yet.',
                },
              ],
              diagnostics: {
                feedbackMessage:
                  input.language === 'zh'
                    ? '当前领域还没有接入 Gateway 的 AI 规划器。'
                    : 'This domain does not have a gateway AI planner yet.',
              },
            }
          : null;
      }

      const connectionIssue = getManagerConnectionIssue(input.language);
      if (connectionIssue) {
        return input.requireLlm ? buildAiSetupToolResult(input.language, connectionIssue) : null;
      }

      try {
        throwIfAborted(input.signal);
        const agent = getAgent('manager_command_center');
        const pendingTask = parseRuntimeManagerPendingTask({
          runtimePack: input.runtimePack,
          workflow: input.projection.activeWorkflow,
        });
        const taskIntake = parseRuntimeManagerTaskIntakeSummary({
          runtimePack: input.runtimePack,
          workflow: input.projection.activeWorkflow,
          language: input.language,
        });
        const prompt = agent.systemPrompt({
          language: input.language,
          userInput: input.input,
          conversationHistory: input.recentMessages
            .filter((message) => message.role === 'user' || message.role === 'assistant')
            .map((message) => ({
              role: message.role === 'assistant' ? 'agent' : 'user',
              text: message.text,
            })),
          domainId: input.runtimePack.manifest.domainId,
          domainName: input.runtimePack.manifest.displayName,
          managerPendingTask: pendingTask
            ? {
                sourceText: pendingTask.sourceText,
                stage: pendingTask.stage,
                selectedSourceIds: pendingTask.selectedSourceIds,
                sequencePreference: pendingTask.sequencePreference,
              }
            : null,
          managerTaskIntake: taskIntake,
          managerContextFragments: Array.isArray(input.contextFragments)
            ? input.contextFragments.map((fragment) => ({
                category: fragment.category,
                text: fragment.text,
              }))
            : undefined,
        });
        const output = await collectStreamText(
          streamAIRequest(
            prompt,
            false,
            agent.skills,
            false,
            agent.id,
            input.signal,
          ),
          input.signal,
        );
        throwIfAborted(input.signal);
        const assistantReply = extractManagerAssistantReply(output);
        const effect = parseManagerToolResult(output);
        const streamError = extractManagerError(output);
        const hasActiveTaskIntake = Boolean(taskIntake || pendingTask);

        if (effect) {
          return mapRuntimeManagerEffect({
            runtimePack: input.runtimePack,
            effect: {
              ...effect,
              agentText: effect.agentText,
              feedbackMessage: effect.feedbackMessage || effect.agentText,
            },
          });
        }

        if (assistantReply && !hasActiveTaskIntake) {
          return {
            blocks: [
              {
                blockType: 'assistant_text',
                role: 'assistant',
                text: assistantReply,
              },
            ],
            diagnostics: {
              feedbackMessage: assistantReply,
            },
          };
        }

        if (streamError) {
          return null;
        }

        return null;
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        console.warn('Gateway manager LLM planning failed.', error);
        return null;
      }
    },
  };
}
