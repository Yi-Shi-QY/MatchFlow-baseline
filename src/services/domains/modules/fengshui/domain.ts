import type { Match } from "@/src/data/matches";
import type { DataSourceDefinition, SourceSelection } from "@/src/services/dataSources";
import type { AnalysisDomain, AnalysisDomainContext } from "../../types";

type FengshuiSiteProfile = {
  subjectName: string;
  referenceFrame: string;
  propertyType: string;
  facingDirection: string;
  constructionPeriod: string;
};

type FengshuiQiFlow = {
  qiFlowScore: number;
  brightHallScore: number;
  shaPressure: number;
  circulationScore: number;
  entryStability: number;
};

type FengshuiTemporalCycle = {
  cycleStage: string;
  yearlyInfluence: number;
  monthlyInfluence: number;
  favorableWindow: string;
  cautionWindow: string;
};

type FengshuiOccupantIntent = {
  intentSummary: string;
  priorities: string[];
  constraints: string[];
};

const FENGSHUI_DOMAIN_META = {
  id: "fengshui",
};

function hasNonEmptyObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter((item) => item.length > 0);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }
  return [];
}

function readExtendedField(ctx: AnalysisDomainContext, key: string): any {
  const imported =
    ctx.importedData && typeof ctx.importedData === "object"
      ? (ctx.importedData as Record<string, any>)[key]
      : undefined;
  if (imported !== undefined) return imported;

  const matchRecord = ctx.match as Match & Record<string, any>;
  return matchRecord[key];
}

function buildDefaultSiteProfile(match: Match): FengshuiSiteProfile {
  return {
    subjectName: toString(match.homeTeam?.name, "Subject"),
    referenceFrame: toString(match.awayTeam?.name, "Reference"),
    propertyType: "Residential",
    facingDirection: "South",
    constructionPeriod: "Period 9",
  };
}

function buildDefaultQiFlow(match: Match): FengshuiQiFlow {
  const stats = match.stats;
  return {
    qiFlowScore: Math.max(0, Math.min(100, Math.round(toNumber(stats?.possession?.home, 62)))),
    brightHallScore: Math.max(0, Math.min(100, Math.round(toNumber(stats?.shotsOnTarget?.home, 58)))),
    shaPressure: Math.max(0, Math.min(100, Math.round(toNumber(stats?.shots?.away, 36)))),
    circulationScore: Math.max(0, Math.min(100, Math.round(toNumber(stats?.shots?.home, 64)))),
    entryStability: Math.max(0, Math.min(100, Math.round(toNumber(stats?.possession?.away, 54)))),
  };
}

function buildDefaultTemporalCycle(match: Match): FengshuiTemporalCycle {
  const odds = match.odds?.had;
  const yearlyBase = odds ? (toNumber(odds.h, 2.0) - toNumber(odds.a, 2.8)) * 4 : 1.5;
  const monthlyBase = odds ? (toNumber(odds.d, 3.0) - 3) * 5 : 0.8;
  return {
    cycleStage: match.status === "live" ? "Transition Window" : "Stabilization Window",
    yearlyInfluence: Number(Math.max(-10, Math.min(10, yearlyBase)).toFixed(1)),
    monthlyInfluence: Number(Math.max(-10, Math.min(10, monthlyBase)).toFixed(1)),
    favorableWindow: "Bright cycle days",
    cautionWindow: "Conflict cycle days",
  };
}

function buildDefaultOccupantIntent(match: Match): FengshuiOccupantIntent {
  const customInfo = (match as Match & Record<string, any>).customInfo;
  const fallbackSummary = `Align layout decisions with ${match.homeTeam.name} goals while monitoring ${match.awayTeam.name} constraints.`;
  return {
    intentSummary: hasNonEmptyString(customInfo) ? customInfo : fallbackSummary,
    priorities: ["Health", "Wealth", "Harmony"],
    constraints: ["Budget", "Timeline", "Structural limits"],
  };
}

const FENGSHUI_DATA_SOURCES: DataSourceDefinition[] = [
  {
    id: "site_profile",
    labelKey: "fengshui.sources.site_profile.label",
    descriptionKey: "fengshui.sources.site_profile.description",
    icon: "layout",
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: () => true,
    applyToData: (data, ctx) => {
      const external = readExtendedField(ctx, "siteProfile");
      const fallback = buildDefaultSiteProfile(ctx.match);
      data.siteProfile = hasNonEmptyObject(external) ? { ...fallback, ...external } : fallback;
    },
    removeFromData: (data) => {
      delete data.siteProfile;
    },
    formSections: [
      {
        id: "fengshui_site_profile",
        titleKey: "fengshui.sections.site_profile",
        columns: 2,
        fields: [
          {
            id: "subject_name",
            type: "text",
            path: ["siteProfile", "subjectName"],
            labelKey: "fengshui.fields.subject_name",
            placeholderKey: "fengshui.placeholders.subject_name",
          },
          {
            id: "reference_frame",
            type: "text",
            path: ["siteProfile", "referenceFrame"],
            labelKey: "fengshui.fields.reference_frame",
            placeholderKey: "fengshui.placeholders.reference_frame",
          },
          {
            id: "property_type",
            type: "text",
            path: ["siteProfile", "propertyType"],
            labelKey: "fengshui.fields.property_type",
            placeholderKey: "fengshui.placeholders.property_type",
          },
          {
            id: "facing_direction",
            type: "text",
            path: ["siteProfile", "facingDirection"],
            labelKey: "fengshui.fields.facing_direction",
            placeholderKey: "fengshui.placeholders.facing_direction",
          },
          {
            id: "construction_period",
            type: "text",
            path: ["siteProfile", "constructionPeriod"],
            labelKey: "fengshui.fields.construction_period",
            placeholderKey: "fengshui.placeholders.construction_period",
          },
        ],
      },
    ],
  },
  {
    id: "qi_flow",
    labelKey: "fengshui.sources.qi_flow.label",
    descriptionKey: "fengshui.sources.qi_flow.description",
    icon: "trending",
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: () => true,
    applyToData: (data, ctx) => {
      const external = readExtendedField(ctx, "qiFlow");
      const fallback = buildDefaultQiFlow(ctx.match);
      data.qiFlow = hasNonEmptyObject(external) ? { ...fallback, ...external } : fallback;
    },
    removeFromData: (data) => {
      delete data.qiFlow;
    },
    formSections: [
      {
        id: "fengshui_qi_flow",
        titleKey: "fengshui.sections.qi_flow",
        columns: 2,
        fields: [
          {
            id: "qi_flow_score",
            type: "number",
            path: ["qiFlow", "qiFlowScore"],
            labelKey: "fengshui.fields.qi_flow_score",
          },
          {
            id: "bright_hall_score",
            type: "number",
            path: ["qiFlow", "brightHallScore"],
            labelKey: "fengshui.fields.bright_hall_score",
          },
          {
            id: "sha_pressure",
            type: "number",
            path: ["qiFlow", "shaPressure"],
            labelKey: "fengshui.fields.sha_pressure",
          },
          {
            id: "circulation_score",
            type: "number",
            path: ["qiFlow", "circulationScore"],
            labelKey: "fengshui.fields.circulation_score",
          },
          {
            id: "entry_stability",
            type: "number",
            path: ["qiFlow", "entryStability"],
            labelKey: "fengshui.fields.entry_stability",
          },
        ],
      },
    ],
  },
  {
    id: "temporal_cycle",
    labelKey: "fengshui.sources.temporal_cycle.label",
    descriptionKey: "fengshui.sources.temporal_cycle.description",
    icon: "layout",
    cardSpan: 1,
    isAvailable: () => true,
    defaultSelected: () => true,
    applyToData: (data, ctx) => {
      const external = readExtendedField(ctx, "temporalCycle");
      const fallback = buildDefaultTemporalCycle(ctx.match);
      data.temporalCycle = hasNonEmptyObject(external) ? { ...fallback, ...external } : fallback;
    },
    removeFromData: (data) => {
      delete data.temporalCycle;
    },
    formSections: [
      {
        id: "fengshui_temporal_cycle",
        titleKey: "fengshui.sections.temporal_cycle",
        fields: [
          {
            id: "cycle_stage",
            type: "text",
            path: ["temporalCycle", "cycleStage"],
            labelKey: "fengshui.fields.cycle_stage",
            placeholderKey: "fengshui.placeholders.cycle_stage",
          },
          {
            id: "yearly_influence",
            type: "number",
            path: ["temporalCycle", "yearlyInfluence"],
            labelKey: "fengshui.fields.yearly_influence",
          },
          {
            id: "monthly_influence",
            type: "number",
            path: ["temporalCycle", "monthlyInfluence"],
            labelKey: "fengshui.fields.monthly_influence",
          },
          {
            id: "favorable_window",
            type: "text",
            path: ["temporalCycle", "favorableWindow"],
            labelKey: "fengshui.fields.favorable_window",
            placeholderKey: "fengshui.placeholders.favorable_window",
          },
          {
            id: "caution_window",
            type: "text",
            path: ["temporalCycle", "cautionWindow"],
            labelKey: "fengshui.fields.caution_window",
            placeholderKey: "fengshui.placeholders.caution_window",
          },
        ],
      },
    ],
  },
  {
    id: "occupant_intent",
    labelKey: "fengshui.sources.occupant_intent.label",
    descriptionKey: "fengshui.sources.occupant_intent.description",
    icon: "file",
    cardSpan: 2,
    isAvailable: () => true,
    defaultSelected: (ctx) => {
      const intent = readExtendedField(ctx, "occupantIntent");
      if (hasNonEmptyObject(intent)) return true;
      return hasNonEmptyString((ctx.match as Match & Record<string, any>).customInfo);
    },
    applyToData: (data, ctx) => {
      const external = readExtendedField(ctx, "occupantIntent");
      const fallback = buildDefaultOccupantIntent(ctx.match);
      const merged = hasNonEmptyObject(external) ? { ...fallback, ...external } : fallback;
      merged.priorities = toStringArray(merged.priorities);
      merged.constraints = toStringArray(merged.constraints);
      data.occupantIntent = merged;
      if (!hasNonEmptyString(data.customInfo)) {
        data.customInfo = merged.intentSummary;
      }
    },
    removeFromData: (data) => {
      delete data.occupantIntent;
      delete data.customInfo;
    },
    formSections: [
      {
        id: "fengshui_occupant_intent",
        titleKey: "fengshui.sections.occupant_intent",
        fields: [
          {
            id: "intent_summary",
            type: "textarea",
            path: ["occupantIntent", "intentSummary"],
            labelKey: "fengshui.fields.intent_summary",
            placeholderKey: "fengshui.placeholders.intent_summary",
            rows: 4,
          },
          {
            id: "priorities",
            type: "csv_array",
            path: ["occupantIntent", "priorities"],
            labelKey: "fengshui.fields.priorities",
            placeholderKey: "fengshui.placeholders.priorities",
          },
          {
            id: "constraints",
            type: "csv_array",
            path: ["occupantIntent", "constraints"],
            labelKey: "fengshui.fields.constraints",
            placeholderKey: "fengshui.placeholders.constraints",
          },
        ],
      },
    ],
  },
];

export function resolveFengshuiSourceSelection(
  match: Match,
  importedData?: any,
  previousSelection?: Partial<SourceSelection>,
): SourceSelection {
  const context: AnalysisDomainContext = { match, importedData };
  return FENGSHUI_DATA_SOURCES.reduce((acc, source) => {
    if (!source.isAvailable(context)) {
      acc[source.id] = false;
      return acc;
    }
    const previous = previousSelection?.[source.id];
    acc[source.id] = typeof previous === "boolean" ? previous : source.defaultSelected(context);
    return acc;
  }, {} as SourceSelection);
}

export function buildFengshuiSourceCapabilities(data: any, selectedSources: SourceSelection) {
  const hasSiteProfile = !!selectedSources.site_profile && hasNonEmptyObject(data?.siteProfile);
  const hasQiFlow = !!selectedSources.qi_flow && hasNonEmptyObject(data?.qiFlow);
  const hasTemporalCycle = !!selectedSources.temporal_cycle && hasNonEmptyObject(data?.temporalCycle);
  const hasOccupantIntent =
    !!selectedSources.occupant_intent && hasNonEmptyObject(data?.occupantIntent);

  return {
    hasSiteProfile,
    hasQiFlow,
    hasTemporalCycle,
    hasOccupantIntent,
    // Legacy capability aliases for shared orchestration compatibility.
    hasFundamental: hasSiteProfile,
    hasStats: hasQiFlow,
    hasOdds: hasTemporalCycle,
    hasCustom: hasOccupantIntent || hasNonEmptyString(data?.customInfo),
  };
}

export const fengshuiDomain: AnalysisDomain = {
  id: FENGSHUI_DOMAIN_META.id,
  name: "Feng Shui Analysis",
  description: "Built-in Feng Shui analysis domain for site, qi, timing, and intent decisions.",
  resources: {
    templates: ["fengshui_basic", "fengshui_standard", "fengshui_focused", "fengshui_comprehensive"],
    animations: [
      "fengshui-qi-radar",
      "fengshui-compass-grid",
      "fengshui-cycle-board",
      "stats-comparison",
      "tactical-board",
      "odds-card",
    ],
    agents: [
      "fengshui_overview",
      "fengshui_analysis",
      "fengshui_prediction",
      "fengshui_general",
      "fengshui_planner_template",
      "fengshui_planner_autonomous",
      "tag",
      "summary",
      "animation",
    ],
    skills: ["calculator", "select_plan_template"],
  },
  dataSources: FENGSHUI_DATA_SOURCES,
  getAvailableDataSources: (context) =>
    FENGSHUI_DATA_SOURCES.filter((source) => source.isAvailable(context)),
  resolveSourceSelection: (match, importedData, previousSelection) =>
    resolveFengshuiSourceSelection(match, importedData, previousSelection),
  buildSourceCapabilities: buildFengshuiSourceCapabilities,
};
