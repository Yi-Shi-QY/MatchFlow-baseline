const { API_KEY } = require('../config');
const { getTemplateRequirements } = require('./hubManifestService');

function hasNonEmptyObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

function parseBooleanEnv(value, fallback) {
  if (value == null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeStringArray(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function uniqueStrings(values) {
  return Array.from(new Set(normalizeStringArray(values)));
}

function buildCapabilities(match) {
  const hasStats = hasNonEmptyObject(match?.stats);
  const hasOdds = hasNonEmptyObject(match?.odds);
  const hasCustom = typeof match?.customInfo === 'string'
    ? match.customInfo.trim().length > 0
    : match?.customInfo != null;

  return { hasStats, hasOdds, hasCustom };
}

function withSourceMeta(match, source) {
  return {
    ...match,
    source,
    capabilities: buildCapabilities(match),
  };
}

function buildDefaultHubBaseUrl(req) {
  const envBase = typeof process.env.HUB_BASE_URL === 'string' ? process.env.HUB_BASE_URL.trim() : '';
  if (envBase) return envBase.replace(/\/+$/, '');
  if (!req) return '';
  return `${req.protocol}://${req.get('host')}`.replace(/\/+$/, '');
}

function resolveHubHint(req, overrideHub) {
  const fallbackAutoInstall = parseBooleanEnv(process.env.HUB_AUTO_INSTALL, true);
  const includeApiKeyByDefault = parseBooleanEnv(process.env.HUB_INCLUDE_API_KEY_HINT, false);
  const envApiKeyHint =
    typeof process.env.HUB_API_KEY_HINT === 'string' && process.env.HUB_API_KEY_HINT.trim().length > 0
      ? process.env.HUB_API_KEY_HINT.trim()
      : undefined;

  const baseUrl =
    typeof overrideHub?.baseUrl === 'string' && overrideHub.baseUrl.trim().length > 0
      ? overrideHub.baseUrl.trim().replace(/\/+$/, '')
      : buildDefaultHubBaseUrl(req);
  const autoInstall =
    typeof overrideHub?.autoInstall === 'boolean'
      ? overrideHub.autoInstall
      : fallbackAutoInstall;
  const apiKey =
    typeof overrideHub?.apiKey === 'string' && overrideHub.apiKey.trim().length > 0
      ? overrideHub.apiKey.trim()
      : envApiKeyHint || (includeApiKeyByDefault ? API_KEY : undefined);

  const hint = { baseUrl, autoInstall };
  if (apiKey) {
    hint.apiKey = apiKey;
  }

  return hint;
}

function deriveSourceSignals(matchData) {
  const selected = matchData?.sourceContext?.selectedSources;
  const selectedIds = Array.isArray(matchData?.sourceContext?.selectedSourceIds)
    ? new Set(matchData.sourceContext.selectedSourceIds.filter((id) => typeof id === 'string'))
    : new Set();
  const sourceCapabilities = matchData?.sourceContext?.capabilities || matchData?.capabilities || {};

  const hasStats =
    typeof sourceCapabilities.hasStats === 'boolean'
      ? sourceCapabilities.hasStats
      : hasNonEmptyObject(matchData?.stats);
  const hasOdds =
    typeof sourceCapabilities.hasOdds === 'boolean'
      ? sourceCapabilities.hasOdds
      : hasNonEmptyObject(matchData?.odds);
  const hasCustom =
    typeof sourceCapabilities.hasCustom === 'boolean'
      ? sourceCapabilities.hasCustom
      : typeof matchData?.customInfo === 'string'
        ? matchData.customInfo.trim().length > 0
        : matchData?.customInfo != null;
  const hasFundamental =
    typeof sourceCapabilities.hasFundamental === 'boolean'
      ? sourceCapabilities.hasFundamental
      : true;

  const wantsFundamental =
    typeof selected?.fundamental === 'boolean'
      ? selected.fundamental
      : selectedIds.has('fundamental')
        ? true
        : hasFundamental;
  const wantsMarket =
    typeof selected?.market === 'boolean'
      ? selected.market
      : selectedIds.has('market')
        ? true
        : hasOdds;
  const wantsCustom =
    typeof selected?.custom === 'boolean'
      ? selected.custom
      : selectedIds.has('custom')
        ? true
        : hasCustom;

  const status =
    typeof matchData?.status === 'string'
      ? matchData.status.toLowerCase()
      : typeof matchData?.sourceContext?.matchStatus === 'string'
        ? matchData.sourceContext.matchStatus.toLowerCase()
        : 'unknown';

  return {
    wantsFundamental,
    wantsMarket,
    wantsCustom,
    hasStats,
    hasOdds,
    hasCustom,
    status,
  };
}

async function recommendPlanning(matchData, req) {
  const planningInput = matchData?.sourceContext?.planning || matchData?.analysisConfig?.planning || {};
  const templateRuntimeOptions = {
    tenantId:
      typeof req?.authContext?.tenantId === 'string' && req.authContext.tenantId.trim().length > 0
        ? req.authContext.tenantId.trim()
        : undefined,
    channel: 'stable',
  };
  const overrideHub =
    planningInput?.hub && typeof planningInput.hub === 'object'
      ? planningInput.hub
      : undefined;
  const hub = resolveHubHint(req, overrideHub);

  const inputRequiredAgents = normalizeStringArray(planningInput?.requiredAgents);
  const inputRequiredSkills = normalizeStringArray(planningInput?.requiredSkills);

  const forcedMode =
    planningInput?.mode === 'autonomous' || planningInput?.mode === 'template'
      ? planningInput.mode
      : null;
  const forcedTemplateId =
    typeof planningInput?.templateId === 'string' && planningInput.templateId.trim().length > 0
      ? planningInput.templateId.trim()
      : typeof planningInput?.templateType === 'string' && planningInput.templateType.trim().length > 0
        ? planningInput.templateType.trim()
        : null;

  if (forcedMode === 'autonomous' && !forcedTemplateId) {
    return {
      mode: 'autonomous',
      requiredAgents: uniqueStrings(inputRequiredAgents),
      requiredSkills: uniqueStrings(inputRequiredSkills),
      hub,
      reason: 'forced_autonomous',
    };
  }

  if (forcedTemplateId) {
    const templateRequirements = await getTemplateRequirements(
      forcedTemplateId,
      templateRuntimeOptions,
    );
    return {
      mode: 'template',
      templateId: forcedTemplateId,
      requiredAgents: uniqueStrings([...templateRequirements.requiredAgents, ...inputRequiredAgents]),
      requiredSkills: uniqueStrings([...templateRequirements.requiredSkills, ...inputRequiredSkills]),
      hub,
      reason: 'forced_template',
    };
  }

  const signals = deriveSourceSignals(matchData);

  if (signals.wantsCustom && !signals.wantsFundamental && !signals.wantsMarket) {
    return {
      mode: 'autonomous',
      requiredAgents: uniqueStrings(inputRequiredAgents),
      requiredSkills: uniqueStrings(inputRequiredSkills),
      hub,
      reason: 'custom_only',
    };
  }

  let templateId = 'basic';
  let reason = 'minimal_data';

  if (signals.status === 'live' && signals.hasStats && signals.hasOdds) {
    templateId = 'live_market_pro';
    reason = 'live_stats_odds';
  } else if (signals.wantsMarket && !signals.wantsFundamental) {
    templateId = 'odds_focused';
    reason = 'market_only';
  } else if (signals.hasStats && signals.hasOdds) {
    templateId = 'comprehensive';
    reason = 'stats_and_odds';
  } else if (signals.hasOdds && !signals.hasStats) {
    templateId = 'odds_focused';
    reason = 'odds_without_stats';
  } else if (signals.hasStats) {
    templateId = 'standard';
    reason = signals.status === 'live' ? 'live_stats' : 'stats_only';
  }

  const templateRequirements = await getTemplateRequirements(templateId, templateRuntimeOptions);
  return {
    mode: 'template',
    templateId,
    requiredAgents: uniqueStrings([...templateRequirements.requiredAgents, ...inputRequiredAgents]),
    requiredSkills: uniqueStrings([...templateRequirements.requiredSkills, ...inputRequiredSkills]),
    hub,
    reason,
  };
}

async function buildAnalysisConfigPayload(matchData, req) {
  const planning = await recommendPlanning(matchData, req);
  const signals = deriveSourceSignals(matchData);
  const selectedSources = {
    fundamental: signals.wantsFundamental,
    market: signals.wantsMarket,
    custom: signals.wantsCustom,
  };
  const selectedSourceIds = Object.entries(selectedSources)
    .filter(([, enabled]) => !!enabled)
    .map(([sourceId]) => sourceId);

  return {
    sourceContext: {
      selectedSources,
      selectedSourceIds,
      capabilities: {
        hasFundamental: signals.wantsFundamental,
        hasStats: signals.hasStats,
        hasOdds: signals.hasOdds,
        hasCustom: signals.hasCustom,
      },
      matchStatus: signals.status,
      planning,
    },
  };
}

async function withAnalysisConfig(match, source, req) {
  const enriched = withSourceMeta(match, source);
  return {
    ...enriched,
    analysisConfig: {
      planning: await recommendPlanning(enriched, req),
    },
  };
}

module.exports = {
  buildCapabilities,
  withSourceMeta,
  recommendPlanning,
  buildAnalysisConfigPayload,
  withAnalysisConfig,
};
