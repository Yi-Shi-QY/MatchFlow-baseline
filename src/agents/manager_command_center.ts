import { getDefaultRuntimeDomainPack } from '@/src/domains/runtime/registry';
import { resolveRuntimeManagerHelpText } from '@/src/services/manager/runtimeIntentRouter';
import {
  listRuntimeManagerToolIds,
  listRuntimeManagerToolIdsForDomain,
} from '@/src/services/manager/runtimeToolRegistry';
import type { AgentConfig } from './types';

function formatConversation(
  history: Array<{ role: 'user' | 'agent'; text: string }> | undefined,
): string {
  if (!Array.isArray(history) || history.length === 0) {
    return 'No prior conversation context.';
  }

  return history
    .slice(-6)
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.text}`)
    .join('\n');
}

function formatPendingTask(
  pendingTask:
    | {
        sourceText: string;
        stage: 'await_factors' | 'await_sequence';
        selectedSourceIds?: string[];
        sequencePreference?: string[];
      }
    | null
    | undefined,
): string {
  if (!pendingTask) {
    return 'No pending task intake.';
  }

  return JSON.stringify(pendingTask);
}

function formatContextFragments(
  fragments:
    | Array<{
        category: string;
        text: string;
      }>
    | undefined,
): string {
  if (!Array.isArray(fragments) || fragments.length === 0) {
    return 'No assembled context fragments.';
  }

  return fragments
    .slice(0, 8)
    .map((fragment) => `[${fragment.category}] ${fragment.text}`)
    .join('\n\n');
}

function buildToolChoiceRules(activeDomainId: string, hasPendingTask: boolean): string {
  const toolIds = new Set(listRuntimeManagerToolIdsForDomain(activeDomainId));
  const rules: string[] = [];

  if (toolIds.has('manager_query_local_matches')) {
    rules.push(
      'Use `manager_query_local_matches` for requests about today, tonight, tomorrow, live, or league-specific matches.',
    );
  }
  if (toolIds.has('manager_describe_capability')) {
    rules.push(
      'Use `manager_describe_capability` when the user asks what factors are supported, what order analysis uses, or needs command guidance. Always pass the active domain id.',
    );
  }
  if (toolIds.has('manager_prepare_task_intake')) {
    rules.push(
      'Use `manager_prepare_task_intake` when the user wants to analyze something now, later, or on a recurring schedule.',
    );
  }
  if (hasPendingTask && toolIds.has('manager_continue_task_intake')) {
    rules.push(
      'If pending task intake state exists, use `manager_continue_task_intake` to process the latest answer.',
    );
  }
  if (toolIds.has('manager_help')) {
    rules.push(
      'Use `manager_help` when the request is ambiguous or unsupported. Always pass the active domain id.',
    );
  }

  rules.push('Never call more than one tool in a single turn.');
  rules.push('After the tool result comes back, write the final reply in natural language.');
  rules.push('If no tool is needed, answer directly and concisely.');

  return rules.map((rule, index) => `${index + 1}. ${rule}`).join('\n');
}

export const managerCommandCenterAgent: AgentConfig = {
  id: 'manager_command_center',
  name: 'Manager Command Center',
  description:
    'Routes command-center requests to local tools for fixture lookup, task creation, and clarification.',
  skills: listRuntimeManagerToolIds(),
  systemPrompt: ({
    language,
    userInput,
    conversationHistory,
    domainId,
    domainName,
    managerPendingTask,
    managerContextFragments,
  }) => {
    const lang = language === 'zh' ? 'zh' : 'en';
    const latestInput = typeof userInput === 'string' ? userInput.trim() : '';
    const activeDomainId =
      typeof domainId === 'string' && domainId.trim()
        ? domainId.trim()
        : getDefaultRuntimeDomainPack().manifest.domainId;
    const activeDomainName =
      typeof domainName === 'string' && domainName.trim() ? domainName.trim() : activeDomainId;
    const toolChoiceRules = buildToolChoiceRules(activeDomainId, Boolean(managerPendingTask));
    const domainHelpText = resolveRuntimeManagerHelpText({
      domainId: activeDomainId,
      language: lang,
    });

    return `
You are the Manager Agent for a local-first mobile command center.
Your job is to understand the latest user turn, call at most one tool when needed, and then reply naturally as the manager agent.
Do not expose tool names, raw JSON, or internal fields to the user.

Language: ${lang}
Active domain id: ${activeDomainId}
Active domain name: ${activeDomainName}
Pending task intake state: ${formatPendingTask(managerPendingTask)}
Domain help text:
${domainHelpText}
Assembled context fragments:
${formatContextFragments(managerContextFragments)}

TOOL CHOICE RULES:
${toolChoiceRules}

RECENT CONVERSATION:
${formatConversation(conversationHistory)}

LATEST USER INPUT:
${latestInput || '(empty)'}
`;
  },
};
