import {
  createAutomationDraft,
  detectAutomationIntentType,
  parseAutomationTime,
} from '@/src/services/automation/parserCore';
import type {
  AutomationDraft,
  AutomationParserOptions,
} from '@/src/services/automation/types';

type LeagueDefinition = {
  key: string;
  label: string;
  aliases: string[];
  domainId: string;
};

const FOOTBALL_LEAGUES: LeagueDefinition[] = [
  {
    key: 'premier_league',
    label: 'Premier League',
    aliases: ['premier league', 'epl', '英超'],
    domainId: 'football',
  },
  {
    key: 'la_liga',
    label: 'La Liga',
    aliases: ['la liga', '西甲'],
    domainId: 'football',
  },
  {
    key: 'serie_a',
    label: 'Serie A',
    aliases: ['serie a', '意甲'],
    domainId: 'football',
  },
  {
    key: 'bundesliga',
    label: 'Bundesliga',
    aliases: ['bundesliga', '德甲'],
    domainId: 'football',
  },
  {
    key: 'ligue_1',
    label: 'Ligue 1',
    aliases: ['ligue 1', '法甲'],
    domainId: 'football',
  },
  {
    key: 'champions_league',
    label: 'Champions League',
    aliases: ['champions league', 'ucl', '欧冠'],
    domainId: 'football',
  },
];

function dedupeFootballLeagues(input: string): LeagueDefinition[] {
  const normalized = input.toLowerCase();
  const matched = FOOTBALL_LEAGUES.filter((league) =>
    league.aliases.some((alias) => normalized.includes(alias.toLowerCase())),
  );
  const seen = new Set<string>();
  return matched.filter((league) => {
    if (seen.has(league.key)) {
      return false;
    }
    seen.add(league.key);
    return true;
  });
}

export function parseFootballAutomationCommand(
  sourceText: string,
  options: AutomationParserOptions,
): AutomationDraft[] | null {
  const normalized = sourceText.trim();
  if (!normalized) {
    return null;
  }

  const leagues = dedupeFootballLeagues(normalized);
  if (leagues.length === 0) {
    return null;
  }

  const now = options.now || new Date();
  const intentType = detectAutomationIntentType(normalized);
  const schedule = parseAutomationTime(normalized, intentType, now);

  return leagues.map((league) =>
    createAutomationDraft({
      sourceText: normalized,
      intentType,
      domainId: league.domainId,
      schedule,
      targetSelector: {
        mode: 'league_query',
        leagueKey: league.key,
        leagueLabel: league.label,
      },
      targetScope: 'collection',
    }),
  );
}
