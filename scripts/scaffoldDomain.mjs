import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const MARKERS = {
  moduleExport: "DOMAIN_MODULE_EXPORT_MARKER",
  moduleImport: "DOMAIN_MODULE_IMPORT_MARKER",
  moduleRegistration: "DOMAIN_MODULE_REGISTRATION_MARKER",
  agentImport: "DOMAIN_AGENT_IMPORT_MARKER",
  agentRegistration: "DOMAIN_AGENT_REGISTRATION_MARKER",
  agentVersion: "DOMAIN_AGENT_VERSION_MARKER",
  templateImport: "DOMAIN_TEMPLATE_IMPORT_MARKER",
  templateRegistration: "DOMAIN_TEMPLATE_REGISTRATION_MARKER",
  uiPresenterExtension: "DOMAIN_UI_PRESENTER_EXTENSIONS_MARKER",
  uiPresenterRegistration: "DOMAIN_UI_PRESENTER_REGISTRATION_MARKER",
};

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

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
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

function patch(relPath, marker, snippet, dryRun) {
  const content = read(relPath);
  if (!content.includes(marker)) {
    throw new Error(`Marker "${marker}" not found in ${relPath}`);
  }
  if (content.includes(snippet.trim())) {
    console.log(`skip ${relPath} (already patched)`);
    return;
  }
  const next = content.replace(marker, `${snippet}${marker}`);
  write(relPath, next, dryRun);
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

  return `import { PlanTemplate } from "../../types";

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
  // TODO(domain-scaffold): Replace with domain-native source definitions.
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
        title: "领域概览",
        focus: "基础背景和关键上下文",
        animationType: "none",
        agentType: "${agentIds.overview}",
        contextMode: "independent",
      },
      {
        title: "最终结论",
        focus: "结论和执行建议",
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
          title: "最终结论",
          focus: "结论和执行建议",
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

export function ${localCasesFn}(caseMinimum: number): Match[] {
  const normalizedCount = Math.max(3, Math.floor(caseMinimum));
  return MOCK_MATCHES.slice(0, normalizedCount).map((match, index) => ({
    ...cloneMatch(match),
    id: "${id}_case_" + (index + 1),
    league: "${name} Demo " + (index + 1),
  }));
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

  files[`src/agents/domains/${id}/index.ts`] = `export { ${camel}OverviewAgent } from "./overview";
export { ${camel}AnalysisAgent } from "./analysis";
export { ${camel}PredictionAgent } from "./prediction";
export { ${camel}GeneralAgent } from "./general";
export { ${camel}PlannerTemplateAgent } from "./planner_template";
export { ${camel}PlannerAutonomousAgent } from "./planner_autonomous";
`;

  files[`src/skills/planner/templates/${id}/basic.ts`] = buildTemplateFile(
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

  files[`src/skills/planner/templates/${id}/standard.ts`] = buildTemplateFile(
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

  files[`src/skills/planner/templates/${id}/focused.ts`] = buildTemplateFile(
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

  files[`src/skills/planner/templates/${id}/comprehensive.ts`] = buildTemplateFile(
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

  files[`src/skills/planner/templates/${id}/index.ts`] = `export { ${templateVars.basic} } from "./basic";
export { ${templateVars.standard} } from "./standard";
export { ${templateVars.focused} } from "./focused";
export { ${templateVars.comprehensive} } from "./comprehensive";
`;

  return { files, createModuleFn, templateVars };
}

function registerDomain(config, templateVars, createModuleFn, dryRun) {
  const { id, camel, presenterConst, agentIds, templateIds } = config;

  patch("src/services/domains/modules/index.ts", MARKERS.moduleExport, `export * from "./${id}";\n`, dryRun);
  patch(
    "src/services/domains/builtinModules.ts",
    MARKERS.moduleImport,
    `  ${createModuleFn},\n`,
    dryRun,
  );
  patch(
    "src/services/domains/builtinModules.ts",
    MARKERS.moduleRegistration,
    `  ${createModuleFn}(LOCAL_DOMAIN_CASE_MINIMUM),\n`,
    dryRun,
  );

  patch(
    "src/agents/index.ts",
    MARKERS.agentImport,
    `import { ${camel}AnalysisAgent, ${camel}GeneralAgent, ${camel}OverviewAgent, ${camel}PlannerAutonomousAgent, ${camel}PlannerTemplateAgent, ${camel}PredictionAgent } from './domains/${id}';\n`,
    dryRun,
  );
  patch(
    "src/agents/index.ts",
    MARKERS.agentRegistration,
    `  ${agentIds.overview}: ${camel}OverviewAgent,\n  ${agentIds.analysis}: ${camel}AnalysisAgent,\n  ${agentIds.prediction}: ${camel}PredictionAgent,\n  ${agentIds.general}: ${camel}GeneralAgent,\n  ${agentIds.plannerTemplate}: ${camel}PlannerTemplateAgent,\n  ${agentIds.plannerAutonomous}: ${camel}PlannerAutonomousAgent,\n`,
    dryRun,
  );
  patch(
    "src/agents/index.ts",
    MARKERS.agentVersion,
    `  ${agentIds.overview}: "1.0.0",\n  ${agentIds.analysis}: "1.0.0",\n  ${agentIds.prediction}: "1.0.0",\n  ${agentIds.general}: "1.0.0",\n  ${agentIds.plannerTemplate}: "1.0.0",\n  ${agentIds.plannerAutonomous}: "1.0.0",\n`,
    dryRun,
  );

  patch(
    "src/skills/planner/index.ts",
    MARKERS.templateImport,
    `import { ${templateVars.basic}, ${templateVars.comprehensive}, ${templateVars.focused}, ${templateVars.standard} } from "./templates/${id}";\n`,
    dryRun,
  );
  patch(
    "src/skills/planner/index.ts",
    MARKERS.templateRegistration,
    `  ${templateVars.basic},\n  ${templateVars.standard},\n  ${templateVars.focused},\n  ${templateVars.comprehensive},\n`,
    dryRun,
  );

  const uiSnippet = `const ${camel}HomePresenter: DomainHomePresenter = {
  id: "${id}_home",
  useRemoteFeed: true,
  sectionTitleKey: "home.popular_matches",
  sectionHintKey: "home.live_upcoming",
  refreshActionKey: "home.refresh_matches",
  openActionKey: "home.click_to_analyze",
  noDataKey: "home.no_match_data",
  searchPlaceholderKey: "home.search_placeholder",
  getDisplayPair: footballHomePresenter.getDisplayPair,
  getSearchTokens: footballHomePresenter.getSearchTokens,
  getStatusLabel: (status, ctx) => resolveFootballStatusLabel(status, ctx.t),
  getStatusClassName: footballHomePresenter.getStatusClassName,
  getOutcomeLabels: footballHomePresenter.getOutcomeLabels,
  getCenterDisplay: footballHomePresenter.getCenterDisplay,
};

const ${camel}HistoryPresenter: DomainHistoryPresenter = {
  id: "${id}_history",
  getOutcomeDistribution: footballHistoryPresenter.getOutcomeDistribution,
};

const ${camel}ResultPresenter: DomainResultPresenter = {
  id: "${id}_result",
  getLoadingContextText: footballResultPresenter.getLoadingContextText,
  getNotFoundText: footballResultPresenter.getNotFoundText,
  getHeader: footballResultPresenter.getHeader,
  getSummaryHero: footballResultPresenter.getSummaryHero,
  getSummaryDistribution: footballResultPresenter.getSummaryDistribution,
  getExportMeta: footballResultPresenter.getExportMeta,
};

const ${presenterConst}: DomainUiPresenter = {
  id: "${id}",
  home: ${camel}HomePresenter,
  history: ${camel}HistoryPresenter,
  result: ${camel}ResultPresenter,
};

`;

  patch("src/services/domains/ui/presenter.ts", MARKERS.uiPresenterExtension, uiSnippet, dryRun);
  patch(
    "src/services/domains/ui/presenter.ts",
    MARKERS.uiPresenterRegistration,
    `  ${id}: ${presenterConst},\n`,
    dryRun,
  );

  console.log(`registered templates: ${templateIds.basic}, ${templateIds.standard}, ${templateIds.focused}, ${templateIds.comprehensive}`);
}

function run() {
  if (hasFlag("help") || hasFlag("h")) {
    console.log(
      [
        "Usage:",
        "  npm run domain:scaffold -- --id <domain_id> [--name \"Domain Name\"] [--no-register] [--force] [--dry-run]",
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
  const register = !hasFlag("no-register");

  const pascal = toPascal(id);
  const camel = toCamel(id);
  const presenterConst = `${toConstant(id)}_DOMAIN_UI_PRESENTER`;

  const templateIds = {
    basic: `${id}_basic`,
    standard: `${id}_standard`,
    focused: `${id}_focused`,
    comprehensive: `${id}_comprehensive`,
  };

  const animationTypes = {
    snapshot: `${id}_snapshot`,
    trend: `${id}_trend`,
    risk: `${id}_risk`,
  };

  const animationTemplateIds = {
    snapshot: `${id}-snapshot-card`,
    trend: `${id}-trend-bars`,
    risk: `${id}-risk-radar`,
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

  const { files, createModuleFn, templateVars } = buildFiles(config);
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

  if (register) {
    registerDomain(config, templateVars, createModuleFn, dryRun);
  }

  console.log("");
  console.log(`Domain scaffold complete: ${id}`);
  console.log(`register=${register ? "yes" : "no"} dryRun=${dryRun ? "yes" : "no"}`);
  console.log("Next: npm run verify:domain-extension && npm run lint && npm run build");
}

try {
  run();
} catch (error) {
  console.error("domain:scaffold failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
