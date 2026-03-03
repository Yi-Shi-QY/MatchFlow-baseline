const crypto = require('crypto');
const db = require('../../db');
const {
  DEEPSEEK_API_BASE_URL,
  DEEPSEEK_API_KEY,
  DEEPSEEK_MODEL,
  DEEPSEEK_TIMEOUT_MS,
} = require('../config');
const {
  normalizeDomain,
  getDomainConfig,
  listCatalogEntries,
  listCatalogRevisions,
  getCatalogRevisionByVersion,
  getLatestPublishedRevision,
  createCatalogRevision,
  updateCatalogRevisionByVersion,
  markPublishedRevisionAsDeprecated,
  createValidationRun,
  updateValidationRun,
  getValidationRunById,
  createReleaseRecord,
  listReleaseRecords,
  insertAuditLog,
} = require('../repositories/studioCatalogRepository');

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ALLOWED_CHANNELS = new Set(['internal', 'beta', 'stable']);
const ALLOWED_STATUSES = new Set(['draft', 'validated', 'published', 'deprecated']);
const ALLOWED_RUN_TYPES = new Set(['catalog_validate', 'pre_publish', 'post_publish']);
const ALLOWED_CONTEXT_MODES = new Set(['independent', 'build_upon', 'all']);
const SOURCE_ID_PATTERN = /^[a-z0-9_][a-z0-9_-]{1,63}$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const HOST_ALLOWLIST_ENTRY_PATTERN = /^[A-Za-z0-9*.-]+(?::\d{1,5})?$/;

class StudioCatalogError extends Error {
  constructor(message, code = 'STUDIO_CATALOG_ERROR', statusCode = 400, details = null) {
    super(message);
    this.name = 'StudioCatalogError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
}

function checksumManifest(manifest) {
  return crypto.createHash('sha256').update(JSON.stringify(manifest || {})).digest('hex');
}

function resolveTenantId(authContext, requestedTenantId) {
  const normalizedRequested = normalizeString(requestedTenantId);
  if (normalizedRequested) {
    return normalizedRequested;
  }
  const normalizedAuthTenant = normalizeString(authContext?.tenantId);
  if (normalizedAuthTenant) {
    return normalizedAuthTenant;
  }
  return DEFAULT_TENANT_ID;
}

function resolveActorUserId(authContext) {
  const userId = normalizeString(authContext?.userId);
  return userId || null;
}

function ensureDomain(domainInput) {
  const domain = normalizeDomain(domainInput);
  if (!domain) {
    throw new StudioCatalogError('Invalid catalog domain', 'CATALOG_DOMAIN_INVALID', 400);
  }
  return domain;
}

function ensureItemId(itemIdInput) {
  const itemId = normalizeString(itemIdInput);
  if (itemId.length < 2 || itemId.length > 128) {
    throw new StudioCatalogError('itemId must be 2-128 characters', 'CATALOG_ITEM_ID_INVALID', 400);
  }
  return itemId;
}

function ensureVersion(versionInput, fieldName = 'version') {
  const version = normalizeString(versionInput);
  if (version.length === 0) {
    throw new StudioCatalogError(`${fieldName} is required`, 'CATALOG_VERSION_REQUIRED', 400);
  }
  return version;
}

function ensureChannel(channelInput, fallbackValue = 'internal') {
  const channel = normalizeString(channelInput) || fallbackValue;
  if (!ALLOWED_CHANNELS.has(channel)) {
    throw new StudioCatalogError('channel is invalid', 'CATALOG_CHANNEL_INVALID', 400);
  }
  return channel;
}

function ensureStatus(statusInput, fallbackValue = 'draft') {
  const status = normalizeString(statusInput) || fallbackValue;
  if (!ALLOWED_STATUSES.has(status)) {
    throw new StudioCatalogError('status is invalid', 'CATALOG_STATUS_INVALID', 400);
  }
  return status;
}

function ensureManifest(manifestInput) {
  if (!manifestInput || typeof manifestInput !== 'object' || Array.isArray(manifestInput)) {
    throw new StudioCatalogError('manifest must be an object', 'CATALOG_MANIFEST_INVALID', 400);
  }
  return manifestInput;
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeStringArray(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function uniqueStrings(values) {
  return Array.from(new Set(normalizeStringArray(values)));
}

function isPathArray(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.every((segment) => typeof segment === 'string' && segment.trim().length > 0);
}

function pathToString(value) {
  if (!isPathArray(value)) {
    return '';
  }
  return value.map((segment) => segment.trim()).join('.');
}

function buildValidationCheck(name, errors, passMessage) {
  if (!Array.isArray(errors) || errors.length === 0) {
    return {
      name,
      status: 'passed',
      message: passMessage,
    };
  }
  return {
    name,
    status: 'failed',
    message: errors[0],
    details: {
      errors,
    },
  };
}

function collectDatasourceFields(manifest) {
  if (Array.isArray(manifest?.fields)) {
    return manifest.fields;
  }
  if (Array.isArray(manifest?.schema?.fields)) {
    return manifest.schema.fields;
  }
  if (Array.isArray(manifest?.formSections)) {
    return manifest.formSections.flatMap((section) => (
      Array.isArray(section?.fields) ? section.fields : []
    ));
  }
  return [];
}

function validateDatasourceManifestSchema(manifest) {
  const errors = [];
  const sourceId = normalizeString(manifest?.id || manifest?.sourceId);
  if (!sourceId) {
    errors.push('datasource.id (or datasource.sourceId) is required');
  } else if (!SOURCE_ID_PATTERN.test(sourceId)) {
    errors.push('datasource.id must match pattern [a-z0-9_][a-z0-9_-]{1,63}');
  }

  const displayName = normalizeString(manifest?.name || manifest?.label || manifest?.labelKey);
  if (!displayName) {
    errors.push('datasource.name (or datasource.label/labelKey) is required');
  }

  const fields = collectDatasourceFields(manifest);
  if (!Array.isArray(fields) || fields.length === 0) {
    errors.push('datasource fields are required (fields[]/schema.fields[]/formSections[].fields[])');
    return errors;
  }

  fields.forEach((field, index) => {
    if (!isPlainObject(field)) {
      errors.push(`datasource.fields[${index}] must be an object`);
      return;
    }
    if (!normalizeString(field.id)) {
      errors.push(`datasource.fields[${index}].id is required`);
    }
    const fieldType = normalizeString(field.type);
    if (!fieldType) {
      errors.push(`datasource.fields[${index}].type is required`);
    }

    if (isPathArray(field.path)) {
      return;
    }
    if (fieldType === 'versus_number') {
      if (!isPathArray(field.homePath) || !isPathArray(field.awayPath)) {
        errors.push(`datasource.fields[${index}] must include homePath/awayPath`);
      }
      return;
    }
    if (fieldType === 'odds_triplet') {
      if (!isPathArray(field.homePath) || !isPathArray(field.drawPath) || !isPathArray(field.awayPath)) {
        errors.push(`datasource.fields[${index}] must include homePath/drawPath/awayPath`);
      }
      return;
    }

    errors.push(`datasource.fields[${index}] must include path[]`);
  });

  const sectionErrors = [];
  if (Array.isArray(manifest?.formSections)) {
    manifest.formSections.forEach((section, index) => {
      if (!isPlainObject(section)) {
        sectionErrors.push(`datasource.formSections[${index}] must be an object`);
        return;
      }
      if (!normalizeString(section.id)) {
        sectionErrors.push(`datasource.formSections[${index}].id is required`);
      }
      if (!normalizeString(section.titleKey) && !normalizeString(section.title)) {
        sectionErrors.push(`datasource.formSections[${index}].titleKey (or title) is required`);
      }
      if (!Array.isArray(section.fields) || section.fields.length === 0) {
        sectionErrors.push(`datasource.formSections[${index}].fields must be non-empty`);
      }
    });
  }
  errors.push(...sectionErrors);
  return errors;
}

function validateDatasourceManifestDependencies(manifest) {
  const errors = [];

  if (manifest?.requiredPermissions !== undefined && !Array.isArray(manifest.requiredPermissions)) {
    errors.push('datasource.requiredPermissions must be an array when provided');
  }

  const requiredPermissions = normalizeStringArray(manifest?.requiredPermissions);
  requiredPermissions.forEach((permission, index) => {
    if (!permission.startsWith('datasource:use:')) {
      errors.push(`datasource.requiredPermissions[${index}] must start with datasource:use:`);
    }
  });

  if (manifest?.applyRules !== undefined && !Array.isArray(manifest.applyRules)) {
    errors.push('datasource.applyRules must be an array when provided');
  }
  if (manifest?.removeRules !== undefined && !Array.isArray(manifest.removeRules)) {
    errors.push('datasource.removeRules must be an array when provided');
  }

  const applyTargets = new Set();
  const removeTargets = new Set();
  const collectRuleTarget = (rule, index, fieldName, collector) => {
    if (!isPlainObject(rule)) {
      errors.push(`datasource.${fieldName}[${index}] must be an object`);
      return;
    }
    const targetPath = pathToString(rule.path);
    const target = targetPath || normalizeString(rule.target || rule.fieldId || rule.key);
    if (!target) {
      errors.push(`datasource.${fieldName}[${index}] must provide path[] or target`);
      return;
    }
    collector.add(target);
  };

  if (Array.isArray(manifest?.applyRules)) {
    manifest.applyRules.forEach((rule, index) => {
      collectRuleTarget(rule, index, 'applyRules', applyTargets);
    });
  }
  if (Array.isArray(manifest?.removeRules)) {
    manifest.removeRules.forEach((rule, index) => {
      collectRuleTarget(rule, index, 'removeRules', removeTargets);
    });
  }

  for (const target of applyTargets) {
    if (removeTargets.has(target)) {
      errors.push(`datasource.applyRules/removeRules conflict on target: ${target}`);
    }
  }

  return errors;
}

function validateDatasourceManifestCompatibility(manifest) {
  const errors = [];
  const fields = collectDatasourceFields(manifest);
  const seenFieldIds = new Set();
  const seenPaths = new Set();

  fields.forEach((field, index) => {
    if (!isPlainObject(field)) {
      return;
    }
    const fieldId = normalizeString(field.id);
    if (fieldId) {
      if (seenFieldIds.has(fieldId)) {
        errors.push(`datasource field id duplicated: ${fieldId}`);
      } else {
        seenFieldIds.add(fieldId);
      }
    }

    const pathCandidates = [];
    if (isPathArray(field.path)) {
      pathCandidates.push(pathToString(field.path));
    }
    if (isPathArray(field.homePath)) {
      pathCandidates.push(pathToString(field.homePath));
    }
    if (isPathArray(field.awayPath)) {
      pathCandidates.push(pathToString(field.awayPath));
    }
    if (isPathArray(field.drawPath)) {
      pathCandidates.push(pathToString(field.drawPath));
    }

    pathCandidates.forEach((path) => {
      if (!path) {
        return;
      }
      if (seenPaths.has(path)) {
        errors.push(`datasource field path duplicated: ${path} (field index ${index})`);
      } else {
        seenPaths.add(path);
      }
    });
  });

  if (manifest?.cardSpan !== undefined && ![1, 2].includes(manifest.cardSpan)) {
    errors.push('datasource.cardSpan must be 1 or 2 when provided');
  }
  if (manifest?.defaultSelected !== undefined && typeof manifest.defaultSelected !== 'boolean') {
    errors.push('datasource.defaultSelected must be boolean when provided');
  }

  return errors;
}

function validatePlanningTemplateManifestSchema(manifest) {
  const errors = [];
  if (!normalizeString(manifest?.rule)) {
    errors.push('planning_template.rule is required');
  }

  if (!Array.isArray(manifest?.segments) || manifest.segments.length === 0) {
    errors.push('planning_template.segments must be a non-empty array');
    return errors;
  }

  manifest.segments.forEach((segment, index) => {
    if (!isPlainObject(segment)) {
      errors.push(`planning_template.segments[${index}] must be an object`);
      return;
    }
    if (!normalizeString(segment.agentType)) {
      errors.push(`planning_template.segments[${index}].agentType is required`);
    }
    if (!normalizeString(segment?.title?.en)) {
      errors.push(`planning_template.segments[${index}].title.en is required`);
    }
    if (!normalizeString(segment?.title?.zh)) {
      errors.push(`planning_template.segments[${index}].title.zh is required`);
    }
    if (!normalizeString(segment?.focus?.en)) {
      errors.push(`planning_template.segments[${index}].focus.en is required`);
    }
    if (!normalizeString(segment?.focus?.zh)) {
      errors.push(`planning_template.segments[${index}].focus.zh is required`);
    }

    const contextMode = normalizeString(segment.contextMode);
    if (contextMode && !ALLOWED_CONTEXT_MODES.has(contextMode)) {
      errors.push(
        `planning_template.segments[${index}].contextMode must be one of independent|build_upon|all`,
      );
    }
    if (segment.animationType !== undefined && !normalizeString(segment.animationType)) {
      errors.push(`planning_template.segments[${index}].animationType must be a non-empty string`);
    }
  });

  return errors;
}

function validatePlanningTemplateManifestDependencies(manifest) {
  const errors = [];
  if (!Array.isArray(manifest?.requiredAgents)) {
    errors.push('planning_template.requiredAgents must be an array');
  }
  if (!Array.isArray(manifest?.requiredSkills)) {
    errors.push('planning_template.requiredSkills must be an array');
  }

  const requiredAgents = uniqueStrings(manifest?.requiredAgents);
  const requiredSkills = uniqueStrings(manifest?.requiredSkills);
  if (requiredAgents.length === 0) {
    errors.push('planning_template.requiredAgents must include at least one agent');
  }
  if (requiredSkills.length === 0) {
    errors.push('planning_template.requiredSkills must include at least one skill');
  }

  const segmentAgents = Array.isArray(manifest?.segments)
    ? uniqueStrings(manifest.segments.map((segment) => segment?.agentType))
    : [];

  segmentAgents.forEach((agentType) => {
    if (!requiredAgents.includes(agentType)) {
      errors.push(`planning_template.requiredAgents must include segment agentType: ${agentType}`);
    }
  });
  requiredAgents.forEach((agentType) => {
    if (!segmentAgents.includes(agentType)) {
      errors.push(`planning_template.requiredAgents references missing segment agentType: ${agentType}`);
    }
  });

  return errors;
}

function validatePlanningTemplateManifestCompatibility(manifest) {
  const errors = [];
  if (!Array.isArray(manifest?.segments) || manifest.segments.length === 0) {
    return errors;
  }

  if (manifest.segments.length > 20) {
    errors.push('planning_template.segments cannot exceed 20 items');
  }

  const titleSet = new Set();
  manifest.segments.forEach((segment, index) => {
    if (!isPlainObject(segment)) {
      return;
    }
    const contextMode = normalizeString(segment.contextMode);
    if (index === 0 && contextMode === 'build_upon') {
      errors.push('planning_template.segments[0].contextMode cannot be build_upon');
    }

    const titleEn = normalizeString(segment?.title?.en).toLowerCase();
    if (titleEn) {
      if (titleSet.has(titleEn)) {
        errors.push(`planning_template.segment title.en duplicated: ${titleEn}`);
      } else {
        titleSet.add(titleEn);
      }
    }
  });

  return errors;
}

function validateAnimationTemplateManifestSchema(manifest) {
  const errors = [];
  const templateId = normalizeString(manifest?.id || manifest?.templateId);
  if (!templateId) {
    errors.push('animation_template.id (or templateId) is required');
  } else if (!SOURCE_ID_PATTERN.test(templateId)) {
    errors.push('animation_template.id must match pattern [a-z0-9_][a-z0-9_-]{1,63}');
  }

  if (!normalizeString(manifest?.name)) {
    errors.push('animation_template.name is required');
  }
  if (!normalizeString(manifest?.description)) {
    errors.push('animation_template.description is required');
  }
  if (!normalizeString(manifest?.animationType)) {
    errors.push('animation_template.animationType is required');
  }
  if (!normalizeString(manifest?.templateId)) {
    errors.push('animation_template.templateId is required');
  }

  if (manifest?.requiredParams !== undefined && !Array.isArray(manifest.requiredParams)) {
    errors.push('animation_template.requiredParams must be an array when provided');
  }
  if (Array.isArray(manifest?.requiredParams)) {
    manifest.requiredParams.forEach((param, index) => {
      if (!normalizeString(param)) {
        errors.push(`animation_template.requiredParams[${index}] must be a non-empty string`);
      }
    });
  }

  if (!isPlainObject(manifest?.schema)) {
    errors.push('animation_template.schema must be an object');
  }
  if (manifest?.example !== undefined && !isPlainObject(manifest.example)) {
    errors.push('animation_template.example must be an object when provided');
  }

  return errors;
}

function validateAnimationTemplateManifestDependencies(manifest) {
  const errors = [];
  const requiredParams = uniqueStrings(manifest?.requiredParams);
  const schema = isPlainObject(manifest?.schema) ? manifest.schema : {};
  const schemaProperties = isPlainObject(schema?.properties) ? schema.properties : {};
  const example = isPlainObject(manifest?.example) ? manifest.example : null;

  requiredParams.forEach((param) => {
    if (!Object.prototype.hasOwnProperty.call(schemaProperties, param)) {
      errors.push(`animation_template.requiredParams references missing schema property: ${param}`);
    }
    if (example && !Object.prototype.hasOwnProperty.call(example, param)) {
      errors.push(`animation_template.requiredParams references missing example field: ${param}`);
    }
  });

  return errors;
}

function validateAnimationTemplateManifestCompatibility(manifest) {
  const errors = [];
  const requiredParamsRaw = normalizeStringArray(manifest?.requiredParams);
  const requiredParamsSet = new Set();
  requiredParamsRaw.forEach((param) => {
    if (requiredParamsSet.has(param)) {
      errors.push(`animation_template.requiredParams duplicated: ${param}`);
    } else {
      requiredParamsSet.add(param);
    }
  });

  if (isPlainObject(manifest?.schema) && manifest.schema.type !== undefined && manifest.schema.type !== 'object') {
    errors.push('animation_template.schema.type must be "object" when provided');
  }

  if (requiredParamsRaw.length > 30) {
    errors.push('animation_template.requiredParams cannot exceed 30 items');
  }

  return errors;
}

function validateAgentManifestSchema(manifest) {
  const errors = [];
  const agentId = normalizeString(manifest?.id);
  if (!agentId) {
    errors.push('agent.id is required');
  } else if (!SOURCE_ID_PATTERN.test(agentId)) {
    errors.push('agent.id must match pattern [a-z0-9_][a-z0-9_-]{1,63}');
  }

  if (manifest?.kind !== undefined && manifest.kind !== 'agent') {
    errors.push('agent.kind must be "agent" when provided');
  }
  if (!normalizeString(manifest?.name)) {
    errors.push('agent.name is required');
  }
  if (!normalizeString(manifest?.description)) {
    errors.push('agent.description is required');
  }

  if (!isPlainObject(manifest?.rolePrompt)) {
    errors.push('agent.rolePrompt must be an object');
  } else {
    if (!normalizeString(manifest.rolePrompt.en)) {
      errors.push('agent.rolePrompt.en is required');
    }
    if (!normalizeString(manifest.rolePrompt.zh)) {
      errors.push('agent.rolePrompt.zh is required');
    }
  }

  if (manifest?.skills !== undefined && !Array.isArray(manifest.skills)) {
    errors.push('agent.skills must be an array when provided');
  }
  if (Array.isArray(manifest?.skills)) {
    manifest.skills.forEach((skill, index) => {
      if (!normalizeString(skill)) {
        errors.push(`agent.skills[${index}] must be a non-empty string`);
      }
    });
  }

  const contextDependencies = manifest?.contextDependencies;
  if (
    contextDependencies !== undefined
    && contextDependencies !== 'all'
    && contextDependencies !== 'none'
    && !Array.isArray(contextDependencies)
  ) {
    errors.push(`agent.contextDependencies must be 'all' | 'none' | string[]`);
  }
  if (Array.isArray(contextDependencies)) {
    contextDependencies.forEach((dependency, index) => {
      if (!normalizeString(dependency)) {
        errors.push(`agent.contextDependencies[${index}] must be a non-empty string`);
      }
    });
  }

  if (manifest?.minAppVersion !== undefined && !normalizeString(manifest.minAppVersion)) {
    errors.push('agent.minAppVersion must be a non-empty string when provided');
  }

  return errors;
}

function validateAgentManifestDependencies(manifest) {
  const errors = [];
  if (Array.isArray(manifest?.contextDependencies) && manifest.contextDependencies.length === 0) {
    errors.push('agent.contextDependencies cannot be an empty array');
  }
  return errors;
}

function validateAgentManifestCompatibility(manifest) {
  const errors = [];

  const skills = normalizeStringArray(manifest?.skills);
  const skillSet = new Set();
  skills.forEach((skill) => {
    if (skillSet.has(skill)) {
      errors.push(`agent.skills duplicated: ${skill}`);
    } else {
      skillSet.add(skill);
    }
  });

  if (Array.isArray(manifest?.contextDependencies)) {
    const dependencySet = new Set();
    normalizeStringArray(manifest.contextDependencies).forEach((dependency) => {
      if (dependencySet.has(dependency)) {
        errors.push(`agent.contextDependencies duplicated: ${dependency}`);
      } else {
        dependencySet.add(dependency);
      }
    });
  }

  return errors;
}

function validateSkillManifestSchema(manifest) {
  const errors = [];
  const skillId = normalizeString(manifest?.id);
  if (!skillId) {
    errors.push('skill.id is required');
  } else if (!SOURCE_ID_PATTERN.test(skillId)) {
    errors.push('skill.id must match pattern [a-z0-9_][a-z0-9_-]{1,63}');
  }

  if (manifest?.kind !== undefined && manifest.kind !== 'skill') {
    errors.push('skill.kind must be "skill" when provided');
  }
  if (!normalizeString(manifest?.name)) {
    errors.push('skill.name is required');
  }
  if (!normalizeString(manifest?.description)) {
    errors.push('skill.description is required');
  }
  if (manifest?.minAppVersion !== undefined && !normalizeString(manifest.minAppVersion)) {
    errors.push('skill.minAppVersion must be a non-empty string when provided');
  }

  if (!isPlainObject(manifest?.declaration)) {
    errors.push('skill.declaration must be an object');
  } else {
    if (!normalizeString(manifest.declaration.name)) {
      errors.push('skill.declaration.name is required');
    }
    if (!normalizeString(manifest.declaration.description)) {
      errors.push('skill.declaration.description is required');
    }
    if (
      manifest.declaration.parameters !== undefined
      && !isPlainObject(manifest.declaration.parameters)
    ) {
      errors.push('skill.declaration.parameters must be an object when provided');
    }
  }

  if (!isPlainObject(manifest?.runtime)) {
    errors.push('skill.runtime must be an object');
  } else {
    if (manifest.runtime.mode !== 'builtin_alias') {
      errors.push(`skill.runtime.mode must be 'builtin_alias'`);
    }
    if (!normalizeString(manifest.runtime.targetSkill)) {
      errors.push('skill.runtime.targetSkill is required');
    }
  }

  return errors;
}

function validateSkillManifestDependencies(manifest) {
  const errors = [];
  const declaration = isPlainObject(manifest?.declaration) ? manifest.declaration : {};
  const parameters = isPlainObject(declaration?.parameters) ? declaration.parameters : null;
  if (parameters) {
    const required = Array.isArray(parameters.required) ? parameters.required : [];
    const properties = isPlainObject(parameters.properties) ? parameters.properties : {};
    required.forEach((requiredField, index) => {
      const normalized = normalizeString(requiredField);
      if (!normalized) {
        errors.push(`skill.declaration.parameters.required[${index}] must be a non-empty string`);
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(properties, normalized)) {
        errors.push(
          `skill.declaration.parameters.required references missing property: ${normalized}`,
        );
      }
    });
  }
  return errors;
}

function validateSkillManifestCompatibility(manifest) {
  const errors = [];
  const declaration = isPlainObject(manifest?.declaration) ? manifest.declaration : {};
  const runtime = isPlainObject(manifest?.runtime) ? manifest.runtime : {};
  const manifestId = normalizeString(manifest?.id);
  const declarationName = normalizeString(declaration?.name);
  const targetSkill = normalizeString(runtime?.targetSkill);

  if (manifestId && declarationName && manifestId !== declarationName) {
    errors.push('skill.declaration.name must match skill.id');
  }

  if (manifestId && targetSkill && targetSkill === manifestId) {
    errors.push('skill.runtime.targetSkill cannot reference skill.id itself');
  }

  const parameters = isPlainObject(declaration?.parameters) ? declaration.parameters : null;
  if (parameters && parameters.type !== undefined && parameters.type !== 'object') {
    errors.push('skill.declaration.parameters.type must be "object" when provided');
  }

  return errors;
}

function validateDomainPackManifestSchema(manifest) {
  const errors = [];
  const domainId = normalizeString(manifest?.id);

  if (!domainId) {
    errors.push('domain_pack.id is required');
  } else if (!SOURCE_ID_PATTERN.test(domainId)) {
    errors.push('domain_pack.id must match pattern [a-z0-9_][a-z0-9_-]{1,63}');
  }

  if (manifest?.kind !== undefined && manifest.kind !== 'domain') {
    errors.push('domain_pack.kind must be "domain" when provided');
  }
  if (!normalizeString(manifest?.name)) {
    errors.push('domain_pack.name is required');
  }
  if (!normalizeString(manifest?.description)) {
    errors.push('domain_pack.description is required');
  }

  const baseDomainId = normalizeString(manifest?.baseDomainId);
  if (manifest?.baseDomainId !== undefined && !baseDomainId) {
    errors.push('domain_pack.baseDomainId must be a non-empty string when provided');
  } else if (baseDomainId && !SOURCE_ID_PATTERN.test(baseDomainId)) {
    errors.push('domain_pack.baseDomainId must match pattern [a-z0-9_][a-z0-9_-]{1,63}');
  }

  const minAppVersion = normalizeString(manifest?.minAppVersion);
  if (manifest?.minAppVersion !== undefined && !minAppVersion) {
    errors.push('domain_pack.minAppVersion must be a non-empty string when provided');
  } else if (minAppVersion && !SEMVER_PATTERN.test(minAppVersion)) {
    errors.push('domain_pack.minAppVersion must follow semver x.y.z');
  }

  if (manifest?.updatedAt !== undefined && !normalizeString(manifest.updatedAt)) {
    errors.push('domain_pack.updatedAt must be a non-empty string when provided');
  }

  const idArrayFields = ['recommendedAgents', 'recommendedSkills', 'recommendedTemplates'];
  idArrayFields.forEach((fieldName) => {
    const value = manifest?.[fieldName];
    if (value === undefined) return;
    if (!Array.isArray(value)) {
      errors.push(`domain_pack.${fieldName} must be an array when provided`);
      return;
    }
    value.forEach((entry, index) => {
      const normalized = normalizeString(entry);
      if (!normalized) {
        errors.push(`domain_pack.${fieldName}[${index}] must be a non-empty string`);
        return;
      }
      if (!SOURCE_ID_PATTERN.test(normalized)) {
        errors.push(
          `domain_pack.${fieldName}[${index}] must match pattern [a-z0-9_][a-z0-9_-]{1,63}`,
        );
      }
    });
  });

  if (manifest?.skillHttpAllowedHosts !== undefined) {
    if (!Array.isArray(manifest.skillHttpAllowedHosts)) {
      errors.push('domain_pack.skillHttpAllowedHosts must be an array when provided');
    } else {
      manifest.skillHttpAllowedHosts.forEach((entry, index) => {
        const host = normalizeString(entry);
        if (!host) {
          errors.push(`domain_pack.skillHttpAllowedHosts[${index}] must be a non-empty string`);
        }
      });
    }
  }

  if (manifest?.hub !== undefined) {
    if (!isPlainObject(manifest.hub)) {
      errors.push('domain_pack.hub must be an object when provided');
    } else {
      if (manifest.hub.baseUrl !== undefined && !normalizeString(manifest.hub.baseUrl)) {
        errors.push('domain_pack.hub.baseUrl must be a non-empty string when provided');
      }
      if (manifest.hub.apiKey !== undefined && !normalizeString(manifest.hub.apiKey)) {
        errors.push('domain_pack.hub.apiKey must be a non-empty string when provided');
      }
      if (
        manifest.hub.autoInstall !== undefined
        && typeof manifest.hub.autoInstall !== 'boolean'
      ) {
        errors.push('domain_pack.hub.autoInstall must be boolean when provided');
      }
    }
  }

  return errors;
}

function validateDomainPackManifestDependencies(manifest) {
  const errors = [];
  const hosts = normalizeStringArray(manifest?.skillHttpAllowedHosts);

  hosts.forEach((host) => {
    if (host.includes('://')) {
      errors.push(`domain_pack.skillHttpAllowedHosts must be host[:port] without scheme: ${host}`);
      return;
    }
    if (!HOST_ALLOWLIST_ENTRY_PATTERN.test(host)) {
      errors.push(`domain_pack.skillHttpAllowedHosts contains invalid host entry: ${host}`);
    }
  });

  return errors;
}

function validateDomainPackManifestCompatibility(manifest) {
  const errors = [];
  const domainId = normalizeString(manifest?.id);
  const baseDomainId = normalizeString(manifest?.baseDomainId);

  if (domainId && baseDomainId && domainId === baseDomainId) {
    errors.push('domain_pack.baseDomainId cannot be the same as domain_pack.id');
  }

  const checkDuplicates = (fieldName) => {
    const values = normalizeStringArray(manifest?.[fieldName]);
    const seen = new Set();
    values.forEach((value) => {
      if (seen.has(value)) {
        errors.push(`domain_pack.${fieldName} duplicated: ${value}`);
      } else {
        seen.add(value);
      }
    });
  };
  checkDuplicates('recommendedAgents');
  checkDuplicates('recommendedSkills');
  checkDuplicates('recommendedTemplates');
  checkDuplicates('skillHttpAllowedHosts');

  if (normalizeStringArray(manifest?.skillHttpAllowedHosts).length > 100) {
    errors.push('domain_pack.skillHttpAllowedHosts cannot exceed 100 entries');
  }

  return errors;
}

function supportsStrictDomainValidation(domain) {
  return (
    domain === 'datasource'
    || domain === 'planning_template'
    || domain === 'animation_template'
    || domain === 'agent'
    || domain === 'skill'
    || domain === 'domain_pack'
  );
}

function buildDomainValidationChecks(domain, manifest) {
  if (domain === 'datasource') {
    return [
      buildValidationCheck(
        'schema',
        validateDatasourceManifestSchema(manifest),
        'Datasource schema check passed',
      ),
      buildValidationCheck(
        'dependency',
        validateDatasourceManifestDependencies(manifest),
        'Datasource dependency check passed',
      ),
      buildValidationCheck(
        'compatibility',
        validateDatasourceManifestCompatibility(manifest),
        'Datasource compatibility check passed',
      ),
    ];
  }

  if (domain === 'planning_template') {
    return [
      buildValidationCheck(
        'schema',
        validatePlanningTemplateManifestSchema(manifest),
        'Planning template schema check passed',
      ),
      buildValidationCheck(
        'dependency',
        validatePlanningTemplateManifestDependencies(manifest),
        'Planning template dependency check passed',
      ),
      buildValidationCheck(
        'compatibility',
        validatePlanningTemplateManifestCompatibility(manifest),
        'Planning template compatibility check passed',
      ),
    ];
  }

  if (domain === 'animation_template') {
    return [
      buildValidationCheck(
        'schema',
        validateAnimationTemplateManifestSchema(manifest),
        'Animation template schema check passed',
      ),
      buildValidationCheck(
        'dependency',
        validateAnimationTemplateManifestDependencies(manifest),
        'Animation template dependency check passed',
      ),
      buildValidationCheck(
        'compatibility',
        validateAnimationTemplateManifestCompatibility(manifest),
        'Animation template compatibility check passed',
      ),
    ];
  }

  if (domain === 'agent') {
    return [
      buildValidationCheck(
        'schema',
        validateAgentManifestSchema(manifest),
        'Agent schema check passed',
      ),
      buildValidationCheck(
        'dependency',
        validateAgentManifestDependencies(manifest),
        'Agent dependency check passed',
      ),
      buildValidationCheck(
        'compatibility',
        validateAgentManifestCompatibility(manifest),
        'Agent compatibility check passed',
      ),
    ];
  }

  if (domain === 'skill') {
    return [
      buildValidationCheck(
        'schema',
        validateSkillManifestSchema(manifest),
        'Skill schema check passed',
      ),
      buildValidationCheck(
        'dependency',
        validateSkillManifestDependencies(manifest),
        'Skill dependency check passed',
      ),
      buildValidationCheck(
        'compatibility',
        validateSkillManifestCompatibility(manifest),
        'Skill compatibility check passed',
      ),
    ];
  }

  if (domain === 'domain_pack') {
    return [
      buildValidationCheck(
        'schema',
        validateDomainPackManifestSchema(manifest),
        'Domain pack schema check passed',
      ),
      buildValidationCheck(
        'dependency',
        validateDomainPackManifestDependencies(manifest),
        'Domain pack dependency check passed',
      ),
      buildValidationCheck(
        'compatibility',
        validateDomainPackManifestCompatibility(manifest),
        'Domain pack compatibility check passed',
      ),
    ];
  }

  return [
    {
      name: 'schema',
      status: 'passed',
      message: `No strict schema validator is registered for domain ${domain}`,
    },
    {
      name: 'dependency',
      status: 'passed',
      message: `No strict dependency validator is registered for domain ${domain}`,
    },
    {
      name: 'compatibility',
      status: 'passed',
      message: `No strict compatibility validator is registered for domain ${domain}`,
    },
  ];
}

function getFailedChecks(checks) {
  return checks.filter((check) => check.status === 'failed');
}

function buildValidationSummary(checks, status, metadata = {}) {
  return {
    status,
    checkedAt: new Date().toISOString(),
    failedChecks: getFailedChecks(checks).map((check) => check.name),
    checks,
    ...metadata,
  };
}

function normalizeTemperature(input, fallback = 0.2) {
  const parsed = Number.parseFloat(input);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(parsed, 2));
}

function normalizeMaxTokens(input, fallback = 900, max = 4096) {
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed)) {
    return Math.min(Math.max(fallback, 1), max);
  }
  return Math.min(Math.max(parsed, 1), max);
}

function normalizeObject(input, label) {
  if (input === undefined || input === null) {
    return {};
  }
  if (!isPlainObject(input)) {
    throw new StudioCatalogError(`${label} must be an object`, 'CATALOG_PREVIEW_INPUT_INVALID', 400);
  }
  return input;
}

function normalizeJsonObjectText(input, label) {
  const normalized = normalizeString(input);
  if (!normalized) {
    return {};
  }
  let parsed;
  try {
    parsed = JSON.parse(normalized);
  } catch (error) {
    throw new StudioCatalogError(`${label} must be valid JSON`, 'CATALOG_PREVIEW_INPUT_INVALID', 400, {
      field: label,
      reason: error.message,
    });
  }
  if (!isPlainObject(parsed)) {
    throw new StudioCatalogError(`${label} must be a JSON object`, 'CATALOG_PREVIEW_INPUT_INVALID', 400, {
      field: label,
    });
  }
  return parsed;
}

function normalizeDeepSeekMessageContent(content) {
  if (typeof content === 'string') {
    return content.trim();
  }
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }
      if (!isPlainObject(item)) {
        return '';
      }
      if (typeof item.text === 'string') {
        return item.text;
      }
      if (typeof item.content === 'string') {
        return item.content;
      }
      return '';
    })
    .filter((item) => item.trim().length > 0)
    .join('\n')
    .trim();
}

function buildDeepSeekEndpoint() {
  const baseUrl = normalizeString(DEEPSEEK_API_BASE_URL) || 'https://api.deepseek.com';
  const normalizedBase = baseUrl.replace(/\/+$/g, '');
  return `${normalizedBase}/chat/completions`;
}

async function callDeepSeekChatCompletion({
  model,
  messages,
  temperature,
  maxTokens,
}) {
  if (!normalizeString(DEEPSEEK_API_KEY)) {
    throw new StudioCatalogError(
      'DeepSeek API key not configured',
      'MODEL_PROVIDER_NOT_CONFIGURED',
      503,
    );
  }

  if (typeof fetch !== 'function') {
    throw new StudioCatalogError(
      'Runtime fetch API is unavailable',
      'MODEL_PROVIDER_RUNTIME_UNSUPPORTED',
      500,
    );
  }

  const endpoint = buildDeepSeekEndpoint();
  const resolvedModel = normalizeString(model) || DEEPSEEK_MODEL || 'deepseek-chat';
  const resolvedTemperature = normalizeTemperature(temperature, 0.2);
  const resolvedMaxTokens = normalizeMaxTokens(maxTokens, 900, 4096);
  const timeoutMs = normalizeMaxTokens(DEEPSEEK_TIMEOUT_MS, 20000, 120000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages,
        temperature: resolvedTemperature,
        max_tokens: resolvedMaxTokens,
        stream: false,
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let payload;
    try {
      payload = JSON.parse(rawText);
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const providerCode = normalizeString(payload?.error?.code);
      const providerMessage = normalizeString(payload?.error?.message);
      throw new StudioCatalogError(
        providerMessage || `DeepSeek request failed with status ${response.status}`,
        'MODEL_PROVIDER_REQUEST_FAILED',
        response.status === 429 ? 503 : 502,
        {
          status: response.status,
          providerCode: providerCode || null,
        },
      );
    }

    const choices = Array.isArray(payload?.choices) ? payload.choices : [];
    const firstChoice = choices[0] || {};
    const content = normalizeDeepSeekMessageContent(firstChoice?.message?.content);
    if (!content) {
      throw new StudioCatalogError(
        'DeepSeek returned empty content',
        'MODEL_PROVIDER_EMPTY_RESPONSE',
        502,
      );
    }

    return {
      model: normalizeString(payload?.model) || resolvedModel,
      content,
      finishReason: normalizeString(firstChoice?.finish_reason) || 'unknown',
      usage: isPlainObject(payload?.usage) ? payload.usage : {},
      id: normalizeString(payload?.id) || null,
    };
  } catch (error) {
    if (error instanceof StudioCatalogError) {
      throw error;
    }
    if (error?.name === 'AbortError') {
      throw new StudioCatalogError(
        `DeepSeek request timed out after ${timeoutMs}ms`,
        'MODEL_PROVIDER_TIMEOUT',
        504,
      );
    }
    throw new StudioCatalogError(
      `DeepSeek request failed: ${error.message || 'unknown error'}`,
      'MODEL_PROVIDER_REQUEST_FAILED',
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

function resolveAgentPromptByLocale(manifest, localeInput) {
  const rolePrompt = isPlainObject(manifest?.rolePrompt) ? manifest.rolePrompt : {};
  const locale = normalizeString(localeInput).toLowerCase();
  const promptEn = normalizeString(rolePrompt.en);
  const promptZh = normalizeString(rolePrompt.zh);

  if (locale.startsWith('zh')) {
    return {
      locale: promptZh ? 'zh' : 'en',
      prompt: promptZh || promptEn,
    };
  }

  return {
    locale: promptEn ? 'en' : 'zh',
    prompt: promptEn || promptZh,
  };
}

function getSkillRequiredKeys(manifest) {
  const declaration = isPlainObject(manifest?.declaration) ? manifest.declaration : {};
  const parameters = isPlainObject(declaration?.parameters) ? declaration.parameters : {};
  const requiredRaw = Array.isArray(parameters.required) ? parameters.required : [];
  return requiredRaw
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toCapabilitySuffix(value) {
  return String(value || '')
    .split(/[_-]+/g)
    .filter((segment) => segment.length > 0)
    .map((segment) => `${segment.charAt(0).toUpperCase()}${segment.slice(1)}`)
    .join('');
}

function normalizePathSegments(value) {
  if (!isPathArray(value)) {
    return [];
  }
  return value
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function normalizeStatusList(value) {
  if (Array.isArray(value)) {
    return uniqueStrings(value);
  }
  const normalized = normalizeString(value);
  if (!normalized) {
    return [];
  }
  return uniqueStrings(normalized.split(','));
}

function normalizePreviewLimit(limitInput, fallbackValue = 5) {
  const parsed = Number.parseInt(limitInput, 10);
  const fallback = Number.isFinite(fallbackValue) ? fallbackValue : 5;
  if (!Number.isFinite(parsed)) {
    return Math.max(1, Math.min(fallback, 20));
  }
  return Math.max(1, Math.min(parsed, 20));
}

function collectDatasourceFieldMappings(manifest) {
  const fields = collectDatasourceFields(manifest);
  const fieldCatalog = [];
  const pathCatalogMap = new Map();
  let invalidFieldCount = 0;

  fields.forEach((field, index) => {
    if (!isPlainObject(field)) {
      invalidFieldCount += 1;
      return;
    }

    const fieldId = normalizeString(field.id) || `field_${index + 1}`;
    const fieldType = normalizeString(field.type) || 'text';
    const mappings = [];

    const appendMapping = (slot, pathValue) => {
      const segments = normalizePathSegments(pathValue);
      if (segments.length === 0) {
        return;
      }
      const pathText = segments.join('.');
      mappings.push({
        slot,
        path: segments,
        pathText,
      });

      if (!pathCatalogMap.has(pathText)) {
        pathCatalogMap.set(pathText, {
          pathText,
          segments,
          fieldRefs: [],
        });
      }
      const existing = pathCatalogMap.get(pathText);
      existing.fieldRefs.push({ fieldId, fieldType, slot });
    };

    if (fieldType === 'versus_number') {
      appendMapping('home', field.homePath);
      appendMapping('away', field.awayPath);
    } else if (fieldType === 'odds_triplet') {
      appendMapping('home', field.homePath);
      appendMapping('draw', field.drawPath);
      appendMapping('away', field.awayPath);
    } else {
      appendMapping('value', field.path);
    }

    if (mappings.length === 0) {
      invalidFieldCount += 1;
    }

    fieldCatalog.push({
      fieldId,
      fieldType,
      mappings,
    });
  });

  const pathCatalog = Array.from(pathCatalogMap.values())
    .map((item) => ({
      ...item,
      fieldRefs: item.fieldRefs
        .slice()
        .sort((left, right) => {
          const byField = left.fieldId.localeCompare(right.fieldId);
          if (byField !== 0) {
            return byField;
          }
          return left.slot.localeCompare(right.slot);
        }),
    }))
    .sort((left, right) => left.pathText.localeCompare(right.pathText));

  return {
    fieldCatalog,
    pathCatalog,
    invalidFieldCount,
    mappedFieldCount: fieldCatalog.filter((field) => field.mappings.length > 0).length,
    duplicatePathCount: pathCatalog.filter((item) => item.fieldRefs.length > 1).length,
  };
}

function buildDatasourcePathTree(pathCatalog) {
  const root = {
    segment: '$',
    path: '$',
    fieldRefs: [],
    children: [],
  };

  pathCatalog.forEach((pathRecord) => {
    let cursor = root;
    let currentPath = '';

    pathRecord.segments.forEach((segment) => {
      currentPath = currentPath ? `${currentPath}.${segment}` : segment;
      let child = cursor.children.find((item) => item.segment === segment);
      if (!child) {
        child = {
          segment,
          path: currentPath,
          fieldRefs: [],
          children: [],
        };
        cursor.children.push(child);
      }
      cursor = child;
    });

    cursor.fieldRefs.push(...pathRecord.fieldRefs);
  });

  const sortNode = (node) => {
    node.fieldRefs.sort((left, right) => {
      const byField = left.fieldId.localeCompare(right.fieldId);
      if (byField !== 0) {
        return byField;
      }
      return left.slot.localeCompare(right.slot);
    });
    node.children.sort((left, right) => left.segment.localeCompare(right.segment));
    node.children.forEach((child) => sortNode(child));
  };
  sortNode(root);

  return root;
}

function extractValueAtPath(value, pathSegments) {
  if (!Array.isArray(pathSegments) || pathSegments.length === 0) {
    return undefined;
  }
  let cursor = value;
  for (const segment of pathSegments) {
    if (cursor === null || cursor === undefined) {
      return undefined;
    }

    if (Array.isArray(cursor)) {
      const index = Number.parseInt(segment, 10);
      if (!Number.isFinite(index)) {
        return undefined;
      }
      cursor = cursor[index];
      continue;
    }

    if (typeof cursor !== 'object') {
      return undefined;
    }
    cursor = cursor[segment];
  }
  return cursor;
}

function resolveDatasourceFieldPreviewValue(record, fieldRecord) {
  const mappings = Array.isArray(fieldRecord?.mappings) ? fieldRecord.mappings : [];
  if (mappings.length === 0) {
    return null;
  }
  if (mappings.length === 1 && mappings[0].slot === 'value') {
    const value = extractValueAtPath(record, mappings[0].path);
    return value === undefined ? null : value;
  }

  const composite = {};
  mappings.forEach((mapping) => {
    const value = extractValueAtPath(record, mapping.path);
    composite[mapping.slot] = value === undefined ? null : value;
  });
  return composite;
}

function mapMatchRowToDatasourcePreviewRecord(row) {
  const homeTeam = row?.hometeam || row?.homeTeam || null;
  const awayTeam = row?.awayteam || row?.awayTeam || null;
  return {
    id: row?.id || null,
    league: row?.league_name || null,
    date: row?.match_date || null,
    status: row?.status || null,
    score: {
      home: row?.home_score ?? null,
      away: row?.away_score ?? null,
    },
    stats: row?.match_stats || {},
    odds: row?.odds || {},
    homeTeam: homeTeam
      ? {
        id: homeTeam.id || null,
        name: homeTeam.name || null,
        logo: homeTeam.logo_url || null,
        form: homeTeam.recent_form || [],
      }
      : null,
    awayTeam: awayTeam
      ? {
        id: awayTeam.id || null,
        name: awayTeam.name || null,
        logo: awayTeam.logo_url || null,
        form: awayTeam.recent_form || [],
      }
      : null,
  };
}

function buildDatasourceSourceContextPreview(manifest, pathCatalog) {
  const sourceId = normalizeString(manifest.id || manifest.sourceId) || 'datasource';
  const selected = manifest.defaultSelected !== false;
  const allPaths = pathCatalog
    .map((item) => item.pathText.toLowerCase())
    .filter((pathText) => pathText.length > 0);

  const hasOdds = allPaths.some((pathText) => (
    pathText.startsWith('odds')
    || pathText.includes('.odds.')
  ));
  const hasStats = allPaths.some((pathText) => (
    pathText.startsWith('stats')
    || pathText.includes('.stats.')
  ));
  const hasFundamental = allPaths.some((pathText) => (
    pathText.startsWith('league')
    || pathText.startsWith('status')
    || pathText.startsWith('hometeam')
    || pathText.startsWith('awayteam')
    || pathText.includes('.league')
    || pathText.includes('.hometeam')
    || pathText.includes('.awayteam')
  ));
  const hasCustom = allPaths.some((pathText) => (
    pathText.startsWith('custom') || pathText.includes('.custom')
  ));

  const capabilities = {
    hasFundamental,
    hasStats,
    hasOdds,
    hasCustom,
  };
  const suffix = toCapabilitySuffix(sourceId);
  if (suffix) {
    capabilities[`has${suffix}`] = selected;
  }

  return {
    sourceContext: {
      origin: 'server-db',
      selectedSources: {
        [sourceId]: selected,
      },
      selectedSourceIds: selected ? [sourceId] : [],
      capabilities,
      matchStatus: 'upcoming',
    },
  };
}

function runStrictManifestValidationForWrite(domain, manifest) {
  if (!supportsStrictDomainValidation(domain)) {
    return {};
  }

  const checks = buildDomainValidationChecks(domain, manifest);
  const failedChecks = getFailedChecks(checks);
  if (failedChecks.length > 0) {
    throw new StudioCatalogError(
      `manifest validation failed for ${domain}`,
      'CATALOG_MANIFEST_SCHEMA_INVALID',
      400,
      {
        domain,
        checks,
      },
    );
  }

  return buildValidationSummary(checks, 'succeeded', {
    mode: 'pre_write',
  });
}

function ensureRevisionValidatedForPublish(revision) {
  const summary = isPlainObject(revision?.validationSummary)
    ? revision.validationSummary
    : null;
  const failedChecks = Array.isArray(summary?.failedChecks) ? summary.failedChecks : [];

  if (
    summary
    && summary.mode === 'validation_run'
    && summary.status === 'succeeded'
    && failedChecks.length === 0
  ) {
    return;
  }

  throw new StudioCatalogError(
    'catalog revision must pass validation run before publish',
    'CATALOG_RELEASE_BLOCKED_BY_VALIDATION',
    409,
    {
      requirement: {
        mode: 'validation_run',
        status: 'succeeded',
      },
      validationSummary: summary,
    },
  );
}

function flattenManifestValues(value, pathPrefix, collector) {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      collector.set(pathPrefix, []);
      return;
    }
    value.forEach((item, index) => {
      const nextPath = pathPrefix ? `${pathPrefix}[${index}]` : `[${index}]`;
      flattenManifestValues(item, nextPath, collector);
    });
    return;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort((left, right) => left.localeCompare(right));
    if (keys.length === 0) {
      collector.set(pathPrefix, {});
      return;
    }
    keys.forEach((key) => {
      const nextPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      flattenManifestValues(value[key], nextPath, collector);
    });
    return;
  }

  collector.set(pathPrefix || '$', value);
}

function buildManifestDiff(fromManifest, toManifest) {
  const fromMap = new Map();
  const toMap = new Map();
  flattenManifestValues(fromManifest, '', fromMap);
  flattenManifestValues(toManifest, '', toMap);

  const added = [];
  const removed = [];
  const changed = [];

  for (const [path, toValue] of toMap.entries()) {
    if (!fromMap.has(path)) {
      added.push(path);
      continue;
    }
    const fromValue = fromMap.get(path);
    if (JSON.stringify(fromValue) !== JSON.stringify(toValue)) {
      changed.push({
        path,
        from: fromValue,
        to: toValue,
      });
    }
  }

  for (const path of fromMap.keys()) {
    if (!toMap.has(path)) {
      removed.push(path);
    }
  }

  added.sort((left, right) => left.localeCompare(right));
  removed.sort((left, right) => left.localeCompare(right));
  changed.sort((left, right) => left.path.localeCompare(right.path));

  return {
    summary: {
      manifestChanged: added.length > 0 || removed.length > 0 || changed.length > 0,
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length,
      totalChanges: added.length + removed.length + changed.length,
    },
    changes: {
      addedPaths: added,
      removedPaths: removed,
      changedPaths: changed,
    },
  };
}

function normalizeValidationScope(scopeInput) {
  if (!isPlainObject(scopeInput)) {
    throw new StudioCatalogError('scope must be an object', 'VALIDATION_SCOPE_INVALID', 400);
  }

  const itemId = normalizeString(scopeInput.itemId);
  if (!itemId) {
    throw new StudioCatalogError('scope.itemId is required', 'VALIDATION_SCOPE_INVALID', 400);
  }
  if (itemId.length < 2 || itemId.length > 128) {
    throw new StudioCatalogError('scope.itemId must be 2-128 characters', 'VALIDATION_SCOPE_INVALID', 400);
  }

  const version = normalizeString(scopeInput.version);
  if (scopeInput.version !== undefined && !version) {
    throw new StudioCatalogError('scope.version must be a non-empty string', 'VALIDATION_SCOPE_INVALID', 400);
  }

  return {
    ...scopeInput,
    itemId,
    ...(version ? { version } : {}),
  };
}

async function resolveValidationTargetRevision({ domain, tenantId, scope }) {
  if (scope.version) {
    return getCatalogRevisionByVersion({
      domain,
      tenantId,
      itemId: scope.itemId,
      version: scope.version,
    });
  }

  const revisions = await listCatalogRevisions({
    domain,
    tenantId,
    itemId: scope.itemId,
    status: 'draft',
    limit: 1,
    offset: 0,
  });

  if (!Array.isArray(revisions?.data) || revisions.data.length === 0) {
    return null;
  }
  return revisions.data[0];
}

async function writeAuditEvent({
  authContext,
  tenantId,
  action,
  targetType,
  targetId,
  beforeState,
  afterState,
  metadata,
}) {
  await insertAuditLog({
    actorUserId: resolveActorUserId(authContext),
    tenantId,
    action,
    targetType,
    targetId,
    beforeState,
    afterState,
    metadata: metadata || {},
  });
}

function getCatalogEditPermission(domain) {
  const config = getDomainConfig(domain);
  if (!config) {
    throw new StudioCatalogError('Invalid catalog domain', 'CATALOG_DOMAIN_INVALID', 400);
  }
  return config.editPermission;
}

async function previewDatasourceStructureForAdmin({ body }) {
  const manifest = ensureManifest(body?.manifest);
  const checks = buildDomainValidationChecks('datasource', manifest);
  const failedChecks = getFailedChecks(checks);
  const mappings = collectDatasourceFieldMappings(manifest);
  const sourceId = normalizeString(manifest.id || manifest.sourceId) || 'datasource';
  const displayName = normalizeString(manifest.name || manifest.label || manifest.labelKey) || sourceId;
  const requiredPermissions = uniqueStrings(manifest.requiredPermissions);

  return {
    sourceId,
    displayName,
    requiredPermissions,
    validation: {
      status: failedChecks.length === 0 ? 'passed' : 'failed',
      failedChecks: failedChecks.map((check) => check.name),
      checks,
    },
    summary: {
      totalFields: mappings.fieldCatalog.length,
      mappedFieldCount: mappings.mappedFieldCount,
      mappedPathCount: mappings.pathCatalog.length,
      duplicatePathCount: mappings.duplicatePathCount,
      invalidFieldCount: mappings.invalidFieldCount,
    },
    fieldCatalog: mappings.fieldCatalog,
    pathCatalog: mappings.pathCatalog,
    tree: buildDatasourcePathTree(mappings.pathCatalog),
    sourceContextPreview: buildDatasourceSourceContextPreview(manifest, mappings.pathCatalog),
  };
}

async function previewDatasourceDataForAdmin({ body }) {
  const manifest = ensureManifest(body?.manifest);
  const limit = normalizePreviewLimit(body?.limit, 5);
  const statuses = normalizeStatusList(
    body?.statuses !== undefined ? body.statuses : body?.status,
  );
  const includeSourceRecord = body?.includeSourceRecord === true;
  const mappings = collectDatasourceFieldMappings(manifest);

  if (!db.isConnected()) {
    throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
  }

  try {
    const params = [];
    let whereClause = 'WHERE 1=1';

    if (statuses.length > 0) {
      params.push(statuses);
      whereClause += ` AND m.status = ANY($${params.length}::text[])`;
    }

    params.push(limit);
    const limitPlaceholder = `$${params.length}`;

    const query = `
      SELECT m.*,
             row_to_json(ht.*) AS homeTeam,
             row_to_json(at.*) AS awayTeam
      FROM matches m
      LEFT JOIN teams ht ON m.home_team_id = ht.id
      LEFT JOIN teams at ON m.away_team_id = at.id
      ${whereClause}
      ORDER BY m.match_date DESC
      LIMIT ${limitPlaceholder}
    `;

    const result = await db.query(query, params);
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    const previewRows = rows.map((row, index) => {
      const record = mapMatchRowToDatasourcePreviewRecord(row);
      const values = {};

      mappings.fieldCatalog.forEach((field) => {
        values[field.fieldId] = resolveDatasourceFieldPreviewValue(record, field);
      });

      return {
        rowIndex: index + 1,
        matchId: record.id,
        league: record.league,
        status: record.status,
        matchDate: record.date,
        values,
        ...(includeSourceRecord ? { sourceRecord: record } : {}),
      };
    });

    return {
      source: 'server-db',
      sampledAt: new Date().toISOString(),
      filters: {
        limit,
        statuses,
      },
      summary: {
        rowCount: previewRows.length,
        fieldCount: mappings.fieldCatalog.length,
        pathCount: mappings.pathCatalog.length,
      },
      fieldCatalog: mappings.fieldCatalog,
      rows: previewRows,
    };
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function previewAgentModelRunForAdmin({ body }) {
  const manifest = ensureManifest(body?.manifest);
  const checks = buildDomainValidationChecks('agent', manifest);
  const failedChecks = getFailedChecks(checks);
  if (failedChecks.length > 0) {
    throw new StudioCatalogError(
      'agent manifest validation failed before model preview',
      'CATALOG_PREVIEW_MANIFEST_INVALID',
      400,
      { checks },
    );
  }

  const localeInput = normalizeString(body?.locale) || 'en';
  const resolvedPrompt = resolveAgentPromptByLocale(manifest, localeInput);
  if (!resolvedPrompt.prompt) {
    throw new StudioCatalogError(
      'agent rolePrompt is required for model preview',
      'CATALOG_PREVIEW_MANIFEST_INVALID',
      400,
      { field: 'rolePrompt' },
    );
  }

  const inputText = normalizeString(body?.input || body?.userInput || body?.prompt)
    || 'Please provide a concise analysis for this test request.';
  const contextValue = body?.context;
  const context =
    typeof contextValue === 'string'
      ? normalizeJsonObjectText(contextValue, 'context')
      : normalizeObject(contextValue, 'context');
  const contextSummary = JSON.stringify(context, null, 2);

  const startTimeMs = Date.now();
  const completion = await callDeepSeekChatCompletion({
    model: body?.model,
    temperature: body?.temperature,
    maxTokens: body?.maxTokens,
    messages: [
      { role: 'system', content: resolvedPrompt.prompt },
      {
        role: 'user',
        content: [
          'Admin Studio agent test run request',
          `agentId: ${normalizeString(manifest.id) || 'unknown'}`,
          `agentName: ${normalizeString(manifest.name) || 'unknown'}`,
          `requestedLocale: ${localeInput}`,
          '',
          'runtimeContext (JSON):',
          contextSummary || '{}',
          '',
          'testInput:',
          inputText,
        ].join('\n'),
      },
    ],
  });
  const latencyMs = Date.now() - startTimeMs;

  return {
    provider: 'deepseek',
    model: completion.model,
    latencyMs,
    request: {
      locale: resolvedPrompt.locale,
      input: inputText,
      context,
    },
    output: {
      content: completion.content,
      finishReason: completion.finishReason,
    },
    usage: completion.usage,
    validation: {
      status: 'passed',
      checks,
    },
  };
}

async function previewSkillInvocationForAdmin({ body }) {
  const manifest = ensureManifest(body?.manifest);
  const checks = buildDomainValidationChecks('skill', manifest);
  const failedChecks = getFailedChecks(checks);
  if (failedChecks.length > 0) {
    throw new StudioCatalogError(
      'skill manifest validation failed before model preview',
      'CATALOG_PREVIEW_MANIFEST_INVALID',
      400,
      { checks },
    );
  }

  const payloadValue = body?.invocationPayload;
  const invocationPayload =
    typeof payloadValue === 'string'
      ? normalizeJsonObjectText(payloadValue, 'invocationPayload')
      : normalizeObject(payloadValue, 'invocationPayload');

  const requiredKeys = getSkillRequiredKeys(manifest);
  const payloadKeys = Object.keys(invocationPayload);
  const missingRequiredKeys = requiredKeys.filter(
    (requiredKey) => !Object.prototype.hasOwnProperty.call(invocationPayload, requiredKey),
  );
  const targetSkill = normalizeString(manifest?.runtime?.targetSkill);
  const warnings = [];
  if (!targetSkill) {
    warnings.push('runtime.targetSkill is empty');
  }
  if (missingRequiredKeys.length > 0) {
    warnings.push(`missing required payload keys: ${missingRequiredKeys.join(', ')}`);
  }

  const startTimeMs = Date.now();
  const completion = await callDeepSeekChatCompletion({
    model: body?.model,
    temperature: body?.temperature,
    maxTokens: body?.maxTokens,
    messages: [
      {
        role: 'system',
        content: [
          'You are a runtime skill invocation simulator.',
          'Return concise output with three sections:',
          '1) call_plan',
          '2) validation_risks',
          '3) expected_result_preview',
          'Keep response short and practical.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          'Admin Studio skill invocation preview request',
          `skillId: ${normalizeString(manifest.id) || 'unknown'}`,
          `declarationName: ${normalizeString(manifest?.declaration?.name) || 'unknown'}`,
          `targetSkill: ${targetSkill || 'unknown'}`,
          `requiredKeys: ${requiredKeys.join(', ') || '(none)'}`,
          `payloadKeys: ${payloadKeys.join(', ') || '(none)'}`,
          '',
          'invocationPayload (JSON):',
          JSON.stringify(invocationPayload, null, 2),
        ].join('\n'),
      },
    ],
  });
  const latencyMs = Date.now() - startTimeMs;

  return {
    provider: 'deepseek',
    model: completion.model,
    latencyMs,
    invocation: {
      targetSkill: targetSkill || null,
      requiredKeys,
      payloadKeys,
      missingRequiredKeys,
      warnings,
    },
    output: {
      content: completion.content,
      finishReason: completion.finishReason,
    },
    usage: completion.usage,
    validation: {
      status: 'passed',
      checks,
    },
  };
}

async function listCatalogEntriesForAdmin({ domain, query, authContext }) {
  try {
    const normalizedDomain = ensureDomain(domain);
    const tenantId = resolveTenantId(authContext, query?.tenantId);
    return await listCatalogEntries({
      domain: normalizedDomain,
      tenantId,
      status: query?.status,
      search: query?.search,
      limit: query?.limit,
      offset: query?.offset,
    });
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function createCatalogEntryForAdmin({ domain, body, authContext }) {
  const normalizedDomain = ensureDomain(domain);
  const tenantId = resolveTenantId(authContext, body?.tenantId);
  const itemId = ensureItemId(body?.itemId);
  const version = ensureVersion(body?.version);
  const status = ensureStatus(body?.status, 'draft');
  const channel = ensureChannel(body?.channel, 'internal');
  const manifest = ensureManifest(body?.manifest);
  const validationSummary = runStrictManifestValidationForWrite(normalizedDomain, manifest);
  const checksum = checksumManifest(manifest);

  try {
    const created = await createCatalogRevision({
      domain: normalizedDomain,
      tenantId,
      itemId,
      version,
      status,
      channel,
      manifest,
      checksum,
      validationSummary,
      createdByUserId: resolveActorUserId(authContext),
    });

    await writeAuditEvent({
      authContext,
      tenantId,
      action: 'studio.catalog.create',
      targetType: normalizedDomain,
      targetId: itemId,
      beforeState: null,
      afterState: created,
      metadata: { version },
    });

    return created;
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      throw new StudioCatalogError(
        'catalog item version already exists',
        'CATALOG_REVISION_CONFLICT',
        409,
      );
    }
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function listCatalogRevisionsForAdmin({ domain, itemId, query, authContext }) {
  const normalizedDomain = ensureDomain(domain);
  const normalizedItemId = ensureItemId(itemId);
  const tenantId = resolveTenantId(authContext, query?.tenantId);

  try {
    return await listCatalogRevisions({
      domain: normalizedDomain,
      tenantId,
      itemId: normalizedItemId,
      status: query?.status,
      channel: query?.channel,
      limit: query?.limit,
      offset: query?.offset,
    });
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function createCatalogRevisionForAdmin({ domain, itemId, body, authContext }) {
  const normalizedDomain = ensureDomain(domain);
  const normalizedItemId = ensureItemId(itemId);
  const tenantId = resolveTenantId(authContext, body?.tenantId);
  const version = ensureVersion(body?.version);
  const status = ensureStatus(body?.status, 'draft');
  const channel = ensureChannel(body?.channel, 'internal');
  const manifest = ensureManifest(body?.manifest);
  const validationSummary = runStrictManifestValidationForWrite(normalizedDomain, manifest);
  const checksum = checksumManifest(manifest);

  try {
    const existing = await getCatalogRevisionByVersion({
      domain: normalizedDomain,
      tenantId,
      itemId: normalizedItemId,
      version,
    });
    if (existing) {
      throw new StudioCatalogError(
        'catalog revision already exists',
        'CATALOG_REVISION_CONFLICT',
        409,
      );
    }

    const created = await createCatalogRevision({
      domain: normalizedDomain,
      tenantId,
      itemId: normalizedItemId,
      version,
      status,
      channel,
      manifest,
      checksum,
      validationSummary,
      createdByUserId: resolveActorUserId(authContext),
    });

    await writeAuditEvent({
      authContext,
      tenantId,
      action: 'studio.catalog.revision.create',
      targetType: normalizedDomain,
      targetId: normalizedItemId,
      beforeState: null,
      afterState: created,
      metadata: { version },
    });

    return created;
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function updateCatalogDraftRevisionForAdmin({ domain, itemId, version, body, authContext }) {
  const normalizedDomain = ensureDomain(domain);
  const normalizedItemId = ensureItemId(itemId);
  const normalizedVersion = ensureVersion(version);
  const tenantId = resolveTenantId(authContext, body?.tenantId);
  const manifest = ensureManifest(body?.manifest);
  const channel = body?.channel !== undefined
    ? ensureChannel(body?.channel, 'internal')
    : undefined;
  const validationSummary = runStrictManifestValidationForWrite(normalizedDomain, manifest);
  const checksum = checksumManifest(manifest);

  try {
    const existing = await getCatalogRevisionByVersion({
      domain: normalizedDomain,
      tenantId,
      itemId: normalizedItemId,
      version: normalizedVersion,
    });
    if (!existing) {
      throw new StudioCatalogError('catalog revision not found', 'CATALOG_REVISION_NOT_FOUND', 404);
    }
    if (existing.status !== 'draft') {
      throw new StudioCatalogError(
        'only draft revision can be updated',
        'CATALOG_DRAFT_NOT_EDITABLE',
        409,
      );
    }

    const updated = await updateCatalogRevisionByVersion({
      domain: normalizedDomain,
      tenantId,
      itemId: normalizedItemId,
      version: normalizedVersion,
      manifest,
      checksum,
      channel,
      validationSummary,
    });
    if (!updated) {
      throw new StudioCatalogError('catalog revision not found', 'CATALOG_REVISION_NOT_FOUND', 404);
    }

    await writeAuditEvent({
      authContext,
      tenantId,
      action: 'studio.catalog.draft.save',
      targetType: normalizedDomain,
      targetId: normalizedItemId,
      beforeState: existing,
      afterState: updated,
      metadata: {
        version: normalizedVersion,
      },
    });

    return updated;
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function getCatalogRevisionDiffForAdmin({ domain, itemId, query, authContext }) {
  const normalizedDomain = ensureDomain(domain);
  const normalizedItemId = ensureItemId(itemId);
  const tenantId = resolveTenantId(authContext, query?.tenantId);
  const fromVersion = ensureVersion(query?.fromVersion, 'fromVersion');
  const toVersion = ensureVersion(query?.toVersion, 'toVersion');

  if (fromVersion === toVersion) {
    throw new StudioCatalogError(
      'fromVersion and toVersion must be different',
      'CATALOG_DIFF_VERSION_INVALID',
      400,
    );
  }

  try {
    const fromRevision = await getCatalogRevisionByVersion({
      domain: normalizedDomain,
      tenantId,
      itemId: normalizedItemId,
      version: fromVersion,
    });
    const toRevision = await getCatalogRevisionByVersion({
      domain: normalizedDomain,
      tenantId,
      itemId: normalizedItemId,
      version: toVersion,
    });

    if (!fromRevision || !toRevision) {
      throw new StudioCatalogError(
        'catalog revision not found for diff',
        'CATALOG_DIFF_REVISION_NOT_FOUND',
        404,
        {
          missing: {
            fromVersion: !fromRevision,
            toVersion: !toRevision,
          },
        },
      );
    }

    return {
      domain: normalizedDomain,
      itemId: normalizedItemId,
      fromRevision: {
        version: fromRevision.version,
        status: fromRevision.status,
        channel: fromRevision.channel,
        checksum: fromRevision.checksum,
        updatedAt: fromRevision.updatedAt,
      },
      toRevision: {
        version: toRevision.version,
        status: toRevision.status,
        channel: toRevision.channel,
        checksum: toRevision.checksum,
        updatedAt: toRevision.updatedAt,
      },
      diff: buildManifestDiff(fromRevision.manifest || {}, toRevision.manifest || {}),
    };
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function publishCatalogRevisionForAdmin({ domain, itemId, body, authContext }) {
  const normalizedDomain = ensureDomain(domain);
  const normalizedItemId = ensureItemId(itemId);
  const tenantId = resolveTenantId(authContext, body?.tenantId);
  const version = ensureVersion(body?.version);
  const channel = ensureChannel(body?.channel, 'stable');
  const notes = normalizeString(body?.notes);
  const validationRunId = normalizeString(body?.validationRunId) || null;

  try {
    const targetRevision = await getCatalogRevisionByVersion({
      domain: normalizedDomain,
      tenantId,
      itemId: normalizedItemId,
      version,
    });
    if (!targetRevision) {
      throw new StudioCatalogError('catalog revision not found', 'CATALOG_REVISION_NOT_FOUND', 404);
    }
    ensureRevisionValidatedForPublish(targetRevision);

    const previousPublished = await getLatestPublishedRevision({
      domain: normalizedDomain,
      tenantId,
      itemId: normalizedItemId,
      channel,
    });

    await markPublishedRevisionAsDeprecated({
      domain: normalizedDomain,
      tenantId,
      itemId: normalizedItemId,
      channel,
    });

    const updatedRevision = await updateCatalogRevisionByVersion({
      domain: normalizedDomain,
      tenantId,
      itemId: normalizedItemId,
      version,
      status: 'published',
      channel,
      publishedAt: new Date(),
    });

    const releaseRecord = await createReleaseRecord({
      tenantId,
      domain: normalizedDomain,
      itemId: normalizedItemId,
      fromVersion: previousPublished?.version || null,
      toVersion: updatedRevision.version,
      channel,
      action: 'publish',
      status: 'succeeded',
      notes,
      validationRunId,
      triggeredByUserId: resolveActorUserId(authContext),
    });

    await writeAuditEvent({
      authContext,
      tenantId,
      action: 'studio.catalog.publish',
      targetType: normalizedDomain,
      targetId: normalizedItemId,
      beforeState: previousPublished,
      afterState: updatedRevision,
      metadata: {
        channel,
        releaseRecordId: releaseRecord.id,
      },
    });

    return releaseRecord;
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function rollbackCatalogRevisionForAdmin({ domain, itemId, body, authContext }) {
  const normalizedDomain = ensureDomain(domain);
  const normalizedItemId = ensureItemId(itemId);
  const tenantId = resolveTenantId(authContext, body?.tenantId);
  const targetVersion = ensureVersion(body?.targetVersion, 'targetVersion');
  const channel = ensureChannel(body?.channel, 'stable');
  const notes = normalizeString(body?.notes);
  const validationRunId = normalizeString(body?.validationRunId) || null;

  try {
    const targetRevision = await getCatalogRevisionByVersion({
      domain: normalizedDomain,
      tenantId,
      itemId: normalizedItemId,
      version: targetVersion,
    });
    if (!targetRevision) {
      throw new StudioCatalogError('target revision not found', 'CATALOG_REVISION_NOT_FOUND', 404);
    }

    const previousPublished = await getLatestPublishedRevision({
      domain: normalizedDomain,
      tenantId,
      itemId: normalizedItemId,
      channel,
    });

    await markPublishedRevisionAsDeprecated({
      domain: normalizedDomain,
      tenantId,
      itemId: normalizedItemId,
      channel,
    });

    const updatedRevision = await updateCatalogRevisionByVersion({
      domain: normalizedDomain,
      tenantId,
      itemId: normalizedItemId,
      version: targetVersion,
      status: 'published',
      channel,
      publishedAt: new Date(),
    });

    const releaseRecord = await createReleaseRecord({
      tenantId,
      domain: normalizedDomain,
      itemId: normalizedItemId,
      fromVersion: previousPublished?.version || null,
      toVersion: updatedRevision.version,
      channel,
      action: 'rollback',
      status: 'succeeded',
      notes,
      validationRunId,
      triggeredByUserId: resolveActorUserId(authContext),
    });

    await writeAuditEvent({
      authContext,
      tenantId,
      action: 'studio.catalog.rollback',
      targetType: normalizedDomain,
      targetId: normalizedItemId,
      beforeState: previousPublished,
      afterState: updatedRevision,
      metadata: {
        channel,
        releaseRecordId: releaseRecord.id,
      },
    });

    return releaseRecord;
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function runValidationForAdmin({ body, authContext }) {
  const runType = normalizeString(body?.runType);
  const domain = ensureDomain(body?.domain);
  const scope = normalizeValidationScope(body?.scope);
  const tenantId = resolveTenantId(authContext, body?.tenantId);

  if (!ALLOWED_RUN_TYPES.has(runType)) {
    throw new StudioCatalogError('runType is invalid', 'VALIDATION_RUN_TYPE_INVALID', 400);
  }

  try {
    const queued = await createValidationRun({
      tenantId,
      runType,
      domain,
      scope,
      status: 'queued',
      logs: [],
      result: {},
      triggeredByUserId: resolveActorUserId(authContext),
      startedAt: null,
      finishedAt: null,
    });

    const startedAt = new Date();
    const logs = [
      {
        timestamp: startedAt.toISOString(),
        level: 'info',
        message: `Validation run started for ${domain}:${scope.itemId}`,
      },
    ];

    await updateValidationRun(queued.id, {
      status: 'running',
      startedAt,
      logs,
    });

    const checks = [];
    const targetRevision = await resolveValidationTargetRevision({
      domain,
      tenantId,
      scope,
    });

    if (!targetRevision) {
      checks.push({
        name: 'scope_revision_exists',
        status: 'failed',
        message: scope.version
          ? `Revision ${scope.itemId}@${scope.version} was not found`
          : `No draft revision found for ${scope.itemId}`,
      });
    } else {
      checks.push({
        name: 'scope_revision_exists',
        status: 'passed',
        message: `Resolved revision ${targetRevision.itemId}@${targetRevision.version}`,
      });
      const domainChecks = buildDomainValidationChecks(domain, targetRevision.manifest);
      checks.push(...domainChecks);
    }

    const failedChecks = getFailedChecks(checks);
    const finalStatus = failedChecks.length > 0 ? 'failed' : 'succeeded';
    const result = {
      summary:
        failedChecks.length > 0
          ? `Validation failed with ${failedChecks.length} blocking check(s)`
          : 'Validation checks passed',
      checks,
      target: targetRevision
        ? {
          itemId: targetRevision.itemId,
          version: targetRevision.version,
          status: targetRevision.status,
          channel: targetRevision.channel,
        }
        : {
          itemId: scope.itemId,
          version: scope.version || null,
        },
    };

    checks.forEach((check) => {
      logs.push({
        timestamp: new Date().toISOString(),
        level: check.status === 'failed' ? 'error' : 'info',
        message: `[${check.name}] ${check.message || check.status}`,
      });
    });

    if (targetRevision) {
      await updateCatalogRevisionByVersion({
        domain,
        tenantId,
        itemId: targetRevision.itemId,
        version: targetRevision.version,
        validationSummary: buildValidationSummary(checks, finalStatus, {
          mode: 'validation_run',
          runId: queued.id,
          runType,
        }),
      });
    }

    const finishedAt = new Date();
    logs.push({
      timestamp: finishedAt.toISOString(),
      level: finalStatus === 'succeeded' ? 'info' : 'error',
      message:
        finalStatus === 'succeeded'
          ? 'Validation run completed successfully'
          : 'Validation run failed',
    });

    const finished = await updateValidationRun(queued.id, {
      status: finalStatus,
      finishedAt,
      logs,
      result,
    });

    await writeAuditEvent({
      authContext,
      tenantId,
      action: 'studio.validation.run',
      targetType: domain,
      targetId: null,
      beforeState: null,
      afterState: {
        runId: finished.id,
        status: finished.status,
      },
      metadata: {
        runType,
        scope,
      },
    });

    return finished;
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function getValidationRunForAdmin({ runId }) {
  const normalizedRunId = normalizeString(runId);
  if (!normalizedRunId) {
    throw new StudioCatalogError('runId is required', 'VALIDATION_RUN_ID_REQUIRED', 400);
  }

  try {
    const run = await getValidationRunById(normalizedRunId);
    if (!run) {
      throw new StudioCatalogError('validation run not found', 'VALIDATION_RUN_NOT_FOUND', 404);
    }
    return run;
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

async function publishReleaseForAdmin({ body, authContext }) {
  const domain = ensureDomain(body?.domain);
  const itemId = ensureItemId(body?.itemId);
  return publishCatalogRevisionForAdmin({
    domain,
    itemId,
    body,
    authContext,
  });
}

async function rollbackReleaseForAdmin({ body, authContext }) {
  const domain = ensureDomain(body?.domain);
  const itemId = ensureItemId(body?.itemId);
  return rollbackCatalogRevisionForAdmin({
    domain,
    itemId,
    body: {
      ...body,
      targetVersion: body?.targetVersion,
    },
    authContext,
  });
}

async function listReleaseHistoryForAdmin({ query, authContext }) {
  const tenantId = resolveTenantId(authContext, query?.tenantId);
  const domain = normalizeString(query?.domain);
  const channel = normalizeString(query?.channel);
  if (domain && !normalizeDomain(domain)) {
    throw new StudioCatalogError('domain is invalid', 'RELEASE_DOMAIN_INVALID', 400);
  }
  if (channel && !ALLOWED_CHANNELS.has(channel)) {
    throw new StudioCatalogError('channel is invalid', 'RELEASE_CHANNEL_INVALID', 400);
  }

  try {
    return await listReleaseRecords({
      tenantId,
      domain: domain || undefined,
      channel: channel || undefined,
      limit: query?.limit,
      offset: query?.offset,
    });
  } catch (error) {
    if (String(error?.message || '').includes('Database not connected')) {
      throw new StudioCatalogError('Database not connected', 'CATALOG_DB_REQUIRED', 503);
    }
    throw error;
  }
}

module.exports = {
  StudioCatalogError,
  getCatalogEditPermission,
  previewDatasourceStructureForAdmin,
  previewDatasourceDataForAdmin,
  previewAgentModelRunForAdmin,
  previewSkillInvocationForAdmin,
  listCatalogEntriesForAdmin,
  createCatalogEntryForAdmin,
  listCatalogRevisionsForAdmin,
  createCatalogRevisionForAdmin,
  updateCatalogDraftRevisionForAdmin,
  getCatalogRevisionDiffForAdmin,
  publishCatalogRevisionForAdmin,
  rollbackCatalogRevisionForAdmin,
  runValidationForAdmin,
  getValidationRunForAdmin,
  publishReleaseForAdmin,
  rollbackReleaseForAdmin,
  listReleaseHistoryForAdmin,
};
