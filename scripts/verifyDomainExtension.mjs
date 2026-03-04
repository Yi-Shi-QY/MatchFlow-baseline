import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const PATHS = {
  domainsRoot: "src/services/domains/modules",
  builtinModules: "src/services/domains/builtinModules.ts",
  aiPlanning: "src/services/ai/planning.ts",
  aiRoot: "src/services/ai.ts",
  sharedPlannerTemplateAgent: "src/agents/planner_template.ts",
  sharedPlannerAutonomousAgent: "src/agents/planner_autonomous.ts",
  sharedTagAgent: "src/agents/tag.ts",
  agentsIndex: "src/agents/index.ts",
  skillsIndex: "src/skills/index.ts",
  plannerIndex: "src/skills/planner/index.ts",
  uiPresenterRegistry: "src/services/domains/ui/registry.ts",
  uiPresentersRoot: "src/services/domains/ui/presenters",
  animationParams: "src/services/remotion/templateParams.ts",
  animationTemplates: "src/services/remotion/templates.tsx",
  plannerAdapterRegistry: "src/services/planner/adapters/registry.ts",
  plannerAdapterDefault: "src/services/planner/adapters/default.ts",
  plannerAdapterFootball: "src/services/planner/adapters/football.ts",
  plannerBridge: "src/components/planner/AnalysisPlannerRuntimeBridge.tsx",
};

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function listSubDirs(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function listFilesRecursively(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return [];
  const results = [];
  const walk = (target) => {
    const entries = fs.readdirSync(target, { withFileTypes: true });
    entries.forEach((entry) => {
      const next = path.join(target, entry.name);
      if (entry.isDirectory()) {
        walk(next);
      } else {
        results.push(next);
      }
    });
  };
  walk(abs);
  return results;
}

function parseStringLiterals(text) {
  const values = [];
  const regex = /["']([^"']+)["']/g;
  let match = regex.exec(text);
  while (match) {
    values.push(match[1]);
    match = regex.exec(text);
  }
  return values;
}

function parseIdFromDomain(content) {
  const match = content.match(/\bid\s*:\s*["']([^"']+)["']/);
  return match ? match[1] : null;
}

function parseResourceArray(domainContent, key) {
  const resourcesBlock = domainContent.match(/resources\s*:\s*\{([\s\S]*?)\}\s*,\s*dataSources/);
  if (!resourcesBlock) return [];
  const keyBlock = resourcesBlock[1].match(new RegExp(`${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`));
  if (!keyBlock) return [];
  return parseStringLiterals(keyBlock[1]);
}

function parsePlannerAgentIds(planningContent) {
  const match = planningContent.match(
    /getPlannerAgentId\s*:\s*\([^)]*\)\s*=>\s*([\s\S]*?),\s*resolveRoute/,
  );
  if (!match) return [];
  const allStrings = parseStringLiterals(match[1]);
  const filtered = allStrings.filter((value) => value !== "template" && value !== "autonomous");
  return Array.from(new Set(filtered));
}

function parseRequiredTerminalAgentType(planningContent) {
  const match = planningContent.match(/requiredTerminalAgentType\s*:\s*["']([^"']+)["']/);
  return match ? match[1] : null;
}

function extractObjectKeys(fileContent, constName) {
  const regex = new RegExp(`const\\s+${constName}[\\s\\S]*?=\\s*\\{([\\s\\S]*?)\\};`);
  const match = fileContent.match(regex);
  if (!match) return new Set();
  const keys = new Set();
  const lineRegex = /^\s*([A-Za-z0-9_]+)\s*:/gm;
  let lineMatch = lineRegex.exec(match[1]);
  while (lineMatch) {
    keys.add(lineMatch[1]);
    lineMatch = lineRegex.exec(match[1]);
  }
  return keys;
}

function extractAnimationTypeMap(content) {
  const mapMatch = content.match(/const\s+ANIMATION_TO_TEMPLATE[\s\S]*?=\s*\{([\s\S]*?)\};/);
  const mapping = new Map();
  if (!mapMatch) return mapping;
  const pairRegex = /(?:["']([^"']+)["']|([A-Za-z0-9_]+))\s*:\s*["']([^"']+)["']/g;
  let match = pairRegex.exec(mapMatch[1]);
  while (match) {
    const key = match[1] || match[2];
    const value = match[3];
    mapping.set(key, value);
    match = pairRegex.exec(mapMatch[1]);
  }
  return mapping;
}

function extractTemplateRegistryIds(content) {
  const match = content.match(/export\s+const\s+TEMPLATES[\s\S]*?=\s*\{([\s\S]*?)\};/);
  const ids = new Set();
  if (!match) return ids;
  const keyRegex = /["']([^"']+)["']\s*:/g;
  let keyMatch = keyRegex.exec(match[1]);
  while (keyMatch) {
    ids.add(keyMatch[1]);
    keyMatch = keyRegex.exec(match[1]);
  }
  return ids;
}

function extractBuiltinTemplateMeta() {
  const root = "src/skills/planner/templates";
  const files = listFilesRecursively(root).filter((absPath) => {
    const rel = path.relative(ROOT, absPath).replace(/\\/g, "/");
    return rel.endsWith(".ts") && !rel.endsWith("/index.ts");
  });

  const meta = new Map();
  files.forEach((absPath) => {
    const rel = path.relative(ROOT, absPath).replace(/\\/g, "/");
    const content = fs.readFileSync(absPath, "utf8");
    const idMatch = content.match(/\bid\s*:\s*["']([^"']+)["']/);
    if (!idMatch) return;
    const animationTypes = Array.from(
      new Set(
        Array.from(content.matchAll(/animationType\s*:\s*["']([^"']+)["']/g)).map((match) => match[1]),
      ),
    );
    meta.set(idMatch[1], { relPath: rel, animationTypes });
  });

  return meta;
}

function verifyBuiltinConstants(errors) {
  const builtin = read(PATHS.builtinModules);
  if (!/LOCAL_DOMAIN_CASE_MINIMUM\s*=\s*3/.test(builtin)) {
    errors.push(`[builtin] LOCAL_DOMAIN_CASE_MINIMUM must be 3 in ${PATHS.builtinModules}`);
  }
  if (!/DOMAIN_ANALYSIS_AGENT_MINIMUM\s*=\s*3/.test(builtin)) {
    errors.push(`[builtin] DOMAIN_ANALYSIS_AGENT_MINIMUM must be 3 in ${PATHS.builtinModules}`);
  }
}

function verifyBuiltinModuleDiscoveryContracts(errors) {
  const builtin = read(PATHS.builtinModules);
  if (!builtin.includes('import.meta.glob("./modules/*/module.ts"')) {
    errors.push(
      `[builtin] ${PATHS.builtinModules} must auto-discover modules via import.meta.glob("./modules/*/module.ts")`,
    );
  }
  if (!builtin.includes("DOMAIN_MODULE_FACTORIES")) {
    errors.push(
      `[builtin] ${PATHS.builtinModules} must read DOMAIN_MODULE_FACTORIES from module files`,
    );
  }
}

function verifyAgentRegistryContracts(errors) {
  const content = read(PATHS.agentsIndex);
  if (!content.includes("import.meta.glob('./domains/*/index.ts'")) {
    errors.push(
      `[agents] ${PATHS.agentsIndex} must auto-discover domain agents via import.meta.glob('./domains/*/index.ts')`,
    );
  }
  if (!content.includes("DOMAIN_AGENT_ENTRIES")) {
    errors.push(`[agents] ${PATHS.agentsIndex} must read DOMAIN_AGENT_ENTRIES from domain index files`);
  }
  if (!content.includes("DOMAIN_AGENT_VERSION_ENTRIES")) {
    errors.push(
      `[agents] ${PATHS.agentsIndex} must read DOMAIN_AGENT_VERSION_ENTRIES from domain index files`,
    );
  }
}

function verifyTemplateRegistryContracts(errors) {
  const content = read(PATHS.plannerIndex);
  if (!content.includes('import.meta.glob("./templates/*/index.ts"')) {
    errors.push(
      `[templates] ${PATHS.plannerIndex} must auto-discover template domains via import.meta.glob("./templates/*/index.ts")`,
    );
  }
  if (!content.includes("DOMAIN_TEMPLATE_ENTRIES")) {
    errors.push(
      `[templates] ${PATHS.plannerIndex} must read DOMAIN_TEMPLATE_ENTRIES from template index files`,
    );
  }
}

function verifyPlanningRoutingContracts(errors) {
  const planningContent = read(PATHS.aiPlanning);
  const aiContent = read(PATHS.aiRoot);

  if (!planningContent.includes("DEFAULT_DOMAIN_ID")) {
    errors.push(`[planning] ${PATHS.aiPlanning} must fallback with DEFAULT_DOMAIN_ID, not hardcoded domain strings`);
  }
  if (/activeDomainId[\s\S]*?:\s*["']football["']/.test(planningContent)) {
    errors.push(`[planning] ${PATHS.aiPlanning} contains hardcoded activeDomainId "football" fallback`);
  }

  if (/route\.plannerAgentId\s*\|\|/.test(aiContent)) {
    errors.push(`[planning] ${PATHS.aiRoot} should not fallback plannerAgentId with hardcoded IDs`);
  }
  if (
    aiContent.includes(`route.mode === "autonomous" ? "planner_autonomous" : "planner_template"`)
  ) {
    errors.push(`[planning] ${PATHS.aiRoot} contains legacy planner id fallback planner_template/planner_autonomous`);
  }
}

function verifySharedAgentNeutrality(errors) {
  const checks = [
    {
      path: PATHS.sharedPlannerTemplateAgent,
      forbiddenPatterns: [/\bfootball\b/i],
      message: "shared planner_template agent must be domain-neutral",
    },
    {
      path: PATHS.sharedPlannerAutonomousAgent,
      forbiddenPatterns: [/\bfootball\b/i],
      message: "shared planner_autonomous agent must be domain-neutral",
    },
    {
      path: PATHS.sharedTagAgent,
      forbiddenPatterns: [/\bfootball\b/i],
      message: "shared tag agent must be domain-neutral",
    },
  ];

  checks.forEach((check) => {
    const content = read(check.path);
    const hasForbidden = check.forbiddenPatterns.some((pattern) => pattern.test(content));
    if (hasForbidden) {
      errors.push(`[agents] ${check.message}: ${check.path}`);
    }
  });
}

function verifyPlannerAdapterContracts(errors, domainDirs) {
  [
    PATHS.plannerAdapterRegistry,
    PATHS.plannerAdapterDefault,
    PATHS.plannerBridge,
  ].forEach((relPath) => {
    if (!fs.existsSync(path.join(ROOT, relPath))) {
      errors.push(`[planner] Missing planner adapter file ${relPath}`);
    }
  });

  const registryContent = read(PATHS.plannerAdapterRegistry);
  if (!registryContent.includes("export function getPlannerAdapter")) {
    errors.push(`[planner] ${PATHS.plannerAdapterRegistry} must export getPlannerAdapter(...)`);
  }
  if (!/return\s+defaultPlannerAdapter;/.test(registryContent)) {
    errors.push(`[planner] ${PATHS.plannerAdapterRegistry} must fallback to defaultPlannerAdapter`);
  }

  if (domainDirs.includes("football")) {
    if (!fs.existsSync(path.join(ROOT, PATHS.plannerAdapterFootball))) {
      errors.push(`[planner] Missing football planner adapter file ${PATHS.plannerAdapterFootball}`);
    } else if (!registryContent.includes("footballPlannerAdapter")) {
      errors.push(`[planner] ${PATHS.plannerAdapterRegistry} must register footballPlannerAdapter`);
    }
  }

  const bridgeContent = read(PATHS.plannerBridge);
  if (!bridgeContent.includes("buildPlannerGraphForDomain")) {
    errors.push(`[planner] ${PATHS.plannerBridge} must build graph via buildPlannerGraphForDomain(...)`);
  }
  if (!bridgeContent.includes("mapPlannerRuntimeForDomain")) {
    errors.push(`[planner] ${PATHS.plannerBridge} must map runtime via mapPlannerRuntimeForDomain(...)`);
  }
  if (bridgeContent.includes("buildDefaultPlannerGraph(")) {
    errors.push(`[planner] ${PATHS.plannerBridge} should not hardcode buildDefaultPlannerGraph(...)`);
  }
}

function verifyUiPresenterRegistryContracts(errors) {
  const registryContent = read(PATHS.uiPresenterRegistry);
  if (!registryContent.includes("import.meta.glob(\"./presenters/*.ts\"")) {
    errors.push(
      `[ui] ${PATHS.uiPresenterRegistry} must auto-discover presenters via import.meta.glob("./presenters/*.ts")`,
    );
  }
  if (!registryContent.includes("DOMAIN_UI_PRESENTER_ENTRIES")) {
    errors.push(
      `[ui] ${PATHS.uiPresenterRegistry} must read DOMAIN_UI_PRESENTER_ENTRIES from presenter modules`,
    );
  }
}

function extractDomainAgentKeys(domainId) {
  const relPath = `src/agents/domains/${domainId}/index.ts`;
  if (!fs.existsSync(path.join(ROOT, relPath))) {
    return new Set();
  }
  const content = read(relPath);
  return extractObjectKeys(content, "DOMAIN_AGENT_ENTRIES");
}

function extractDomainAgentVersionKeys(domainId) {
  const relPath = `src/agents/domains/${domainId}/index.ts`;
  if (!fs.existsSync(path.join(ROOT, relPath))) {
    return new Set();
  }
  const content = read(relPath);
  return extractObjectKeys(content, "DOMAIN_AGENT_VERSION_ENTRIES");
}

function verifyDomain(domainId, context) {
  const errors = [];
  const moduleDir = path.join(PATHS.domainsRoot, domainId).replace(/\\/g, "/");
  const requiredFiles = ["domain.ts", "planning.ts", "localCases.ts", "module.ts", "index.ts"];
  requiredFiles.forEach((fileName) => {
    const relPath = `${moduleDir}/${fileName}`;
    if (!fs.existsSync(path.join(ROOT, relPath))) {
      errors.push(`[structure] Missing file ${relPath}`);
    }
  });

  if (errors.length > 0) return errors;

  const domainContent = read(`${moduleDir}/domain.ts`);
  const planningContent = read(`${moduleDir}/planning.ts`);
  const localCasesContent = read(`${moduleDir}/localCases.ts`);
  const moduleContent = read(`${moduleDir}/module.ts`);

  const idInDomain = parseIdFromDomain(domainContent);
  if (idInDomain !== domainId) {
    errors.push(`[domain] domain.id mismatch in ${moduleDir}/domain.ts (expected "${domainId}", got "${idInDomain || "none"}")`);
  }

  const resources = {
    templates: parseResourceArray(domainContent, "templates"),
    animations: parseResourceArray(domainContent, "animations"),
    agents: parseResourceArray(domainContent, "agents"),
    skills: parseResourceArray(domainContent, "skills"),
  };

  Object.entries(resources).forEach(([key, values]) => {
    if (!Array.isArray(values) || values.length === 0) {
      errors.push(`[resources] resources.${key} must be non-empty for domain "${domainId}"`);
    }
  });

  const plannerAgentIds = parsePlannerAgentIds(planningContent);
  if (plannerAgentIds.length < 2) {
    errors.push(`[planning] getPlannerAgentId must expose template/autonomous ids for domain "${domainId}"`);
  } else {
    plannerAgentIds.forEach((plannerId) => {
      if (!resources.agents.includes(plannerId)) {
        errors.push(`[planning] planner agent "${plannerId}" not declared in resources.agents for "${domainId}"`);
      }
    });
  }

  const terminalAgentType = parseRequiredTerminalAgentType(planningContent);
  if (terminalAgentType && !resources.agents.includes(terminalAgentType)) {
    errors.push(`[planning] requiredTerminalAgentType "${terminalAgentType}" is missing in resources.agents for "${domainId}"`);
  }

  const plannerSet = new Set(plannerAgentIds);
  const nonPlannerAgents = resources.agents.filter((agentId) => !plannerSet.has(agentId));
  if (nonPlannerAgents.length < 3) {
    errors.push(`[resources] Need at least 3 non-planner agents for "${domainId}", got ${nonPlannerAgents.length}`);
  }

  const localLiteralCaseCount = Array.from(localCasesContent.matchAll(/\bid\s*:\s*["'][^"']+["']/g)).length;
  const hasDynamicCaseMinimum = /caseMinimum/.test(localCasesContent);
  if (localLiteralCaseCount < 3 && !hasDynamicCaseMinimum) {
    errors.push(`[cases] localCases.ts must provide >=3 case ids or caseMinimum-driven generation for "${domainId}"`);
  }

  if (!moduleContent.includes("DOMAIN_MODULE_FACTORIES")) {
    errors.push(
      `[module] ${moduleDir}/module.ts must export DOMAIN_MODULE_FACTORIES for auto registration`,
    );
  }

  const presenterFile = `${PATHS.uiPresentersRoot}/${domainId}.ts`;
  if (!fs.existsSync(path.join(ROOT, presenterFile))) {
    errors.push(`[ui] Missing presenter file for "${domainId}": ${presenterFile}`);
  } else {
    const presenterContent = read(presenterFile);
    if (!presenterContent.includes("DOMAIN_UI_PRESENTER_ENTRIES")) {
      errors.push(
        `[ui] ${presenterFile} must export DOMAIN_UI_PRESENTER_ENTRIES for auto registration`,
      );
    }
    if (domainId !== "football") {
      const forbiddenHomeKeys = [
        "home.popular_matches",
        "home.live_upcoming",
        "home.refresh_matches",
        "home.click_to_analyze",
        "home.no_match_data",
        "home.search_placeholder",
        "home.live",
        "home.finished",
        "home.upcoming",
      ];
      forbiddenHomeKeys.forEach((key) => {
        if (presenterContent.includes(`"${key}"`) || presenterContent.includes(`'${key}'`)) {
          errors.push(
            `[ui] ${presenterFile} uses legacy sports copy key "${key}". Non-football domains must use "${domainId}.home.*" and "${domainId}.status.*" keys.`,
          );
        }
      });

      if (!presenterContent.includes(`${domainId}.home.`)) {
        errors.push(
          `[ui] ${presenterFile} must define domain-specific home copy keys with prefix "${domainId}.home."`,
        );
      }
      if (!presenterContent.includes(`${domainId}.status.`)) {
        errors.push(
          `[ui] ${presenterFile} must define domain-specific status copy keys with prefix "${domainId}.status."`,
        );
      }
    }
  }

  const domainAgentFile = `src/agents/domains/${domainId}/index.ts`;
  if (!fs.existsSync(path.join(ROOT, domainAgentFile))) {
    errors.push(`[agents] Missing domain agent index file: ${domainAgentFile}`);
  } else {
    const domainAgentContent = read(domainAgentFile);
    if (!domainAgentContent.includes("DOMAIN_AGENT_ENTRIES")) {
      errors.push(
        `[agents] ${domainAgentFile} must export DOMAIN_AGENT_ENTRIES for auto registration`,
      );
    }
    if (!domainAgentContent.includes("DOMAIN_AGENT_VERSION_ENTRIES")) {
      errors.push(
        `[agents] ${domainAgentFile} must export DOMAIN_AGENT_VERSION_ENTRIES for auto registration`,
      );
    }
  }

  const domainTemplateFile = `src/skills/planner/templates/${domainId}/index.ts`;
  if (!fs.existsSync(path.join(ROOT, domainTemplateFile))) {
    errors.push(`[templates] Missing domain template index file: ${domainTemplateFile}`);
  } else {
    const domainTemplateContent = read(domainTemplateFile);
    if (!domainTemplateContent.includes("DOMAIN_TEMPLATE_ENTRIES")) {
      errors.push(
        `[templates] ${domainTemplateFile} must export DOMAIN_TEMPLATE_ENTRIES for auto registration`,
      );
    }
  }

  resources.agents.forEach((agentId) => {
    if (!context.agentKeys.has(agentId)) {
      errors.push(`[agents] resources.agents includes "${agentId}" but BUILTIN_AGENTS has no matching entry`);
    }
    if (!context.agentVersionKeys.has(agentId)) {
      errors.push(
        `[agents] resources.agents includes "${agentId}" but BUILTIN_AGENT_VERSIONS has no matching entry`,
      );
    }
  });

  resources.skills.forEach((skillId) => {
    if (!context.skillKeys.has(skillId)) {
      errors.push(`[skills] resources.skills includes "${skillId}" but BUILTIN_SKILL_DECLARATIONS has no matching entry`);
    }
  });

  resources.templates.forEach((templateId) => {
    const meta = context.templateMeta.get(templateId);
    if (!meta) {
      errors.push(`[templates] resources.templates includes "${templateId}" but no built-in template file defines this id`);
      return;
    }
    const animationTypes = meta.animationTypes.filter((type) => type !== "none");
    animationTypes.forEach((type) => {
      const mappedTemplateId = context.animationTypeMap.get(type);
      if (!mappedTemplateId) {
        errors.push(`[animation] template "${templateId}" uses animationType "${type}" but ${PATHS.animationParams} has no mapping`);
        return;
      }
      if (!resources.animations.includes(mappedTemplateId)) {
        errors.push(`[animation] template "${templateId}" maps "${type}" -> "${mappedTemplateId}" but resources.animations is missing "${mappedTemplateId}"`);
      }
    });
  });

  resources.animations.forEach((animationTemplateId) => {
    if (!context.remotionTemplateIds.has(animationTemplateId)) {
      errors.push(`[animation] resources.animations includes "${animationTemplateId}" but ${PATHS.animationTemplates} has no matching template id`);
    }
  });

  return errors;
}

function run() {
  const errors = [];
  verifyBuiltinConstants(errors);
  verifyBuiltinModuleDiscoveryContracts(errors);
  verifyPlanningRoutingContracts(errors);
  verifySharedAgentNeutrality(errors);
  verifyAgentRegistryContracts(errors);
  verifyTemplateRegistryContracts(errors);
  verifyUiPresenterRegistryContracts(errors);

  const agentsIndexContent = read(PATHS.agentsIndex);
  const skillsIndexContent = read(PATHS.skillsIndex);
  const animationParamsContent = read(PATHS.animationParams);
  const animationTemplatesContent = read(PATHS.animationTemplates);

  const domainDirs = listSubDirs(PATHS.domainsRoot).filter((name) => {
    if (name === "shared") return false;
    return fs.existsSync(path.join(ROOT, PATHS.domainsRoot, name, "domain.ts"));
  });
  verifyPlannerAdapterContracts(errors, domainDirs);

  const domainAgentKeys = new Set();
  const domainAgentVersionKeys = new Set();
  domainDirs.forEach((domainId) => {
    extractDomainAgentKeys(domainId).forEach((key) => domainAgentKeys.add(key));
    extractDomainAgentVersionKeys(domainId).forEach((key) =>
      domainAgentVersionKeys.add(key),
    );
  });

  const sharedAgentKeys = extractObjectKeys(agentsIndexContent, "BUILTIN_AGENTS");
  const sharedAgentVersionKeys = extractObjectKeys(
    agentsIndexContent,
    "BUILTIN_AGENT_VERSIONS",
  );
  const mergedAgentKeys = new Set([...sharedAgentKeys, ...domainAgentKeys]);
  const mergedAgentVersionKeys = new Set([
    ...sharedAgentVersionKeys,
    ...domainAgentVersionKeys,
  ]);

  const context = {
    agentKeys: mergedAgentKeys,
    agentVersionKeys: mergedAgentVersionKeys,
    skillKeys: extractObjectKeys(skillsIndexContent, "BUILTIN_SKILL_DECLARATIONS"),
    templateMeta: extractBuiltinTemplateMeta(),
    animationTypeMap: extractAnimationTypeMap(animationParamsContent),
    remotionTemplateIds: extractTemplateRegistryIds(animationTemplatesContent),
  };

  console.log("Domain Extension Compliance Check");
  console.log(`- Domains discovered: ${domainDirs.join(", ") || "(none)"}`);

  domainDirs.forEach((domainId) => {
    const domainErrors = verifyDomain(domainId, context);
    if (domainErrors.length === 0) {
      console.log(`PASS ${domainId}`);
      return;
    }

    console.log(`FAIL ${domainId}`);
    domainErrors.forEach((error) => errors.push(error));
  });

  if (errors.length > 0) {
    console.log("");
    console.log(`Detected ${errors.length} issue(s):`);
    errors.forEach((error) => console.log(`- ${error}`));
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log("All domain extension checks passed.");
}

try {
  run();
} catch (error) {
  console.error("verify:domain-extension failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
