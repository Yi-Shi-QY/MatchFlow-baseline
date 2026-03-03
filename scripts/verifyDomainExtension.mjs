import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const PATHS = {
  domainsRoot: "src/services/domains/modules",
  modulesIndex: "src/services/domains/modules/index.ts",
  builtinModules: "src/services/domains/builtinModules.ts",
  aiPlanning: "src/services/ai/planning.ts",
  aiRoot: "src/services/ai.ts",
  sharedPlannerTemplateAgent: "src/agents/planner_template.ts",
  sharedPlannerAutonomousAgent: "src/agents/planner_autonomous.ts",
  sharedTagAgent: "src/agents/tag.ts",
  agentsIndex: "src/agents/index.ts",
  skillsIndex: "src/skills/index.ts",
  plannerIndex: "src/skills/planner/index.ts",
  uiPresenter: "src/services/domains/ui/presenter.ts",
  animationParams: "src/services/remotion/templateParams.ts",
  animationTemplates: "src/services/remotion/templates.tsx",
};

const MARKERS = [
  { file: PATHS.modulesIndex, marker: "DOMAIN_MODULE_EXPORT_MARKER" },
  { file: PATHS.builtinModules, marker: "DOMAIN_MODULE_IMPORT_MARKER" },
  { file: PATHS.builtinModules, marker: "DOMAIN_MODULE_REGISTRATION_MARKER" },
  { file: PATHS.agentsIndex, marker: "DOMAIN_AGENT_IMPORT_MARKER" },
  { file: PATHS.agentsIndex, marker: "DOMAIN_AGENT_REGISTRATION_MARKER" },
  { file: PATHS.agentsIndex, marker: "DOMAIN_AGENT_VERSION_MARKER" },
  { file: PATHS.plannerIndex, marker: "DOMAIN_TEMPLATE_IMPORT_MARKER" },
  { file: PATHS.plannerIndex, marker: "DOMAIN_TEMPLATE_REGISTRATION_MARKER" },
  { file: PATHS.uiPresenter, marker: "DOMAIN_UI_PRESENTER_EXTENSIONS_MARKER" },
  { file: PATHS.uiPresenter, marker: "DOMAIN_UI_PRESENTER_REGISTRATION_MARKER" },
];

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

function verifyMarkers(errors) {
  MARKERS.forEach(({ file, marker }) => {
    const content = read(file);
    if (!content.includes(marker)) {
      errors.push(`[marker] Missing marker "${marker}" in ${file}`);
    }
  });
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

  const factoryMatch = moduleContent.match(/export\s+function\s+([A-Za-z0-9_]+)\s*\(/);
  const factoryName = factoryMatch ? factoryMatch[1] : null;
  if (!factoryName) {
    errors.push(`[module] Missing create factory export in ${moduleDir}/module.ts`);
  } else {
    if (!context.modulesIndex.includes(`export * from "./${domainId}"`)) {
      errors.push(`[registry] Missing modules export for "${domainId}" in ${PATHS.modulesIndex}`);
    }
    if (!context.builtinModules.includes(`${factoryName}(`)) {
      errors.push(`[registry] Missing builtin module registration for "${domainId}" (${factoryName}) in ${PATHS.builtinModules}`);
    }
  }

  if (!context.uiPresenterKeys.has(domainId)) {
    errors.push(`[ui] Missing UI presenter registration for "${domainId}" in ${PATHS.uiPresenter}`);
  }

  resources.agents.forEach((agentId) => {
    if (!context.agentKeys.has(agentId)) {
      errors.push(`[agents] resources.agents includes "${agentId}" but BUILTIN_AGENTS has no matching entry`);
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
  verifyMarkers(errors);
  verifyBuiltinConstants(errors);
  verifyPlanningRoutingContracts(errors);
  verifySharedAgentNeutrality(errors);

  const modulesIndexContent = read(PATHS.modulesIndex);
  const builtinModulesContent = read(PATHS.builtinModules);
  const agentsIndexContent = read(PATHS.agentsIndex);
  const skillsIndexContent = read(PATHS.skillsIndex);
  const uiPresenterContent = read(PATHS.uiPresenter);
  const animationParamsContent = read(PATHS.animationParams);
  const animationTemplatesContent = read(PATHS.animationTemplates);

  const domainDirs = listSubDirs(PATHS.domainsRoot).filter((name) => {
    if (name === "shared") return false;
    return fs.existsSync(path.join(ROOT, PATHS.domainsRoot, name, "domain.ts"));
  });

  const context = {
    modulesIndex: modulesIndexContent,
    builtinModules: builtinModulesContent,
    agentKeys: extractObjectKeys(agentsIndexContent, "BUILTIN_AGENTS"),
    skillKeys: extractObjectKeys(skillsIndexContent, "BUILTIN_SKILL_DECLARATIONS"),
    uiPresenterKeys: extractObjectKeys(uiPresenterContent, "BUILTIN_DOMAIN_UI_PRESENTERS"),
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
