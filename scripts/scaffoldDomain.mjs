import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

function hasFlag(name) {
  const target = `--${name}`;
  return process.argv.slice(2).some((arg) => arg === target || arg.startsWith(`${target}=`));
}

function getArg(name) {
  const target = `--${name}`;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const current = args[i];
    if (current === target) return args[i + 1] || null;
    if (current.startsWith(`${target}=`)) return current.slice(target.length + 1);
  }
  return null;
}

function toPascal(value) {
  return String(value || "")
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function toCamel(value) {
  const pascal = toPascal(value);
  return pascal ? pascal.charAt(0).toLowerCase() + pascal.slice(1) : "";
}

function toTitle(value) {
  return String(value || "")
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toConstant(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function ensureId(id) {
  if (!id) {
    throw new Error("Missing --id. Example: npm run domain:scaffold -- --id credit_risk");
  }
  if (!/^[a-z][a-z0-9_]*$/.test(id)) {
    throw new Error(`Invalid --id "${id}". Use lowercase snake_case.`);
  }
}

function write(relPath, content, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] write ${relPath}`);
    return;
  }
  const abs = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf8");
  console.log(`write ${relPath}`);
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeIfMissing(target, patch) {
  Object.entries(patch).forEach(([key, value]) => {
    if (isPlainObject(value)) {
      if (!isPlainObject(target[key])) {
        target[key] = {};
      }
      mergeIfMissing(target[key], value);
      return;
    }
    if (target[key] === undefined) {
      target[key] = value;
    }
  });
}

function buildLocalePatch(config, language) {
  const { id, name } = config;
  if (language === "zh") {
    return {
      [id]: {
        home: {
          section_title: `${name} \u6807\u7684\u6c60`,
          section_hint: "\u5728\u4ea4\u6613\u4e0e\u5f85\u5904\u7406",
          refresh_action: "\u5237\u65b0\u6807\u7684",
          open_action: "\u67e5\u770b\u5206\u6790",
          no_data: "\u6682\u65e0\u53ef\u7528\u6570\u636e",
          search_placeholder:
            "\u641c\u7d22\u4e3b\u4f53\u3001\u53c2\u8003\u9879\u6216\u5206\u7c7b...",
        },
        status: {
          live: "\u8fdb\u884c\u4e2d",
          finished: "\u5df2\u7ed3\u675f",
          upcoming: "\u5f85\u5904\u7406",
        },
      },
      domains: {
        [id]: {
          name,
        },
      },
    };
  }

  return {
    [id]: {
      home: {
        section_title: `${name} Watchlist`,
        section_hint: "In Progress & Scheduled",
        refresh_action: "Refresh Subjects",
        open_action: "Open Analysis",
        no_data: "No data available",
        search_placeholder: "Search subjects, references, or categories...",
      },
      status: {
        live: "In Progress",
        finished: "Completed",
        upcoming: "Scheduled",
      },
    },
    domains: {
      [id]: {
        name,
      },
    },
  };
}

function upsertLocaleFile(relPath, patch, dryRun) {
  const abs = path.join(ROOT, relPath);
  const parsed = fs.existsSync(abs)
    ? JSON.parse(fs.readFileSync(abs, "utf8").replace(/^\uFEFF/, ""))
    : {};
  mergeIfMissing(parsed, patch);

  if (dryRun) {
    console.log(`[dry-run] upsert ${relPath}`);
    return;
  }

  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  console.log(`upsert ${relPath}`);
}

function updateLocaleFiles(config, dryRun) {
  const perLanguagePatches = [
    { language: "en", patch: buildLocalePatch(config, "en") },
    { language: "zh", patch: buildLocalePatch(config, "zh") },
  ];

  perLanguagePatches.forEach(({ language, patch }) => {
    Object.entries(patch).forEach(([moduleKey, modulePatch]) => {
      if (moduleKey === "domains") {
        upsertLocaleFile(
          `src/i18n/locales/${language}/domains/${config.id}.json`,
          { domains: { [config.id]: modulePatch[config.id] } },
          dryRun,
        );
        return;
      }

      if (moduleKey === config.id) {
        upsertLocaleFile(
          `src/i18n/locales/${language}/domainProfiles/${config.id}.json`,
          { [config.id]: modulePatch },
          dryRun,
        );
        return;
      }

      upsertLocaleFile(`src/i18n/locales/${language}/${moduleKey}.json`, { [moduleKey]: modulePatch }, dryRun);
    });
  });
}

function simpleRoleAgent(id, varName, roleEn, roleZh, deps) {
  return `import { AgentConfig } from "../../types";
import { buildAnalysisPrompt } from "../../utils";

const rolePrompts = {
  en: "${roleEn}",
  zh: "${roleZh}",
};

export const ${varName}: AgentConfig = {
  id: "${id}",
  name: "${roleEn}",
  description: "${roleEn}",
  skills: [],
  contextDependencies: "${deps}",
  systemPrompt: (context) => {
    const role = context.language === "zh" ? rolePrompts.zh : rolePrompts.en;
    return buildAnalysisPrompt(role, context);
  },
};
`;
}

function buildTemplateFile(varName, templateId, name, description, rule, segments, requiredAgents) {
  const segmentText = segments
    .map((seg) => `    {
      title: isZh ? "${seg.titleZh}" : "${seg.titleEn}",
      focus: isZh ? "${seg.focusZh}" : "${seg.focusEn}",
      animationType: "${seg.animationType}",
      agentType: "${seg.agentType}",
      contextMode: "${seg.contextMode}",
    },`)
    .join("\n");

  return `import { PlanTemplate } from "../../planner/types";

export const ${varName}: PlanTemplate = {
  id: "${templateId}",
  version: "1.0.0",
  name: "${name}",
  description: "${description}",
  rule: "${rule}",
  requiredAgents: [${requiredAgents.map((id) => `"${id}"`).join(", ")}],
  requiredSkills: [],
  getSegments: (isZh: boolean) => [
${segmentText}
  ],
};
`;
}

function buildFiles(config) {
  const {
    id,
    name,
    pascal,
    camel,
    presenterConst,
    templateIds,
    agentIds,
    animationTypes,
    animationTemplateIds,
  } = config;

  const domainVar = `${camel}Domain`;
  const planningVar = `${camel}PlanningStrategy`;
  const localCasesFn = `build${pascal}LocalCases`;
  const createModuleFn = `create${pascal}BuiltinModule`;

  const templateVars = {
    basic: `${camel}BasicTemplate`,
    standard: `${camel}StandardTemplate`,
    focused: `${camel}FocusedTemplate`,
    comprehensive: `${camel}ComprehensiveTemplate`,
  };

  const files = {};

  files[`src/services/domains/modules/${id}/domain.ts`] = `import {
  ANALYSIS_DATA_SOURCES,
  buildSourceCapabilities,
  resolveSourceSelection,
} from "@/src/services/dataSources";
import type { AnalysisDomain } from "../../types";

export const ${domainVar}: AnalysisDomain = {
  id: "${id}",
  name: "${name}",
  description: "Built-in ${name} analysis experience.",
  resources: {
    templates: ["${templateIds.basic}", "${templateIds.standard}", "${templateIds.focused}", "${templateIds.comprehensive}"],
    animations: ["${animationTemplateIds.snapshot}", "${animationTemplateIds.trend}", "${animationTemplateIds.risk}"],
    agents: [
      "${agentIds.overview}",
      "${agentIds.analysis}",
      "${agentIds.prediction}",
      "${agentIds.general}",
      "${agentIds.plannerTemplate}",
      "${agentIds.plannerAutonomous}",
      "tag",
      "summary",
      "animation",
    ],
    skills: ["calculator", "select_plan_template"],
  },
  dataSources: ANALYSIS_DATA_SOURCES,
  getAvailableDataSources: (context) =>
    ANALYSIS_DATA_SOURCES.filter((source) => source.isAvailable(context)),
  resolveSourceSelection: (match, importedData, previousSelection) =>
    resolveSourceSelection(match, importedData, previousSelection),
  buildSourceCapabilities,
};
`;

  files[`src/services/domains/modules/${id}/planning.ts`] = `import type { DomainPlanningStrategy } from "../../planning/types";

export type TemplateType =
  | "${templateIds.basic}"
  | "${templateIds.standard}"
  | "${templateIds.focused}"
  | "${templateIds.comprehensive}";

function hasNonEmptyObject(value: any): boolean {
  return !!value && typeof value === "object" && Object.keys(value).length > 0;
}

function buildFallbackPlan(language: "en" | "zh") {
  if (language === "zh") {
    return [
      {
        title: "\\u9886\\u57df\\u6982\\u89c8",
        focus: "\\u57fa\\u7840\\u80cc\\u666f\\u548c\\u5173\\u952e\\u4e0a\\u4e0b\\u6587",
        animationType: "none",
        agentType: "${agentIds.overview}",
        contextMode: "independent",
      },
      {
        title: "\\u6700\\u7ec8\\u7ed3\\u8bba",
        focus: "\\u7ed3\\u8bba\\u548c\\u6267\\u884c\\u5efa\\u8bae",
        animationType: "none",
        agentType: "${agentIds.prediction}",
        contextMode: "all",
      },
    ];
  }
  return [
    {
      title: "Domain Overview",
      focus: "Background and key context",
      animationType: "none",
      agentType: "${agentIds.overview}",
      contextMode: "independent",
    },
    {
      title: "Final Recommendation",
      focus: "Conclusion and action guidance",
      animationType: "none",
      agentType: "${agentIds.prediction}",
      contextMode: "all",
    },
  ];
}

export const ${planningVar}: DomainPlanningStrategy = {
  domainId: "${id}",
  getPlannerAgentId: (mode) =>
    mode === "autonomous" ? "${agentIds.plannerAutonomous}" : "${agentIds.plannerTemplate}",
  resolveRoute: (analysisData: any) => {
    const capabilities = analysisData?.sourceContext?.capabilities || {};
    const hasCustom = Boolean(analysisData?.customInfo) || Boolean(analysisData?.sourceContext?.selectedSources?.custom);
    const hasStats = Boolean(capabilities?.hasStats) || hasNonEmptyObject(analysisData?.stats);
    const hasMarket = Boolean(capabilities?.hasOdds) || hasNonEmptyObject(analysisData?.odds);

    if (hasCustom && !hasStats && !hasMarket) {
      return {
        mode: "autonomous",
        allowedAgentTypes: null,
        reason: "custom-only input",
      };
    }
    if (hasStats && hasMarket) {
      return {
        mode: "template",
        templateType: "${templateIds.comprehensive}",
        allowedAgentTypes: null,
        reason: "full signal set",
      };
    }
    if (hasMarket) {
      return {
        mode: "template",
        templateType: "${templateIds.focused}",
        allowedAgentTypes: ["${agentIds.overview}", "${agentIds.analysis}", "${agentIds.prediction}", "${agentIds.general}"],
        reason: "market-oriented signal set",
      };
    }
    if (hasStats) {
      return {
        mode: "template",
        templateType: "${templateIds.standard}",
        allowedAgentTypes: null,
        reason: "standard signal set",
      };
    }
    return {
      mode: "template",
      templateType: "${templateIds.basic}",
      allowedAgentTypes: ["${agentIds.overview}", "${agentIds.prediction}", "${agentIds.general}"],
      reason: "minimal signal set",
    };
  },
  buildFallbackPlan,
  requiredTerminalAgentType: "${agentIds.prediction}",
  buildRequiredTerminalSegment: (language: "en" | "zh") =>
    language === "zh"
      ? {
          title: "\\u6700\\u7ec8\\u7ed3\\u8bba",
          focus: "\\u7ed3\\u8bba\\u548c\\u6267\\u884c\\u5efa\\u8bae",
          animationType: "none",
          agentType: "${agentIds.prediction}",
          contextMode: "all",
        }
      : {
          title: "Final Recommendation",
          focus: "Conclusion and action guidance",
          animationType: "none",
          agentType: "${agentIds.prediction}",
          contextMode: "all",
        },
};
`;

  files[`src/services/domains/modules/${id}/localCases.ts`] = `import { MOCK_MATCHES, type Match } from "@/src/data/matches";
import { cloneMatch } from "../shared/cloneMatch";

function buildCase(base: Match, index: number): Match {
  const cloned = cloneMatch(base);
  const caseNumber = index + 1;

  return {
    ...cloned,
    id: "${id}_case_" + caseNumber,
    league: "${name} Monitor",
    homeTeam: {
      ...cloned.homeTeam,
      id: "${id}_subject_" + caseNumber,
      name: "${name} Subject " + caseNumber,
      logo: "",
      form: [],
    },
    awayTeam: {
      ...cloned.awayTeam,
      id: "${id}_reference_" + caseNumber,
      name: "${name} Reference " + caseNumber,
      logo: "",
      form: [],
    },
    capabilities: {
      hasStats: true,
      hasOdds: true,
      hasCustom: true,
    },
    customInfo:
      "Baseline narrative for " +
      "${name}" +
      " case " +
      caseNumber +
      ". Replace with domain-native context.",
  } as Match;
}

export function ${localCasesFn}(caseMinimum: number): Match[] {
  const normalizedCount = Math.max(3, Math.floor(caseMinimum));
  return Array.from({ length: normalizedCount }, (_, index) => {
    const base = MOCK_MATCHES[index % Math.max(1, MOCK_MATCHES.length)];
    return buildCase(base, index);
  });
}
`;

  files[`src/services/domains/modules/${id}/module.ts`] = `import type { BuiltinDomainModule } from "../types";
import { ${domainVar} } from "./domain";
import { ${localCasesFn} } from "./localCases";
import { ${planningVar} } from "./planning";

export function ${createModuleFn}(caseMinimum: number): BuiltinDomainModule {
  return {
    domain: ${domainVar},
    planningStrategy: ${planningVar},
    localTestCases: ${localCasesFn}(caseMinimum),
  };
}

export const DOMAIN_MODULE_FACTORIES = [${createModuleFn}];
`;

  files[`src/services/domains/modules/${id}/index.ts`] = `export { ${domainVar} } from "./domain";
export { ${createModuleFn} } from "./module";
export { ${planningVar} } from "./planning";
`;

  files[`src/agents/domains/${id}/overview.ts`] = simpleRoleAgent(
    agentIds.overview,
    `${camel}OverviewAgent`,
    `${name} overview analyst`,
    `${name} 概览分析师`,
    "none",
  );
  files[`src/agents/domains/${id}/analysis.ts`] = simpleRoleAgent(
    agentIds.analysis,
    `${camel}AnalysisAgent`,
    `${name} signal analyst`,
    `${name} 信号分析师`,
    "all",
  );
  files[`src/agents/domains/${id}/prediction.ts`] = simpleRoleAgent(
    agentIds.prediction,
    `${camel}PredictionAgent`,
    `${name} decision analyst`,
    `${name} 决策分析师`,
    "all",
  );
  files[`src/agents/domains/${id}/general.ts`] = simpleRoleAgent(
    agentIds.general,
    `${camel}GeneralAgent`,
    `${name} general analyst`,
    `${name} 通用分析师`,
    "all",
  );

  files[`src/agents/domains/${id}/planner_template.ts`] = `import { AgentConfig } from "../../types";

const TEMPLATE_IDS = ["${templateIds.basic}", "${templateIds.standard}", "${templateIds.focused}", "${templateIds.comprehensive}"];

export const ${camel}PlannerTemplateAgent: AgentConfig = {
  id: "${agentIds.plannerTemplate}",
  name: "${name} template planner",
  description: "Selects the best ${name} plan template.",
  skills: ["select_plan_template"],
  systemPrompt: ({ matchData, language, includeAnimations }) => {
    const lines = [
      "You are the template planner for ${name}.",
      language === "zh" ? "如果需要自然语言，请使用中文；仅输出工具调用。" : "Return only the tool call.",
      "Template candidates: " + TEMPLATE_IDS.join(", "),
      "Language: " + (language === "zh" ? "zh" : "en"),
      "Include Animations: " + (includeAnimations ? "Yes" : "No"),
      "Analysis Data: " + JSON.stringify(matchData),
    ];
    return lines.join("\\n");
  },
};
`;

  files[`src/agents/domains/${id}/planner_autonomous.ts`] = `import { AgentConfig } from "../../types";

const ALLOWED_AGENTS = ["${agentIds.overview}", "${agentIds.analysis}", "${agentIds.prediction}", "${agentIds.general}"];
const ALLOWED_ANIMATIONS = ["${animationTypes.snapshot}", "${animationTypes.trend}", "${animationTypes.risk}", "none"];

export const ${camel}PlannerAutonomousAgent: AgentConfig = {
  id: "${agentIds.plannerAutonomous}",
  name: "${name} autonomous planner",
  description: "Builds custom ${name} plan segments.",
  skills: [],
  systemPrompt: ({ matchData, language }) => {
    const lines = [
      "You are the autonomous planner for ${name}.",
      language === "zh" ? "只输出 JSON 数组，不要输出解释。" : "Output JSON array only.",
      "Each segment needs: title, focus, animationType, agentType, contextMode.",
      "contextMode must be one of: build_upon, independent, compare, all.",
      "Allowed agentType: " + ALLOWED_AGENTS.join(", "),
      "Allowed animationType: " + ALLOWED_ANIMATIONS.join(", "),
      "Analysis Data: " + JSON.stringify(matchData),
    ];
    return lines.join("\\n");
  },
};
`;

  files[`src/agents/domains/${id}/index.ts`] = `import type { AgentConfig } from "../../types";
import { ${camel}OverviewAgent } from "./overview";
import { ${camel}AnalysisAgent } from "./analysis";
import { ${camel}PredictionAgent } from "./prediction";
import { ${camel}GeneralAgent } from "./general";
import { ${camel}PlannerTemplateAgent } from "./planner_template";
import { ${camel}PlannerAutonomousAgent } from "./planner_autonomous";

export { ${camel}OverviewAgent } from "./overview";
export { ${camel}AnalysisAgent } from "./analysis";
export { ${camel}PredictionAgent } from "./prediction";
export { ${camel}GeneralAgent } from "./general";
export { ${camel}PlannerTemplateAgent } from "./planner_template";
export { ${camel}PlannerAutonomousAgent } from "./planner_autonomous";

export const DOMAIN_AGENT_ENTRIES: Record<string, AgentConfig> = {
  ${agentIds.overview}: ${camel}OverviewAgent,
  ${agentIds.analysis}: ${camel}AnalysisAgent,
  ${agentIds.prediction}: ${camel}PredictionAgent,
  ${agentIds.general}: ${camel}GeneralAgent,
  ${agentIds.plannerTemplate}: ${camel}PlannerTemplateAgent,
  ${agentIds.plannerAutonomous}: ${camel}PlannerAutonomousAgent,
};

export const DOMAIN_AGENT_VERSION_ENTRIES: Record<string, string> = {
  ${agentIds.overview}: "1.0.0",
  ${agentIds.analysis}: "1.0.0",
  ${agentIds.prediction}: "1.0.0",
  ${agentIds.general}: "1.0.0",
  ${agentIds.plannerTemplate}: "1.0.0",
  ${agentIds.plannerAutonomous}: "1.0.0",
};
`;

  files[`src/skills/domains/${id}/planner/basic.ts`] = buildTemplateFile(
    templateVars.basic,
    templateIds.basic,
    `${name} Basic Template`,
    "Minimal flow with overview and final recommendation.",
    "Use when data is limited or user wants a quick output.",
    [
      {
        titleZh: "领域概览",
        titleEn: "Domain Overview",
        focusZh: "背景和关键信号",
        focusEn: "Background and key signals",
        animationType: "none",
        agentType: agentIds.overview,
        contextMode: "independent",
      },
      {
        titleZh: "最终结论",
        titleEn: "Final Recommendation",
        focusZh: "结论和执行建议",
        focusEn: "Conclusion and action guidance",
        animationType: "none",
        agentType: agentIds.prediction,
        contextMode: "all",
      },
    ],
    [agentIds.overview, agentIds.prediction],
  );

  files[`src/skills/domains/${id}/planner/standard.ts`] = buildTemplateFile(
    templateVars.standard,
    templateIds.standard,
    `${name} Standard Template`,
    "Balanced flow for common scenarios.",
    "Use as default for medium completeness inputs.",
    [
      {
        titleZh: "领域概览",
        titleEn: "Domain Overview",
        focusZh: "背景和关键信号",
        focusEn: "Background and key signals",
        animationType: "none",
        agentType: agentIds.overview,
        contextMode: "independent",
      },
      {
        titleZh: "核心信号",
        titleEn: "Core Signals",
        focusZh: "关键指标和结构快照",
        focusEn: "Key metrics and structural snapshot",
        animationType: animationTypes.snapshot,
        agentType: agentIds.analysis,
        contextMode: "build_upon",
      },
      {
        titleZh: "最终结论",
        titleEn: "Final Recommendation",
        focusZh: "结论和执行建议",
        focusEn: "Conclusion and action guidance",
        animationType: "none",
        agentType: agentIds.prediction,
        contextMode: "all",
      },
    ],
    [agentIds.overview, agentIds.analysis, agentIds.prediction],
  );

  files[`src/skills/domains/${id}/planner/focused.ts`] = buildTemplateFile(
    templateVars.focused,
    templateIds.focused,
    `${name} Focused Template`,
    "Focused flow for high-risk or event-heavy inputs.",
    "Use when input is risk-dominant.",
    [
      {
        titleZh: "风险结构",
        titleEn: "Risk Structure",
        focusZh: "风险来源与影响范围",
        focusEn: "Risk sources and impact range",
        animationType: animationTypes.risk,
        agentType: agentIds.analysis,
        contextMode: "independent",
      },
      {
        titleZh: "行动建议",
        titleEn: "Action Plan",
        focusZh: "执行优先级和策略",
        focusEn: "Execution priorities and strategy",
        animationType: "none",
        agentType: agentIds.prediction,
        contextMode: "all",
      },
    ],
    [agentIds.analysis, agentIds.prediction],
  );

  files[`src/skills/domains/${id}/planner/comprehensive.ts`] = buildTemplateFile(
    templateVars.comprehensive,
    templateIds.comprehensive,
    `${name} Comprehensive Template`,
    "Deep flow with overview, structure, trend, and final recommendation.",
    "Use when full sources are available.",
    [
      {
        titleZh: "领域概览",
        titleEn: "Domain Overview",
        focusZh: "背景和关键信号",
        focusEn: "Background and key signals",
        animationType: "none",
        agentType: agentIds.overview,
        contextMode: "independent",
      },
      {
        titleZh: "结构快照",
        titleEn: "Structural Snapshot",
        focusZh: "当前核心结构",
        focusEn: "Current core structure",
        animationType: animationTypes.snapshot,
        agentType: agentIds.analysis,
        contextMode: "build_upon",
      },
      {
        titleZh: "趋势研判",
        titleEn: "Trend Diagnosis",
        focusZh: "主要趋势与变化方向",
        focusEn: "Main trends and trajectory",
        animationType: animationTypes.trend,
        agentType: agentIds.analysis,
        contextMode: "build_upon",
      },
      {
        titleZh: "最终结论",
        titleEn: "Final Recommendation",
        focusZh: "结论和执行建议",
        focusEn: "Conclusion and action guidance",
        animationType: "none",
        agentType: agentIds.prediction,
        contextMode: "all",
      },
    ],
    [agentIds.overview, agentIds.analysis, agentIds.prediction],
  );

  files[`src/skills/domains/${id}/planner/index.ts`] = `import { PlanTemplate } from "../../planner/types";
import { ${templateVars.basic} } from "./basic";
import { ${templateVars.standard} } from "./standard";
import { ${templateVars.focused} } from "./focused";
import { ${templateVars.comprehensive} } from "./comprehensive";

export { ${templateVars.basic} } from "./basic";
export { ${templateVars.standard} } from "./standard";
export { ${templateVars.focused} } from "./focused";
export { ${templateVars.comprehensive} } from "./comprehensive";

export const DOMAIN_TEMPLATE_ENTRIES: PlanTemplate[] = [
  ${templateVars.basic},
  ${templateVars.standard},
  ${templateVars.focused},
  ${templateVars.comprehensive},
];
`;

  files[`src/services/domains/ui/presenters/${id}.ts`] = `import type { Match } from "@/src/data/matches";
import {
  getAnalysisOutcomeDistribution,
} from "@/src/services/analysisSummary";
import type {
  DomainHistoryPresenter,
  DomainHomePresenter,
  DomainResultPresenter,
  DomainUiPresenter,
  MatchStatus,
  TranslateFn,
} from "../types";

function toString(input: unknown, fallback: string): string {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : fallback;
}

function toNumber(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input === "string") {
    const parsed = Number(input);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toRecord(value: unknown): Record<string, any> | null {
  return value && typeof value === "object" ? (value as Record<string, any>) : null;
}

function resolveStatusLabel(status: MatchStatus, t: TranslateFn): string {
  if (status === "live") return t("${id}.status.live");
  if (status === "finished") return t("${id}.status.finished");
  return t("${id}.status.upcoming");
}

function resolveOutcomeLabels() {
  return {
    homeLabel: "Positive",
    drawLabel: "Neutral",
    awayLabel: "Cautious",
  };
}

function resolveEntity(match: Match, draftData: any | null) {
  return {
    primaryName: toString(draftData?.homeTeam?.name, match.homeTeam.name),
    secondaryName: toString(draftData?.awayTeam?.name, match.awayTeam.name),
    primaryLogo: toString(draftData?.homeTeam?.logo, match.homeTeam.logo),
    subtitle: toString(draftData?.league, match.league),
  };
}

function resolveReferenceCaption(name: string): string {
  return "Reference: " + name;
}

export const ${camel}HomePresenter: DomainHomePresenter = {
  id: "${id}_home",
  useRemoteFeed: true,
  sectionTitleKey: "${id}.home.section_title",
  sectionHintKey: "${id}.home.section_hint",
  refreshActionKey: "${id}.home.refresh_action",
  openActionKey: "${id}.home.open_action",
  noDataKey: "${id}.home.no_data",
  searchPlaceholderKey: "${id}.home.search_placeholder",
  getEntityDisplay: (match, _ctx, subjectSnapshot) => {
    const snapshot = toRecord(subjectSnapshot);
    const entity = resolveEntity(match, snapshot);
    return {
      kind: "single",
      entity: {
        id: match.homeTeam.id || match.id + "_subject",
        name: entity.primaryName,
        logo: entity.primaryLogo,
      },
      caption: resolveReferenceCaption(entity.secondaryName),
    };
  },
  getSearchTokens: (match, subjectSnapshot) => {
    const snapshot = toRecord(subjectSnapshot);
    const entity = resolveEntity(match, snapshot);
    return [entity.primaryName, entity.secondaryName, entity.subtitle];
  },
  getStatusLabel: (status, ctx) => resolveStatusLabel(status, ctx.t),
  getStatusClassName: (status) => {
    if (status === "live") return "bg-red-500/20 text-red-500 animate-pulse";
    if (status === "finished") return "bg-zinc-800 text-zinc-400";
    return "bg-emerald-500/20 text-emerald-500";
  },
  getOutcomeLabels: () => resolveOutcomeLabels(),
  getCenterDisplay: (match, _ctx, subjectSnapshot) => {
    const snapshot = toRecord(subjectSnapshot);
    const signal =
      toNumber(snapshot?.stats?.possession?.home) ?? toNumber(match.stats?.possession?.home);
    const risk = toNumber(snapshot?.stats?.shots?.away) ?? toNumber(match.stats?.shots?.away);
    const confidence =
      toNumber(snapshot?.stats?.shotsOnTarget?.home) ?? toNumber(match.stats?.shotsOnTarget?.home);

    if (signal != null || risk != null || confidence != null) {
      return {
        kind: "metrics",
        items: [
          {
            label: "Signal",
            value: signal == null ? "--" : String(Math.round(signal)),
            tone:
              signal == null
                ? "neutral"
                : signal >= 60
                  ? "positive"
                  : signal <= 40
                    ? "negative"
                    : "neutral",
          },
          {
            label: "Risk",
            value: risk == null ? "--" : risk.toFixed(1),
            tone: risk == null ? "neutral" : risk >= 60 ? "negative" : "neutral",
          },
          {
            label: "Conf",
            value: confidence == null ? "--" : confidence.toFixed(1),
            tone: confidence == null ? "neutral" : confidence >= 0 ? "positive" : "neutral",
          },
        ],
      };
    }

    if (match.status === "upcoming" || match.status === "live") {
      return { kind: "text", value: "Tracking" };
    }

    return { kind: "text", value: "Snapshot" };
  },
};

export const ${camel}HistoryPresenter: DomainHistoryPresenter = {
  id: "${id}_history",
  getOutcomeDistribution: (analysis) =>
    getAnalysisOutcomeDistribution(analysis, resolveOutcomeLabels()),
};

export const ${camel}ResultPresenter: DomainResultPresenter = {
  id: "${id}_result",
  getLoadingContextText: () => "Loading analysis context...",
  getNotFoundText: () => "Analysis target not found",
  getHeader: (match, draftData) => {
    const entity = resolveEntity(match, draftData);
    return {
      subtitle: entity.subtitle + " | " + resolveReferenceCaption(entity.secondaryName),
      title: entity.primaryName,
    };
  },
  getSummaryHero: (match, draftData) => {
    const entity = resolveEntity(match, draftData);
    return {
      kind: "single",
      entity: {
        id: match.homeTeam.id || "subject",
        name: entity.primaryName,
        logo: entity.primaryLogo,
      },
      caption: resolveReferenceCaption(entity.secondaryName),
    };
  },
  getSummaryDistribution: (analysis) =>
    getAnalysisOutcomeDistribution(analysis, resolveOutcomeLabels()),
  getExportMeta: (match, draftData, ctx) => {
    const entity = resolveEntity(match, draftData);
    return {
      reportTitle: entity.primaryName + " (Reference: " + entity.secondaryName + ")",
      primaryEntityName: entity.primaryName,
      secondaryEntityName: entity.secondaryName,
      statusLabel: resolveStatusLabel(match.status, ctx.t),
    };
  },
};

export const ${presenterConst}: DomainUiPresenter = {
  id: "${id}",
  home: ${camel}HomePresenter,
  history: ${camel}HistoryPresenter,
  result: ${camel}ResultPresenter,
};

export const DOMAIN_UI_PRESENTER_ENTRIES: DomainUiPresenter[] = [${presenterConst}];
`;

  return { files };
}

function printScaffoldSummary(config, dryRun) {
  const { id, templateIds } = config;
  const mode = dryRun ? "dry-run" : "apply";
  console.log(`[${mode}] auto-discovery mode enabled; no shared registry patch needed for "${id}".`);
  console.log(
    `generated templates (file-based): ${templateIds.basic}, ${templateIds.standard}, ${templateIds.focused}, ${templateIds.comprehensive}`,
  );
}

function run() {
  if (hasFlag("help") || hasFlag("h")) {
    console.log(
      [
        "Usage:",
        "  npm run domain:scaffold -- --id <domain_id> [--name \"Domain Name\"] [--force] [--dry-run]",
        "",
        "Example:",
        "  npm run domain:scaffold -- --id risk_control --name \"Risk Control Analysis\"",
      ].join("\n"),
    );
    return;
  }

  const id = String(getArg("id") || "").trim();
  ensureId(id);
  const name = String(getArg("name") || `${toTitle(id)} Analysis`).trim();
  const dryRun = hasFlag("dry-run");
  const force = hasFlag("force");

  const pascal = toPascal(id);
  const camel = toCamel(id);
  const presenterConst = `${toConstant(id)}_DOMAIN_UI_PRESENTER`;

  const templateIds = {
    basic: `${id}_basic`,
    standard: `${id}_standard`,
    focused: `${id}_focused`,
    comprehensive: `${id}_comprehensive`,
  };

  // Use built-in animation families so new domains pass verification without remotion edits.
  const animationTypes = {
    snapshot: "stats",
    trend: "tactical",
    risk: "odds",
  };

  const animationTemplateIds = {
    snapshot: "stats-comparison",
    trend: "tactical-board",
    risk: "odds-card",
  };

  const agentIds = {
    overview: `${id}_overview`,
    analysis: `${id}_analysis`,
    prediction: `${id}_prediction`,
    general: `${id}_general`,
    plannerTemplate: `${id}_planner_template`,
    plannerAutonomous: `${id}_planner_autonomous`,
  };

  const config = {
    id,
    name,
    pascal,
    camel,
    presenterConst,
    templateIds,
    animationTypes,
    animationTemplateIds,
    agentIds,
  };

  const { files } = buildFiles(config);
  const existing = Object.keys(files).filter((relPath) =>
    fs.existsSync(path.join(ROOT, relPath)),
  );
  if (existing.length > 0 && !force) {
    throw new Error(
      `Refusing to overwrite existing files without --force:\n${existing
        .map((file) => `- ${file}`)
        .join("\n")}`,
    );
  }

  Object.entries(files).forEach(([relPath, content]) => write(relPath, content, dryRun));
  updateLocaleFiles(config, dryRun);

  printScaffoldSummary(config, dryRun);

  console.log("");
  console.log(`Domain scaffold complete: ${id}`);
  console.log(`autoDiscovery=yes dryRun=${dryRun ? "yes" : "no"}`);
  console.log("Next: npm run verify:domain-extension && npm run lint && npm run build");
}

try {
  run();
} catch (error) {
  console.error("domain:scaffold failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

