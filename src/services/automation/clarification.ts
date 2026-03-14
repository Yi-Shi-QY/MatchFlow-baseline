import { translateText } from '@/src/i18n/translate';
import { MAX_AUTOMATION_CLARIFICATION_ROUNDS } from './constants';
import {
  createExpandedAutomationExecutionPolicy,
  detectAutomationExecutionTargetScope,
} from './executionPolicy';
import { buildAutomationTargetTitle } from './targetSelector';
import type {
  AutomationClarificationQuestion,
  AutomationDraft,
  AutomationSchedule,
} from './types';
import { buildDailyTime, computeNextScheduleOccurrence } from './time';

function tr(
  language: 'zh' | 'en',
  key: string,
  zh: string,
  en: string,
  options: Record<string, unknown> = {},
): string {
  return translateText(language, key, language === 'zh' ? zh : en, options);
}

function parseTimeAnswer(
  answer: string,
  intentType: AutomationDraft['intentType'],
  existingSchedule: AutomationSchedule | undefined,
): AutomationSchedule | undefined {
  const normalized = answer.trim();
  if (!normalized) return undefined;

  const englishMatch = normalized.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  const chineseMatch = normalized.match(/(\d{1,2})\s*点(?::(\d{1,2}))?/);
  let hour = 0;
  let minute = 0;

  if (englishMatch) {
    hour = Number(englishMatch[1]);
    minute = Number(englishMatch[2] || '0');
    const meridiem = (englishMatch[3] || '').toLowerCase();
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
  } else if (chineseMatch) {
    hour = Number(chineseMatch[1]);
    minute = Number(chineseMatch[2] || '0');
    if (/(晚上|今晚|下午)/.test(normalized) && hour < 12) {
      hour += 12;
    }
  } else {
    return undefined;
  }

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return undefined;
  }

  const time = buildDailyTime(hour, minute);
  const timezone =
    existingSchedule?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'Asia/Shanghai';

  if (intentType === 'recurring') {
    return {
      type: 'daily',
      time,
      timezone,
    };
  }

  const base = new Date();
  base.setHours(hour, minute, 0, 0);
  if (base.getTime() <= Date.now()) {
    base.setDate(base.getDate() + 1);
  }
  return {
    type: 'one_time',
    runAt: base.toISOString(),
    timezone,
  };
}

export function getNextClarificationQuestion(
  draft: AutomationDraft,
  language: 'zh' | 'en',
): AutomationClarificationQuestion | null {
  if (draft.status !== 'needs_clarification') {
    return null;
  }
  if (draft.clarificationState.roundsUsed >= MAX_AUTOMATION_CLARIFICATION_ROUNDS) {
    return null;
  }
  if (!draft.schedule) {
    return {
      id: `${draft.id}_time`,
      field: 'time',
      prompt: tr(
        language,
        'task_center.clarification.time_prompt',
        '请补充运行时间，例如“今晚 20:00”或“每天 09:00”。',
        'Add a run time, for example "tonight 20:00" or "daily 09:00".',
      ),
      placeholder: tr(
        language,
        'task_center.clarification.time_placeholder',
        '例如：今晚 20:00',
        'Example: tonight 20:00',
      ),
    };
  }
  if (!draft.targetSelector) {
    return {
      id: `${draft.id}_target`,
      field: 'target',
      prompt: tr(
        language,
        'task_center.clarification.target_prompt',
        '请补充分析目标，例如联赛、比赛对阵，或要解析的查询范围。',
        'Add the target, such as a league, a matchup, or a query scope.',
      ),
      placeholder: tr(
        language,
        'task_center.clarification.target_placeholder',
        '例如：英超全部比赛',
        'Example: all Premier League matches',
      ),
    };
  }
  return null;
}

export function applyClarificationAnswer(
  draft: AutomationDraft,
  answer: string,
): AutomationDraft {
  const question = draft.clarificationState.lastQuestion;
  if (!question) {
    return draft;
  }

  const next: AutomationDraft = {
    ...draft,
    clarificationState: {
      ...draft.clarificationState,
      roundsUsed: draft.clarificationState.roundsUsed + 1,
      lastQuestion: undefined,
    },
    updatedAt: Date.now(),
  };

  if (question.field === 'time') {
    const parsedSchedule = parseTimeAnswer(answer, draft.intentType, draft.schedule);
    if (parsedSchedule) {
      next.schedule = parsedSchedule;
    }
  }

  if (question.field === 'target') {
    const normalized = answer.trim();
    if (normalized) {
      next.targetSelector = {
        mode: 'server_resolve',
        queryText: normalized,
        displayLabel: normalized,
      };
      if (detectAutomationExecutionTargetScope(normalized) === 'collection') {
        next.executionPolicy = createExpandedAutomationExecutionPolicy(next.executionPolicy);
      }
    }
  }

  next.status = next.schedule && next.targetSelector ? 'ready' : 'needs_clarification';
  if (next.intentType === 'recurring' && next.schedule?.type === 'daily') {
    const nextPlanned = computeNextScheduleOccurrence(next.schedule);
    if (!next.title || next.title === draft.sourceText.trim()) {
      next.title = next.targetSelector
        ? `${buildAutomationTargetTitle(next.targetSelector, 'Recurring automation')} @ ${next.schedule.time}`
        : `Recurring automation @ ${next.schedule.time}`;
    }
    if (!nextPlanned) {
      next.status = 'needs_clarification';
    }
  }
  return next;
}
