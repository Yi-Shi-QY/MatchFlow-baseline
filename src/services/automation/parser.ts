import {
  DEFAULT_AUTOMATION_EXECUTION_POLICY,
  DEFAULT_AUTOMATION_NOTIFICATION_POLICY,
} from './constants';
import { getNextClarificationQuestion } from './clarification';
import { buildDailyTime } from './time';
import type {
  AutomationDraft,
  AutomationIntentType,
  AutomationParserOptions,
  AutomationSchedule,
  AutomationTargetSelector,
} from './types';
import { createAutomationId, resolveAutomationTimeZone } from './utils';

type LeagueDefinition = {
  key: string;
  label: string;
  aliases: string[];
  domainId: string;
};

const LEAGUES: LeagueDefinition[] = [
  { key: 'premier_league', label: 'Premier League', aliases: ['premier league', 'epl', '英超'], domainId: 'football' },
  { key: 'la_liga', label: 'La Liga', aliases: ['la liga', '西甲'], domainId: 'football' },
  { key: 'serie_a', label: 'Serie A', aliases: ['serie a', '意甲'], domainId: 'football' },
  { key: 'bundesliga', label: 'Bundesliga', aliases: ['bundesliga', '德甲'], domainId: 'football' },
  { key: 'ligue_1', label: 'Ligue 1', aliases: ['ligue 1', '法甲'], domainId: 'football' },
  { key: 'champions_league', label: 'Champions League', aliases: ['champions league', 'ucl', '欧冠'], domainId: 'football' },
];

function detectIntentType(input: string): AutomationIntentType {
  if (/(every day|daily|每天|每日)/i.test(input)) {
    return 'recurring';
  }
  return 'one_time';
}

function dedupeLeagues(input: string): LeagueDefinition[] {
  const normalized = input.toLowerCase();
  const matched = LEAGUES.filter((league) =>
    league.aliases.some((alias) => normalized.includes(alias.toLowerCase())),
  );
  const seen = new Set<string>();
  return matched.filter((league) => {
    if (seen.has(league.key)) return false;
    seen.add(league.key);
    return true;
  });
}

function parseTime(
  input: string,
  intentType: AutomationIntentType,
  now: Date,
): AutomationSchedule | undefined {
  const timezone = resolveAutomationTimeZone();
  const englishMatch = input.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  const chineseMatch = input.match(/(\d{1,2})\s*点(?:(\d{1,2}))?/);
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

function parseMatchupSelector(input: string): AutomationTargetSelector | undefined {
  const normalized = input
    .replace(/analyze|analysis|schedule|run|automate|自动|分析|任务|安排/gi, ' ')
    .trim();
  const matchup = normalized.match(
    /([a-zA-Z0-9\u4e00-\u9fa5 .'-]{2,}?)\s*(?:vs|VS|对|對)\s*([a-zA-Z0-9\u4e00-\u9fa5 .'-]{2,}?)(?:$|\s+(?:at|on|every|daily|每天|今晚|明天))/,
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

function buildDraftTitle(
  selector: AutomationTargetSelector | undefined,
  sourceText: string,
): string {
  if (!selector) {
    return sourceText.trim();
  }
  if (selector.mode === 'league_query') {
    return selector.leagueLabel;
  }
  if (selector.mode === 'fixed_subject') {
    return selector.subjectLabel;
  }
  return selector.displayLabel;
}

function createDraft(
  sourceText: string,
  intentType: AutomationIntentType,
  domainId: string,
  schedule: AutomationSchedule | undefined,
  targetSelector: AutomationTargetSelector | undefined,
  targetExpansion: 'single' | 'all_matches',
): AutomationDraft {
  const createdAt = Date.now();
  const language = /[\u4e00-\u9fa5]/.test(sourceText) ? 'zh' : 'en';
  const draft: AutomationDraft = {
    id: createAutomationId('automation_draft'),
    sourceText,
    title: buildDraftTitle(targetSelector, sourceText),
    status: schedule && targetSelector ? 'ready' : 'needs_clarification',
    intentType,
    activationMode: 'save_only',
    domainId,
    schedule,
    targetSelector,
    executionPolicy: {
      ...DEFAULT_AUTOMATION_EXECUTION_POLICY,
      targetExpansion,
    },
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

export function parseAutomationCommand(
  sourceText: string,
  options: AutomationParserOptions,
): AutomationDraft[] {
  const normalized = sourceText.trim();
  if (!normalized) return [];

  const now = options.now || new Date();
  const intentType = detectIntentType(normalized);
  const schedule = parseTime(normalized, intentType, now);
  const leagues = dedupeLeagues(normalized);
  const matchupSelector = parseMatchupSelector(normalized);
  const targetExpansion = /(全部|全量|all matches|all fixtures)/i.test(normalized)
    ? 'all_matches'
    : 'single';

  if (leagues.length > 1) {
    return leagues.map((league) =>
      createDraft(
        normalized,
        intentType,
        league.domainId,
        schedule,
        {
          mode: 'league_query',
          leagueKey: league.key,
          leagueLabel: league.label,
        },
        'all_matches',
      ),
    );
  }

  if (leagues.length === 1) {
    const league = leagues[0];
    return [
      createDraft(
        normalized,
        intentType,
        league.domainId,
        schedule,
        {
          mode: 'league_query',
          leagueKey: league.key,
          leagueLabel: league.label,
        },
        'all_matches',
      ),
    ];
  }

  if (matchupSelector) {
    return [
      createDraft(
        normalized,
        intentType,
        options.defaultDomainId,
        schedule,
        matchupSelector,
        targetExpansion,
      ),
    ];
  }

  if (/(stocks|stock|美股|股市)/i.test(normalized)) {
    return [
      createDraft(
        normalized,
        intentType,
        'stocks',
        schedule,
        {
          mode: 'server_resolve',
          queryText: normalized,
          displayLabel: 'Stocks automation query',
        },
        targetExpansion,
      ),
    ];
  }

  return [
    createDraft(
      normalized,
      intentType,
      options.defaultDomainId,
      schedule,
      undefined,
      targetExpansion,
    ),
  ];
}
