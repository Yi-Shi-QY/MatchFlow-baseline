import type { Match } from "@/src/data/matches";
import type { DataSourceDefinition, SourceSelection } from "@/src/services/dataSources";
import type { AnalysisDomain, AnalysisDomainContext } from "../../types";

function hasNonEmptyObject(value: any): boolean {
  return !!value && typeof value === "object" && Object.keys(value).length > 0;
}

function hasCustomInfo(value: any): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

function hasNonEmptyArray(value: any): boolean {
  return Array.isArray(value) && value.length > 0;
}

function hasSituationalNotes(value: any): boolean {
  if (!value || typeof value !== "object") return false;
  const narrative = hasCustomInfo(value.narrative);
  const signals = hasNonEmptyArray(value.signals);
  return narrative || signals;
}

function toNumber(value: any, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function copyTeam(target: any, source: any) {
  if (!target || typeof target !== "object") {
    return {
      id: source?.id,
      name: source?.name,
      logo: source?.logo,
      form: Array.isArray(source?.form) ? [...source.form] : [],
    };
  }

  if (target.id === undefined) target.id = source?.id;
  if (target.name === undefined) target.name = source?.name;
  if (target.logo === undefined) target.logo = source?.logo;
  if (target.form === undefined) {
    target.form = Array.isArray(source?.form) ? [...source.form] : [];
  }
  return target;
}

function deriveBasketballMetrics(data: any, match: Match) {
  const stats = hasNonEmptyObject(data?.stats) ? data.stats : match.stats;

  const homePossession = toNumber(stats?.possession?.home, 50);
  const awayPossession = toNumber(stats?.possession?.away, 50);
  const homeShots = toNumber(stats?.shots?.home, 80);
  const awayShots = toNumber(stats?.shots?.away, 80);
  const homeEffShots = toNumber(stats?.shotsOnTarget?.home, 35);
  const awayEffShots = toNumber(stats?.shotsOnTarget?.away, 35);

  const homePace = round1(homeShots + homePossession * 0.3);
  const awayPace = round1(awayShots + awayPossession * 0.3);
  const homeOffRating = round1(80 + homeEffShots * 1.1);
  const awayOffRating = round1(80 + awayEffShots * 1.1);
  const homeDefRating = round1(125 - awayEffShots * 0.9);
  const awayDefRating = round1(125 - homeEffShots * 0.9);
  const homeReboundRate = round1(25 + homePossession * 0.4);
  const awayReboundRate = round1(25 + awayPossession * 0.4);
  const homeTurnoverRate = round1(Math.max(7, 23 - homeEffShots * 0.25));
  const awayTurnoverRate = round1(Math.max(7, 23 - awayEffShots * 0.25));

  return {
    pace: { home: homePace, away: awayPace },
    offensiveRating: { home: homeOffRating, away: awayOffRating },
    defensiveRating: { home: homeDefRating, away: awayDefRating },
    reboundRate: { home: homeReboundRate, away: awayReboundRate },
    turnoverRate: { home: homeTurnoverRate, away: awayTurnoverRate },
  };
}

function deriveBettingLines(data: any, match: Match) {
  const odds = hasNonEmptyObject(data?.odds) ? data.odds : match.odds;
  const had = odds?.had || {};
  const hhad = odds?.hhad || {};

  return {
    moneyline: {
      home: toNumber(had.h, 1.9),
      away: toNumber(had.a, 1.9),
    },
    spread: {
      line: toNumber(hhad.goalline, 0),
      homePrice: toNumber(hhad.h, 1.9),
      awayPrice: toNumber(hhad.a, 1.9),
    },
    total: {
      points: toNumber(had.d, 221.5),
      overPrice: toNumber(had.h, 1.9),
      underPrice: toNumber(had.a, 1.9),
    },
  };
}

function resolveLegacySelection(
  sourceId: string,
  previousSelection?: Partial<SourceSelection>,
): boolean | undefined {
  if (!previousSelection) return undefined;
  const aliases: Record<string, string[]> = {
    game_context: ["context", "fundamental"],
    performance_matrix: [],
    betting_lines: ["market"],
    situational_notes: ["custom_notes", "custom"],
  };

  const legacyIds = aliases[sourceId] || [];
  for (const legacyId of legacyIds) {
    const value = previousSelection[legacyId];
    if (typeof value === "boolean") {
      return value;
    }
  }

  return undefined;
}

const BASKETBALL_DATA_SOURCES: DataSourceDefinition[] = [
  {
    id: "game_context",
    labelKey: "match.fundamental_data",
    descriptionKey: "match.fundamental_desc",
    icon: "layout",
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: () => true,
    applyToData: (data, ctx) => {
      const { match } = ctx;
      if (data.id === undefined) data.id = match.id;
      if (data.league === undefined) data.league = match.league;
      if (data.status === undefined) data.status = match.status;
      if (data.date === undefined) data.date = match.date;

      if (!hasNonEmptyObject(data.gameContext)) {
        data.gameContext = {
          competition: match.league,
          tipOffStatus: match.status,
          tipOffTime: match.date,
        };
      }

      if (!hasNonEmptyObject(data.participants)) {
        data.participants = {
          home: copyTeam(undefined, match.homeTeam),
          away: copyTeam(undefined, match.awayTeam),
        };
      } else {
        data.participants.home = copyTeam(data.participants.home, match.homeTeam);
        data.participants.away = copyTeam(data.participants.away, match.awayTeam);
      }

      // Keep top-level teams for downstream prompt/name compatibility.
      data.homeTeam = copyTeam(data.homeTeam, match.homeTeam);
      data.awayTeam = copyTeam(data.awayTeam, match.awayTeam);

      if (!hasNonEmptyObject(data.recentStretch)) {
        data.recentStretch = {
          home: Array.isArray(match.homeTeam?.form) ? [...match.homeTeam.form] : [],
          away: Array.isArray(match.awayTeam?.form) ? [...match.awayTeam.form] : [],
        };
      }
    },
    removeFromData: (data) => {
      delete data.id;
      delete data.league;
      delete data.status;
      delete data.date;
      delete data.gameContext;
      delete data.participants;
      delete data.recentStretch;
      delete data.homeTeam;
      delete data.awayTeam;
    },
    formSections: [
      {
        id: "basic_info",
        titleKey: "match.basic_info",
        columns: 2,
        fields: [
          {
            id: "competition",
            type: "text",
            path: ["gameContext", "competition"],
            labelKey: "match.league",
          },
          {
            id: "tipoff_status",
            type: "text",
            path: ["gameContext", "tipOffStatus"],
            labelKey: "match.status",
          },
          {
            id: "home_team",
            type: "text",
            path: ["participants", "home", "name"],
            labelKey: "match.home_team",
          },
          {
            id: "away_team",
            type: "text",
            path: ["participants", "away", "name"],
            labelKey: "match.away_team",
          },
        ],
      },
      {
        id: "recent_form",
        titleKey: "match.recent_form",
        columns: 2,
        fields: [
          {
            id: "home_form",
            type: "csv_array",
            path: ["recentStretch", "home"],
            labelKey: "match.home_form",
          },
          {
            id: "away_form",
            type: "csv_array",
            path: ["recentStretch", "away"],
            labelKey: "match.away_form",
          },
        ],
      },
    ],
  },
  {
    id: "performance_matrix",
    labelKey: "match.match_stats",
    descriptionKey: "match.fundamental_desc",
    icon: "layout",
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: (ctx) =>
      !!ctx.match.capabilities?.hasStats || hasNonEmptyObject(ctx.match.stats),
    applyToData: (data, ctx) => {
      if (!hasNonEmptyObject(data.basketballMetrics)) {
        data.basketballMetrics = deriveBasketballMetrics(data, ctx.match);
      }
    },
    removeFromData: (data) => {
      delete data.basketballMetrics;
    },
    formSections: [
      {
        id: "basketball_metrics",
        titleKey: "match.match_stats",
        visibleWhen: (data) => hasNonEmptyObject(data?.basketballMetrics),
        fields: [
          {
            id: "pace",
            type: "versus_number",
            labelKey: "Pace (possessions)",
            homePath: ["basketballMetrics", "pace", "home"],
            awayPath: ["basketballMetrics", "pace", "away"],
          },
          {
            id: "offensive_rating",
            type: "versus_number",
            labelKey: "Offensive Rating",
            homePath: ["basketballMetrics", "offensiveRating", "home"],
            awayPath: ["basketballMetrics", "offensiveRating", "away"],
          },
          {
            id: "defensive_rating",
            type: "versus_number",
            labelKey: "Defensive Rating",
            homePath: ["basketballMetrics", "defensiveRating", "home"],
            awayPath: ["basketballMetrics", "defensiveRating", "away"],
          },
          {
            id: "rebound_rate",
            type: "versus_number",
            labelKey: "Rebound Rate (%)",
            homePath: ["basketballMetrics", "reboundRate", "home"],
            awayPath: ["basketballMetrics", "reboundRate", "away"],
          },
          {
            id: "turnover_rate",
            type: "versus_number",
            labelKey: "Turnover Rate (%)",
            homePath: ["basketballMetrics", "turnoverRate", "home"],
            awayPath: ["basketballMetrics", "turnoverRate", "away"],
          },
        ],
      },
    ],
  },
  {
    id: "betting_lines",
    labelKey: "match.market_data",
    descriptionKey: "match.market_desc",
    icon: "trending",
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: (ctx) =>
      !!ctx.match.capabilities?.hasOdds || hasNonEmptyObject(ctx.match.odds),
    applyToData: (data, ctx) => {
      if (!hasNonEmptyObject(data.lines)) {
        data.lines = deriveBettingLines(data, ctx.match);
      }
    },
    removeFromData: (data) => {
      delete data.lines;
    },
    formSections: [
      {
        id: "betting_lines",
        titleKey: "match.market_odds",
        columns: 2,
        fields: [
          {
            id: "moneyline_home",
            type: "number",
            path: ["lines", "moneyline", "home"],
            labelKey: "Moneyline Home",
          },
          {
            id: "moneyline_away",
            type: "number",
            path: ["lines", "moneyline", "away"],
            labelKey: "Moneyline Away",
          },
          {
            id: "spread_line",
            type: "number",
            path: ["lines", "spread", "line"],
            labelKey: "Spread Line",
          },
          {
            id: "spread_home_price",
            type: "number",
            path: ["lines", "spread", "homePrice"],
            labelKey: "Spread Home Price",
          },
          {
            id: "spread_away_price",
            type: "number",
            path: ["lines", "spread", "awayPrice"],
            labelKey: "Spread Away Price",
          },
          {
            id: "total_points",
            type: "number",
            path: ["lines", "total", "points"],
            labelKey: "Total Points",
          },
          {
            id: "total_over_price",
            type: "number",
            path: ["lines", "total", "overPrice"],
            labelKey: "Over Price",
          },
          {
            id: "total_under_price",
            type: "number",
            path: ["lines", "total", "underPrice"],
            labelKey: "Under Price",
          },
        ],
      },
    ],
  },
  {
    id: "situational_notes",
    labelKey: "match.custom_data",
    descriptionKey: "match.custom_desc",
    icon: "file",
    cardSpan: 2,
    isAvailable: () => true,
    defaultSelected: (ctx) =>
      !!ctx.match.capabilities?.hasCustom ||
      hasSituationalNotes((ctx.match as any).situationalNotes) ||
      hasCustomInfo((ctx.match as any).customInfo) ||
      hasSituationalNotes(ctx.importedData?.situationalNotes) ||
      hasCustomInfo(ctx.importedData?.customInfo),
    applyToData: (data, ctx) => {
      if (!hasNonEmptyObject(data.situationalNotes)) {
        const importedNotes = ctx.importedData?.situationalNotes;
        const matchNotes = (ctx.match as any).situationalNotes;
        const fallbackNarrative = (ctx.match as any).customInfo || ctx.importedData?.customInfo || "";

        data.situationalNotes = {
          narrative:
            (hasCustomInfo(importedNotes?.narrative) && importedNotes.narrative) ||
            (hasCustomInfo(matchNotes?.narrative) && matchNotes.narrative) ||
            fallbackNarrative,
          signals: hasNonEmptyArray(importedNotes?.signals)
            ? [...importedNotes.signals]
            : hasNonEmptyArray(matchNotes?.signals)
              ? [...matchNotes.signals]
              : [],
        };
      }
      if (data.customInfo === undefined) {
        data.customInfo = data.situationalNotes?.narrative || "";
      }
    },
    removeFromData: (data) => {
      delete data.situationalNotes;
      delete data.customInfo;
    },
    formSections: [
      {
        id: "situational_notes",
        titleKey: "match.custom_data",
        fields: [
          {
            id: "narrative",
            type: "textarea",
            path: ["situationalNotes", "narrative"],
            placeholderKey: "match.custom_placeholder",
            rows: 4,
          },
          {
            id: "signals",
            type: "csv_array",
            path: ["situationalNotes", "signals"],
            labelKey: "Situational Signals",
            placeholder: "pace-up, back-to-back, travel-fatigue",
          },
        ],
      },
    ],
  },
];

function resolveBasketballSourceSelection(
  match: Match,
  importedData: any,
  previousSelection?: Partial<SourceSelection>,
): SourceSelection {
  const ctx: AnalysisDomainContext = { match, importedData };
  return BASKETBALL_DATA_SOURCES.reduce((acc, source) => {
    if (!source.isAvailable(ctx)) {
      acc[source.id] = false;
      return acc;
    }
    const prev = previousSelection?.[source.id];
    const legacyPrev = resolveLegacySelection(source.id, previousSelection);
    acc[source.id] =
      typeof prev === "boolean"
        ? prev
        : typeof legacyPrev === "boolean"
          ? legacyPrev
          : source.defaultSelected(ctx);
    return acc;
  }, {} as SourceSelection);
}

function buildBasketballSourceCapabilities(data: any, selectedSources: SourceSelection) {
  const hasStats =
    hasNonEmptyObject(data?.basketballMetrics) || hasNonEmptyObject(data?.stats);
  const hasOdds = hasNonEmptyObject(data?.lines) || hasNonEmptyObject(data?.odds);
  const hasCustom =
    hasSituationalNotes(data?.situationalNotes) || hasCustomInfo(data?.customInfo);
  const hasFundamental =
    !!selectedSources.game_context &&
    (hasNonEmptyObject(data?.participants) ||
      hasNonEmptyObject(data?.gameContext) ||
      typeof data?.league === "string");

  return {
    hasFundamental,
    hasStats,
    hasOdds,
    hasCustom,
    hasPerformanceMatrix: hasNonEmptyObject(data?.basketballMetrics),
    hasBettingLines: hasNonEmptyObject(data?.lines),
    hasSituationalNotes: hasSituationalNotes(data?.situationalNotes),
  };
}

export const basketballDomain: AnalysisDomain = {
  id: "basketball",
  name: "Basketball Analysis",
  description: "Built-in basketball analysis experience.",
  resources: {
    templates: [
      "basketball_basic",
      "basketball_standard",
      "basketball_lines_focused",
      "basketball_comprehensive",
    ],
    animations: [
      "basketball-metrics-radar",
      "basketball-lines-card",
      "basketball-matchup-board",
    ],
    agents: [
      "basketball_overview",
      "basketball_stats",
      "basketball_tactical",
      "basketball_market",
      "basketball_prediction",
      "basketball_general",
      "planner_template",
      "planner_autonomous",
      "tag",
      "summary",
      "animation",
    ],
    skills: ["calculator", "select_plan_template"],
  },
  dataSources: BASKETBALL_DATA_SOURCES,
  getAvailableDataSources: (context) =>
    BASKETBALL_DATA_SOURCES.filter((source) => source.isAvailable(context)),
  resolveSourceSelection: (match, importedData, previousSelection) =>
    resolveBasketballSourceSelection(match, importedData, previousSelection),
  buildSourceCapabilities: buildBasketballSourceCapabilities,
};
