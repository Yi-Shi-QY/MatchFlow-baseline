import { Match } from "@/src/data/matches";

// Source ids are intentionally open-ended so each domain can define its own set.
export type SourceId = string;
export type SourceSelection = Record<SourceId, boolean>;

export type SourceIconKey = "layout" | "trending" | "file";

type Path = string[];

export interface SourceContext {
  match: Match;
  importedData?: any;
}

interface BaseFieldSchema {
  id: string;
  labelKey?: string;
}

export interface TextFieldSchema extends BaseFieldSchema {
  type: "text";
  path: Path;
  placeholderKey?: string;
}

export interface NumberFieldSchema extends BaseFieldSchema {
  type: "number";
  path: Path;
  placeholderKey?: string;
}

export interface TextareaFieldSchema extends BaseFieldSchema {
  type: "textarea";
  path: Path;
  placeholderKey?: string;
  rows?: number;
}

export interface CsvArrayFieldSchema extends BaseFieldSchema {
  type: "csv_array";
  path: Path;
  placeholderKey?: string;
  placeholder?: string;
}

export interface VersusNumberFieldSchema extends BaseFieldSchema {
  type: "versus_number";
  homePath: Path;
  awayPath: Path;
}

export interface OddsTripletFieldSchema extends BaseFieldSchema {
  type: "odds_triplet";
  homePath: Path;
  drawPath: Path;
  awayPath: Path;
  homePlaceholderKey: string;
  drawPlaceholderKey: string;
  awayPlaceholderKey: string;
}

export type FormFieldSchema =
  | TextFieldSchema
  | NumberFieldSchema
  | TextareaFieldSchema
  | CsvArrayFieldSchema
  | VersusNumberFieldSchema
  | OddsTripletFieldSchema;

export interface FormSectionSchema {
  id: string;
  titleKey: string;
  fields: FormFieldSchema[];
  visibleWhen?: (data: any) => boolean;
  columns?: 1 | 2;
}

export interface DataSourceDefinition {
  id: SourceId;
  labelKey: string;
  descriptionKey: string;
  icon: SourceIconKey;
  cardSpan: 1 | 2;
  isAvailable: (ctx: SourceContext) => boolean;
  defaultSelected: (ctx: SourceContext) => boolean;
  applyToData: (data: any, ctx: SourceContext) => void;
  removeFromData: (data: any) => void;
  formSections: FormSectionSchema[];
}

function hasNonEmptyObject(value: any): boolean {
  return !!value && typeof value === "object" && Object.keys(value).length > 0;
}

function hasCustomInfo(value: any): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value != null;
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

export const ANALYSIS_DATA_SOURCES: DataSourceDefinition[] = [
  {
    id: "fundamental",
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

      data.homeTeam = copyTeam(data.homeTeam, match.homeTeam);
      data.awayTeam = copyTeam(data.awayTeam, match.awayTeam);

      if (data.stats === undefined && match.stats) {
        data.stats = { ...match.stats };
      }
    },
    removeFromData: (data) => {
      delete data.id;
      delete data.league;
      delete data.status;
      delete data.date;
      delete data.homeTeam;
      delete data.awayTeam;
      delete data.stats;
    },
    formSections: [
      {
        id: "basic_info",
        titleKey: "match.basic_info",
        columns: 2,
        fields: [
          { id: "league", type: "text", path: ["league"], labelKey: "match.league" },
          { id: "status", type: "text", path: ["status"], labelKey: "match.status" },
          {
            id: "home_team",
            type: "text",
            path: ["homeTeam", "name"],
            labelKey: "match.home_team",
          },
          {
            id: "away_team",
            type: "text",
            path: ["awayTeam", "name"],
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
            path: ["homeTeam", "form"],
            labelKey: "match.home_form",
          },
          {
            id: "away_form",
            type: "csv_array",
            path: ["awayTeam", "form"],
            labelKey: "match.away_form",
          },
        ],
      },
      {
        id: "match_stats",
        titleKey: "match.match_stats",
        visibleWhen: (data) => hasNonEmptyObject(data?.stats),
        fields: [
          {
            id: "possession",
            type: "versus_number",
            labelKey: "match.possession",
            homePath: ["stats", "possession", "home"],
            awayPath: ["stats", "possession", "away"],
          },
          {
            id: "shots",
            type: "versus_number",
            labelKey: "match.shots",
            homePath: ["stats", "shots", "home"],
            awayPath: ["stats", "shots", "away"],
          },
          {
            id: "shots_on_target",
            type: "versus_number",
            labelKey: "match.shots_on_target",
            homePath: ["stats", "shotsOnTarget", "home"],
            awayPath: ["stats", "shotsOnTarget", "away"],
          },
        ],
      },
    ],
  },
  {
    id: "market",
    labelKey: "match.market_data",
    descriptionKey: "match.market_desc",
    icon: "trending",
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: (ctx) =>
      !!ctx.match.capabilities?.hasOdds || hasNonEmptyObject(ctx.match.odds),
    applyToData: (data, ctx) => {
      const { match } = ctx;
      if (!hasNonEmptyObject(data.odds)) {
        data.odds = match.odds || {
          had: { h: 0, d: 0, a: 0 },
          hhad: { h: 0, d: 0, a: 0, goalline: 0 },
        };
      }
    },
    removeFromData: (data) => {
      delete data.odds;
    },
    formSections: [
      {
        id: "market_odds",
        titleKey: "match.market_odds",
        fields: [
          {
            id: "had",
            type: "odds_triplet",
            labelKey: "match.had",
            homePath: ["odds", "had", "h"],
            drawPath: ["odds", "had", "d"],
            awayPath: ["odds", "had", "a"],
            homePlaceholderKey: "match.home_win",
            drawPlaceholderKey: "match.draw",
            awayPlaceholderKey: "match.away_win",
          },
          {
            id: "handicap",
            type: "number",
            path: ["odds", "hhad", "goalline"],
            labelKey: "match.handicap",
          },
          {
            id: "hhad",
            type: "odds_triplet",
            labelKey: "match.hhad",
            homePath: ["odds", "hhad", "h"],
            drawPath: ["odds", "hhad", "d"],
            awayPath: ["odds", "hhad", "a"],
            homePlaceholderKey: "match.home_win",
            drawPlaceholderKey: "match.draw",
            awayPlaceholderKey: "match.away_win",
          },
        ],
      },
    ],
  },
  {
    id: "custom",
    labelKey: "match.custom_data",
    descriptionKey: "match.custom_desc",
    icon: "file",
    cardSpan: 2,
    isAvailable: () => true,
    defaultSelected: (ctx) =>
      !!ctx.match.capabilities?.hasCustom ||
      hasCustomInfo((ctx.match as any).customInfo) ||
      hasCustomInfo(ctx.importedData?.customInfo),
    applyToData: (data, ctx) => {
      if (data.customInfo === undefined) {
        data.customInfo = (ctx.match as any).customInfo || ctx.importedData?.customInfo || "";
      }
    },
    removeFromData: (data) => {
      delete data.customInfo;
    },
    formSections: [
      {
        id: "custom_data",
        titleKey: "match.custom_data",
        fields: [
          {
            id: "custom_info",
            type: "textarea",
            path: ["customInfo"],
            placeholderKey: "match.custom_placeholder",
            rows: 4,
          },
        ],
      },
    ],
  },
];

export function resolveSourceSelection(
  match: Match,
  importedData: any,
  previousSelection?: Partial<SourceSelection>,
): SourceSelection {
  const ctx: SourceContext = { match, importedData };
  const defaults = ANALYSIS_DATA_SOURCES.reduce((acc, source) => {
    if (!source.isAvailable(ctx)) {
      acc[source.id] = false;
      return acc;
    }
    const prev = previousSelection?.[source.id];
    acc[source.id] = typeof prev === "boolean" ? prev : source.defaultSelected(ctx);
    return acc;
  }, {} as SourceSelection);
  return defaults;
}

export function buildSourceCapabilities(data: any, selectedSources: SourceSelection) {
  const hasStats = hasNonEmptyObject(data?.stats);
  const hasOdds = hasNonEmptyObject(data?.odds);
  const hasCustom = hasCustomInfo(data?.customInfo);
  const hasFundamental =
    !!selectedSources.fundamental &&
    (!!data?.homeTeam || !!data?.awayTeam || typeof data?.league === "string");

  return {
    hasFundamental,
    hasStats,
    hasOdds,
    hasCustom,
  };
}

