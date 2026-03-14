import {
  DEFAULT_AUTOMATION_EXECUTION_POLICY,
  DEFAULT_AUTOMATION_NOTIFICATION_POLICY,
} from './constants';
import { getNextClarificationQuestion } from './clarification';
import {
  createAutomationExecutionPolicyForScope,
  type AutomationExecutionTargetScope,
} from './executionPolicy';
import { buildAutomationTargetTitle } from './targetSelector';
import { buildDailyTime } from './time';
import type {
  AutomationDraft,
  AutomationIntentType,
  AutomationSchedule,
  AutomationTargetSelector,
} from './types';
import { createAutomationId, resolveAutomationTimeZone } from './utils';

export function detectAutomationIntentType(input: string): AutomationIntentType {
  if (/(every day|daily|每天|每日)/i.test(input)) {
    return 'recurring';
  }
  return 'one_time';
}

export function parseAutomationTime(
  input: string,
  intentType: AutomationIntentType,
  now: Date,
): AutomationSchedule | undefined {
  const timezone = resolveAutomationTimeZone();
  const englishMatch = input.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  const chineseMatch = input.match(/(\d{1,2})\s*点(?::(\d{1,2}))?/);
  let hour = 0;
  let minute = 0;
  let found = false;

  if (englishMatch) {
    hour = Number(englishMatch[1]);
    minute = Number(englishMatch[2] || '0');
    const meridiem = (englishMatch[3] || '').toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    found = true;
  } else if (chineseMatch) {
    hour = Number(chineseMatch[1]);
    minute = Number(chineseMatch[2] || '0');
    if (/(晚上|今晚|明晚|下午)/.test(input) && hour < 12) {
      hour += 12;
    }
    found = true;
  }

  if (!found || !Number.isFinite(hour) || !Number.isFinite(minute)) {
    return undefined;
  }

  if (intentType === 'recurring') {
    return {
      type: 'daily',
      time: buildDailyTime(hour, minute),
      timezone,
    };
  }

  const runAt = new Date(now);
  runAt.setHours(hour, minute, 0, 0);
  if (/(tomorrow|明天|明晚)/i.test(input)) {
    runAt.setDate(runAt.getDate() + 1);
  } else if (runAt.getTime() <= now.getTime()) {
    runAt.setDate(runAt.getDate() + 1);
  }

  return {
    type: 'one_time',
    runAt: runAt.toISOString(),
    timezone,
  };
}

export function parseMatchupAutomationSelector(
  input: string,
): AutomationTargetSelector | undefined {
  const normalized = input
    .replace(/analyze|analysis|schedule|run|automate|自动|分析|任务|安排/gi, ' ')
    .trim();
  const matchup = normalized.match(
    /([a-zA-Z0-9\u4e00-\u9fa5 .'-]{2,}?)\s*(?:vs|VS|对阵)\s*([a-zA-Z0-9\u4e00-\u9fa5 .'-]{2,}?)(?:$|\s+(?:at|on|every|daily|每天|今晚|明天))/,
  );
  if (!matchup) {
    return undefined;
  }
  const left = matchup[1].trim();
  const right = matchup[2].trim();
  if (!left || !right) {
    return undefined;
  }
  const label = `${left} vs ${right}`;
  return {
    mode: 'server_resolve',
    queryText: label,
    displayLabel: label,
  };
}

export function createAutomationDraft(input: {
  sourceText: string;
  intentType: AutomationIntentType;
  domainId: string;
  schedule: AutomationSchedule | undefined;
  targetSelector: AutomationTargetSelector | undefined;
  targetScope: AutomationExecutionTargetScope;
}): AutomationDraft {
  const createdAt = Date.now();
  const language = /[\u4e00-\u9fa5]/.test(input.sourceText) ? 'zh' : 'en';
  const draft: AutomationDraft = {
    id: createAutomationId('automation_draft'),
    sourceText: input.sourceText,
    title: buildAutomationTargetTitle(input.targetSelector, input.sourceText),
    status: input.schedule && input.targetSelector ? 'ready' : 'needs_clarification',
    intentType: input.intentType,
    activationMode: 'save_only',
    domainId: input.domainId,
    schedule: input.schedule,
    targetSelector: input.targetSelector,
    executionPolicy: createAutomationExecutionPolicyForScope(
      input.targetScope,
      DEFAULT_AUTOMATION_EXECUTION_POLICY,
    ),
    notificationPolicy: DEFAULT_AUTOMATION_NOTIFICATION_POLICY,
    clarificationState: {
      roundsUsed: 0,
    },
    createdAt,
    updatedAt: createdAt,
  };
  draft.clarificationState.lastQuestion =
    getNextClarificationQuestion(draft, language) || undefined;
  return draft;
}
