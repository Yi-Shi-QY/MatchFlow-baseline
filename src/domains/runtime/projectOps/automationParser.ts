import { detectAutomationExecutionTargetScope } from '@/src/services/automation/executionPolicy';
import {
  createAutomationDraft,
  detectAutomationIntentType,
  parseAutomationTime,
} from '@/src/services/automation/parserCore';
import type {
  AutomationDraft,
  AutomationParserOptions,
} from '@/src/services/automation/types';
import {
  PROJECT_OPS_DOMAIN_ID,
  searchProjectOpsLocalCases,
} from '@/src/services/domains/modules/projectOps/localCases';

function hasProjectOpsSignals(input: string): boolean {
  return /(project|task|initiative|handoff|deadline|review|milestone|owner|blocker|ops|launch|cutover|support|项目|任务|专项|里程碑|负责人|阻塞|交接|截止|复盘|推进|上线|风险)/i.test(
    input,
  );
}

function resolveTargetSelector(sourceText: string) {
  const matches = searchProjectOpsLocalCases(sourceText);
  if (matches.length > 0) {
    const top = matches[0];
    return {
      mode: 'fixed_subject' as const,
      subjectId: top.id,
      subjectLabel: top.title,
    };
  }

  if (!hasProjectOpsSignals(sourceText)) {
    return undefined;
  }

  const cleaned = sourceText
    .replace(
      /\b(analy[sz]e|analysis|schedule|run|every day|daily|automate|create task)\b|分析|定时|自动|安排/gi,
      ' ',
    )
    .replace(/\b(project ops)\b|项目运营|项目分析/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    mode: 'server_resolve' as const,
    queryText: cleaned || sourceText.trim(),
    displayLabel: cleaned || sourceText.trim(),
  };
}

export function parseProjectOpsAutomationCommand(
  sourceText: string,
  options: AutomationParserOptions,
): AutomationDraft[] | null {
  const normalized = sourceText.trim();
  if (!normalized) {
    return null;
  }

  if (!hasProjectOpsSignals(normalized) && searchProjectOpsLocalCases(normalized).length === 0) {
    return null;
  }

  const now = options.now || new Date();
  const intentType = detectAutomationIntentType(normalized);
  const schedule = parseAutomationTime(normalized, intentType, now);
  const targetSelector = resolveTargetSelector(normalized);

  return [
    createAutomationDraft({
      sourceText: normalized,
      intentType,
      domainId: PROJECT_OPS_DOMAIN_ID,
      schedule,
      targetSelector,
      targetScope: detectAutomationExecutionTargetScope(normalized),
    }),
  ];
}
