import { getAgent } from '@/src/agents';
import { FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE, mapLegacyManagerEffectToRuntimeToolResult, parsePendingTaskFromWorkflow } from '@/src/domains/runtime/football/tools';
import type { RuntimeToolExecutionResult } from '@/src/domains/runtime/types';
import { streamAIRequest } from '@/src/services/ai/streamRequest';
import { getSettings } from '@/src/services/settings';
import type { ManagerGatewayLlmPlanner } from '@/src/services/manager-gateway/types';
import type { ManagerConversationEffect, ManagerLanguage } from './types';

function canUseManagerLLM(): boolean {
  const settings = getSettings();
  if (settings.provider === 'gemini') {
    return typeof settings.geminiApiKey === 'string' && settings.geminiApiKey.trim().length > 0;
  }
  if (settings.provider === 'deepseek') {
    return typeof settings.deepseekApiKey === 'string' && settings.deepseekApiKey.trim().length > 0;
  }
  const baseUrl =
    typeof settings.openaiCompatibleBaseUrl === 'string'
      ? settings.openaiCompatibleBaseUrl.trim()
      : '';
  return baseUrl.length > 0;
}

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
  return output
    .replace(/\[SYSTEM_NOTICE\][^\n]*\n?/g, '')
    .replace(/\[SYSTEM\] Calling tool(?: \(manual mode\))?:[^\n]*\n?/g, '')
    .replace(/\[SYSTEM\] Tool result: [^\n]*\n?/g, '')
    .replace(/\[ERROR\][^\n]*\n?/g, '')
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
    .trim();
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
      ? `当前主管 Agent 还没有可用的 AI 连接。请先到设置页补充 API Key，完成“测试 AI 连接”后再回来继续。${suffix}`
      : `The manager agent does not have a usable AI connection yet. Open Settings, add the required API key, verify it with "Test AI Connection", and then come back here to continue.${suffix}`;

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
      if (input.runtimePack.manifest.domainId !== 'football') {
        return input.requireLlm
          ? {
              blocks: [
                {
                  blockType: 'assistant_text',
                  role: 'assistant',
                  text:
                    input.language === 'zh'
                      ? '当前域还没有接入 Gateway 的 AI 规划器。'
                      : 'This domain does not have a gateway AI planner yet.',
                },
              ],
              diagnostics: {
                feedbackMessage:
                  input.language === 'zh'
                    ? '当前域还没有接入 Gateway 的 AI 规划器。'
                    : 'This domain does not have a gateway AI planner yet.',
              },
            }
          : null;
      }

      if (!canUseManagerLLM()) {
        return input.requireLlm ? buildAiSetupToolResult(input.language) : null;
      }

      try {
        throwIfAborted(input.signal);
        const agent = getAgent('manager_command_center');
        const pendingTask = parsePendingTaskFromWorkflow(input.projection.activeWorkflow);
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

        if (effect) {
          return mapLegacyManagerEffectToRuntimeToolResult({
            ...effect,
            agentText: assistantReply || effect.agentText,
            feedbackMessage: effect.feedbackMessage || assistantReply || effect.agentText,
          });
        }

        if (assistantReply && !pendingTask) {
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

        return input.requireLlm
          ? buildAiSetupToolResult(
              input.language,
              input.language === 'zh'
                ? 'AI 规划未返回可执行结果'
                : 'AI planning did not return an executable result',
            )
          : null;
      } catch (error) {
        if (isAbortError(error)) {
          throw error;
        }
        console.warn('Gateway manager LLM planning failed.', error);
        return input.requireLlm
          ? buildAiSetupToolResult(
              input.language,
              input.language === 'zh'
                ? 'AI 连接尚未通过验证'
                : 'AI connection is not verified yet',
            )
          : null;
      }
    },
  };
}

export { FOOTBALL_TASK_INTAKE_WORKFLOW_TYPE };
