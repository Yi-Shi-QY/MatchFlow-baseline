const crypto = require('crypto');
const extensionRepository = require('../repositories/extensionRepository');

const ALLOWED_KINDS = ['agent', 'skill', 'template'];
const ALLOWED_CHANNELS = ['stable', 'beta', 'internal'];
const ALLOWED_STATUSES = ['draft', 'published', 'deprecated'];
const ID_PATTERN = /^[a-z0-9_][a-z0-9_-]{1,63}$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function compareSemver(a, b) {
  const parse = (value) => {
    const [core, pre = ''] = String(value || '').split('-', 2);
    const [major, minor, patch] = core.split('.').map((n) => Number(n) || 0);
    return { major, minor, patch, pre };
  };

  const av = parse(a);
  const bv = parse(b);

  if (av.major !== bv.major) return av.major > bv.major ? 1 : -1;
  if (av.minor !== bv.minor) return av.minor > bv.minor ? 1 : -1;
  if (av.patch !== bv.patch) return av.patch > bv.patch ? 1 : -1;
  if (av.pre === bv.pre) return 0;
  if (!av.pre) return 1;
  if (!bv.pre) return -1;
  return av.pre > bv.pre ? 1 : -1;
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function checksumFromManifest(manifest) {
  return crypto.createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
}

function normalizeKind(input) {
  const kind = String(input || '').trim().toLowerCase();
  if (kind === 'agents') return 'agent';
  if (kind === 'skills') return 'skill';
  if (kind === 'templates') return 'template';
  return kind;
}

function normalizeChannel(input, fallback = 'stable') {
  const normalized = String(input || '').trim().toLowerCase();
  return ALLOWED_CHANNELS.includes(normalized) ? normalized : fallback;
}

function normalizeStatus(input, fallback = 'draft') {
  const normalized = String(input || '').trim().toLowerCase();
  return ALLOWED_STATUSES.includes(normalized) ? normalized : fallback;
}

function normalizeStringArray(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function validateManifest(manifest) {
  const errors = [];

  if (!manifest || typeof manifest !== 'object') {
    errors.push('manifest must be an object');
    return errors;
  }

  const kind = normalizeKind(manifest.kind);
  if (!ALLOWED_KINDS.includes(kind)) {
    errors.push('manifest.kind must be one of agent|skill|template');
  }

  if (typeof manifest.id !== 'string' || !ID_PATTERN.test(manifest.id)) {
    errors.push('manifest.id is invalid');
  }

  if (typeof manifest.version !== 'string' || !SEMVER_PATTERN.test(manifest.version)) {
    errors.push('manifest.version must follow semver x.y.z');
  }

  if (typeof manifest.name !== 'string' || manifest.name.trim().length === 0) {
    errors.push('manifest.name is required');
  }

  if (typeof manifest.description !== 'string' || manifest.description.trim().length === 0) {
    errors.push('manifest.description is required');
  }

  if (kind === 'agent') {
    const rolePrompt = manifest.rolePrompt;
    if (!rolePrompt || typeof rolePrompt !== 'object') {
      errors.push('agent.rolePrompt is required');
    } else {
      if (typeof rolePrompt.en !== 'string' || rolePrompt.en.trim().length === 0) {
        errors.push('agent.rolePrompt.en is required');
      }
      if (typeof rolePrompt.zh !== 'string' || rolePrompt.zh.trim().length === 0) {
        errors.push('agent.rolePrompt.zh is required');
      }
    }
  }

  if (kind === 'skill') {
    if (!manifest.declaration || typeof manifest.declaration !== 'object') {
      errors.push('skill.declaration is required');
    } else if (
      typeof manifest.declaration.name !== 'string' ||
      manifest.declaration.name.trim().length === 0
    ) {
      errors.push('skill.declaration.name is required');
    }

    if (!manifest.runtime || typeof manifest.runtime !== 'object') {
      errors.push('skill.runtime is required');
    } else {
      if (manifest.runtime.mode !== 'builtin_alias') {
        errors.push("skill.runtime.mode must be 'builtin_alias'");
      }
      if (
        typeof manifest.runtime.targetSkill !== 'string' ||
        manifest.runtime.targetSkill.trim().length === 0
      ) {
        errors.push('skill.runtime.targetSkill is required');
      }
    }
  }

  if (kind === 'template') {
    if (typeof manifest.rule !== 'string' || manifest.rule.trim().length === 0) {
      errors.push('template.rule is required');
    }
    if (!Array.isArray(manifest.segments) || manifest.segments.length === 0) {
      errors.push('template.segments must be a non-empty array');
    } else {
      manifest.segments.forEach((segment, index) => {
        if (!segment || typeof segment !== 'object') {
          errors.push(`template.segments[${index}] must be an object`);
          return;
        }
        if (
          typeof segment.agentType !== 'string' ||
          segment.agentType.trim().length === 0
        ) {
          errors.push(`template.segments[${index}].agentType is required`);
        }
        if (
          typeof segment?.title?.en !== 'string' ||
          segment.title.en.trim().length === 0
        ) {
          errors.push(`template.segments[${index}].title.en is required`);
        }
        if (
          typeof segment?.title?.zh !== 'string' ||
          segment.title.zh.trim().length === 0
        ) {
          errors.push(`template.segments[${index}].title.zh is required`);
        }
        if (
          typeof segment?.focus?.en !== 'string' ||
          segment.focus.en.trim().length === 0
        ) {
          errors.push(`template.segments[${index}].focus.en is required`);
        }
        if (
          typeof segment?.focus?.zh !== 'string' ||
          segment.focus.zh.trim().length === 0
        ) {
          errors.push(`template.segments[${index}].focus.zh is required`);
        }
      });
    }
  }

  return errors;
}

function createRecordFromManifest(manifest, metadata = {}) {
  const kind = normalizeKind(manifest.kind);
  const extensionId = String(manifest.id).trim();
  const version = String(manifest.version).trim();
  const channel = normalizeChannel(metadata.channel, 'stable');
  const status = normalizeStatus(metadata.status, 'published');
  const now = new Date().toISOString();
  const publishedAt =
    metadata.publishedAt ||
    (status === 'published' ? now : null);
  const checksum = metadata.checksum || checksumFromManifest(manifest);

  return {
    kind,
    extensionId,
    version,
    name: String(manifest.name).trim(),
    description: String(manifest.description).trim(),
    manifest: cloneValue(manifest),
    channel,
    status,
    checksum,
    publishedAt,
    updatedAt: metadata.updatedAt || now,
  };
}

const defaultRecords = [
  createRecordFromManifest(
    {
      kind: 'agent',
      id: 'momentum_agent',
      version: '1.0.0',
      name: 'Momentum Agent',
      description:
        'Analyzes momentum swings for live matches using stats and market signals.',
      updatedAt: '2026-03-01T00:00:00.000Z',
      rolePrompt: {
        en: 'You are a momentum analyst. Track pressure swings, rhythm changes, and turning points.',
        zh: 'Use concise Chinese analysis tone when user language is Chinese.',
      },
      skills: ['calculator'],
      contextDependencies: ['overview', 'odds', 'stats'],
    },
    {
      channel: 'stable',
      status: 'published',
      publishedAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    },
  ),
  createRecordFromManifest(
    {
      kind: 'skill',
      id: 'select_plan_template_v2',
      version: '1.0.0',
      name: 'Template Selector V2',
      description: 'Alias skill that reuses built-in template selector.',
      updatedAt: '2026-03-01T00:00:00.000Z',
      declaration: {
        name: 'select_plan_template_v2',
        description: 'Select analysis template by source profile.',
        parameters: {
          type: 'object',
          properties: {
            templateType: { type: 'string', description: 'Template type or identifier.' },
            language: { type: 'string', enum: ['en', 'zh'] },
            includeAnimations: { type: 'boolean' },
          },
          required: ['templateType'],
        },
      },
      runtime: {
        mode: 'builtin_alias',
        targetSkill: 'select_plan_template',
      },
    },
    {
      channel: 'stable',
      status: 'published',
      publishedAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    },
  ),
  createRecordFromManifest(
    {
      kind: 'template',
      id: 'live_market_pro',
      version: '1.0.0',
      name: 'Live Market Pro',
      description: 'Live match workflow with momentum and odds reaction focus.',
      updatedAt: '2026-03-01T00:00:00.000Z',
      rule: 'Use for live matches with both rich stats and odds updates.',
      requiredAgents: ['overview', 'odds', 'momentum_agent', 'prediction'],
      requiredSkills: ['select_plan_template_v2'],
      segments: [
        {
          title: { en: 'Live Overview', zh: 'Sai Shi Gai Kuang' },
          focus: {
            en: 'Summarize game state and key turning points.',
            zh: 'Zongjie dangqian ju shi he guanjian zhuan zhe',
          },
          animationType: 'scoreboard',
          agentType: 'overview',
          contextMode: 'independent',
        },
        {
          title: { en: 'Momentum Lens', zh: 'Jie Zou Dong Liang' },
          focus: {
            en: 'Track pressure waves and control shifts.',
            zh: 'Genzong yali bo dong yu kongzhi zhuanyi',
          },
          animationType: 'heatmap',
          agentType: 'momentum_agent',
          contextMode: 'build_upon',
        },
        {
          title: { en: 'Market Reaction', zh: 'Pan Kou Fan Ying' },
          focus: {
            en: 'Interpret implied probability movement from odds.',
            zh: 'Jieshi pei lv yinhan gai lv de bianhua',
          },
          animationType: 'odds_shift',
          agentType: 'odds',
          contextMode: 'build_upon',
        },
        {
          title: { en: 'Final Projection', zh: 'Zui Zhong Yu Ce' },
          focus: {
            en: 'Provide final probabilities and risk notes.',
            zh: 'Geichu jieguo gailv yu fengxian tishi',
          },
          animationType: 'none',
          agentType: 'prediction',
          contextMode: 'all',
        },
      ],
    },
    {
      channel: 'stable',
      status: 'published',
      publishedAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    },
  ),
];

const memoryRecords = [...defaultRecords];

function filterMemoryRecords(filters = {}) {
  const kind = filters.kind ? normalizeKind(filters.kind) : null;
  const extensionId = filters.extensionId ? String(filters.extensionId).trim() : null;
  const version = filters.version ? String(filters.version).trim() : null;
  const channel = filters.channel ? normalizeChannel(filters.channel, '') : '';
  const statuses = Array.isArray(filters.statuses) && filters.statuses.length > 0
    ? filters.statuses.map((status) => normalizeStatus(status, status))
    : null;

  return memoryRecords.filter((record) => {
    if (kind && record.kind !== kind) return false;
    if (extensionId && record.extensionId !== extensionId) return false;
    if (version && record.version !== version) return false;
    if (channel && record.channel !== channel) return false;
    if (statuses && !statuses.includes(record.status)) return false;
    return true;
  });
}

function pickLatestVersion(records) {
  return records.reduce((best, current) => {
    if (!best) return current;
    return compareSemver(current.version, best.version) > 0 ? current : best;
  }, null);
}

async function resolveManifestFromDb(kind, extensionId, options = {}) {
  if (!extensionRepository.isConnected()) return null;

  const statuses =
    Array.isArray(options.statuses) && options.statuses.length > 0
      ? options.statuses
      : ['published'];
  const channel = options.channel || 'stable';

  if (options.version) {
    const row = await extensionRepository.getManifestByVersion(
      kind,
      extensionId,
      options.version,
    );
    if (!row) return null;
    if (channel && row.channel !== channel) return null;
    if (statuses.length > 0 && !statuses.includes(row.status)) return null;
    return row;
  }

  const rows = await extensionRepository.listManifestsByExtension(kind, extensionId, {
    channel,
    statuses,
  });
  if (!rows || rows.length === 0) return null;

  return rows.reduce((best, current) => {
    if (!best) return current;
    return compareSemver(current.version, best.version) > 0 ? current : best;
  }, null);
}

function mapDbRowToRecord(row) {
  if (!row) return null;
  return {
    kind: normalizeKind(row.kind),
    extensionId: row.extension_id,
    version: row.version,
    name: row.name,
    description: row.description,
    manifest: cloneValue(row.manifest_json),
    channel: row.channel,
    status: row.status,
    checksum: row.checksum,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
  };
}

async function getManifest(kindInput, extensionIdInput, options = {}) {
  const kind = normalizeKind(kindInput);
  const extensionId = String(extensionIdInput || '').trim();
  if (!ALLOWED_KINDS.includes(kind) || !extensionId) return null;

  try {
    const dbRow = await resolveManifestFromDb(kind, extensionId, options);
    if (dbRow) {
      return mapDbRowToRecord(dbRow);
    }
  } catch (error) {
    if (
      !String(error?.message || '').toLowerCase().includes('relation') ||
      !String(error?.message || '').toLowerCase().includes('extension_manifests')
    ) {
      console.warn('Failed to read extension manifest from DB, fallback to memory:', error.message);
    }
  }

  const records = filterMemoryRecords({
    kind,
    extensionId,
    version: options.version,
    channel: options.channel || 'stable',
    statuses:
      Array.isArray(options.statuses) && options.statuses.length > 0
        ? options.statuses
        : ['published'],
  });

  if (records.length === 0) return null;
  const selected = options.version ? records[0] : pickLatestVersion(records);
  return selected ? cloneValue(selected) : null;
}

async function listManifestRecords(options = {}) {
  const kind = options.kind ? normalizeKind(options.kind) : null;
  const extensionId = options.extensionId ? String(options.extensionId).trim() : null;
  const channel = options.channel ? normalizeChannel(options.channel, 'stable') : undefined;
  const statuses =
    Array.isArray(options.statuses) && options.statuses.length > 0
      ? options.statuses.map((status) => normalizeStatus(status, status))
      : undefined;

  try {
    if (extensionRepository.isConnected()) {
      const rows = await extensionRepository.listManifests({
        kind: kind || undefined,
        extensionId: extensionId || undefined,
        channel,
        statuses,
        limit: options.limit,
        offset: options.offset,
      });
      return rows.map(mapDbRowToRecord).filter(Boolean);
    }
  } catch (error) {
    if (
      !String(error?.message || '').toLowerCase().includes('relation') ||
      !String(error?.message || '').toLowerCase().includes('extension_manifests')
    ) {
      console.warn('Failed to list extension manifests from DB, fallback to memory:', error.message);
    }
  }

  return filterMemoryRecords({
    kind,
    extensionId,
    channel,
    statuses,
  }).map((record) => cloneValue(record));
}

async function upsertManifest(input) {
  const manifest = input?.manifest && typeof input.manifest === 'object' ? input.manifest : input;
  if (!manifest || typeof manifest !== 'object') {
    throw new Error('manifest payload is required');
  }

  const errors = validateManifest(manifest);
  if (errors.length > 0) {
    throw new Error(errors.join('; '));
  }

  const record = createRecordFromManifest(manifest, {
    channel: input?.channel,
    status: input?.status,
    publishedAt: input?.publishedAt,
  });

  try {
    if (extensionRepository.isConnected()) {
      const row = await extensionRepository.upsertManifest(record);
      if (row) return mapDbRowToRecord(row);
    }
  } catch (error) {
    if (
      !String(error?.message || '').toLowerCase().includes('relation') ||
      !String(error?.message || '').toLowerCase().includes('extension_manifests')
    ) {
      throw error;
    }
  }

  const existingIndex = memoryRecords.findIndex(
    (item) =>
      item.kind === record.kind &&
      item.extensionId === record.extensionId &&
      item.version === record.version,
  );
  if (existingIndex >= 0) {
    memoryRecords[existingIndex] = record;
  } else {
    memoryRecords.push(record);
  }

  return cloneValue(record);
}

async function updateManifest(kindInput, extensionIdInput, versionInput, patchInput = {}) {
  const kind = normalizeKind(kindInput);
  const extensionId = String(extensionIdInput || '').trim();
  const version = String(versionInput || '').trim();
  if (!ALLOWED_KINDS.includes(kind)) throw new Error('Invalid extension kind');
  if (!ID_PATTERN.test(extensionId)) throw new Error('Invalid extension id');
  if (!SEMVER_PATTERN.test(version)) throw new Error('Invalid extension version');

  const patch = { ...patchInput };
  if (patch.manifest !== undefined) {
    const validationErrors = validateManifest(patch.manifest);
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('; '));
    }
    patch.checksum = checksumFromManifest(patch.manifest);
  }
  if (patch.status !== undefined) {
    patch.status = normalizeStatus(patch.status, patch.status);
  }
  if (patch.channel !== undefined) {
    patch.channel = normalizeChannel(patch.channel, patch.channel);
  }

  try {
    if (extensionRepository.isConnected()) {
      const row = await extensionRepository.patchManifest(kind, extensionId, version, patch);
      if (!row) return null;
      return mapDbRowToRecord(row);
    }
  } catch (error) {
    if (
      !String(error?.message || '').toLowerCase().includes('relation') ||
      !String(error?.message || '').toLowerCase().includes('extension_manifests')
    ) {
      throw error;
    }
  }

  const index = memoryRecords.findIndex(
    (item) =>
      item.kind === kind &&
      item.extensionId === extensionId &&
      item.version === version,
  );
  if (index < 0) return null;

  const target = memoryRecords[index];
  if (patch.name !== undefined) target.name = patch.name;
  if (patch.description !== undefined) target.description = patch.description;
  if (patch.manifest !== undefined) target.manifest = cloneValue(patch.manifest);
  if (patch.channel !== undefined) target.channel = patch.channel;
  if (patch.status !== undefined) target.status = patch.status;
  if (patch.checksum !== undefined) target.checksum = patch.checksum;
  if (patch.publishedAt !== undefined) target.publishedAt = patch.publishedAt;
  target.updatedAt = new Date().toISOString();

  return cloneValue(target);
}

async function publishManifest(kindInput, extensionIdInput, versionInput) {
  return updateManifest(kindInput, extensionIdInput, versionInput, {
    status: 'published',
    publishedAt: new Date().toISOString(),
  });
}

async function getTemplateRequirements(templateId) {
  const record = await getManifest('template', templateId, {
    statuses: ['published'],
    channel: 'stable',
  });

  if (!record || !record.manifest || typeof record.manifest !== 'object') {
    return { requiredAgents: [], requiredSkills: [] };
  }

  return {
    requiredAgents: normalizeStringArray(record.manifest.requiredAgents),
    requiredSkills: normalizeStringArray(record.manifest.requiredSkills),
  };
}

module.exports = {
  ALLOWED_KINDS,
  ALLOWED_CHANNELS,
  ALLOWED_STATUSES,
  normalizeKind,
  validateManifest,
  getManifest,
  listManifestRecords,
  upsertManifest,
  updateManifest,
  publishManifest,
  getTemplateRequirements,
};

