function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizePermissionList(authContext) {
  const permissions = Array.isArray(authContext?.permissions) ? authContext.permissions : [];
  return permissions.filter((permission) => typeof permission === 'string' && permission.length > 0);
}

function isLegacyAuth(authContext) {
  return authContext?.mode === 'legacy' || normalizePermissionList(authContext).includes('legacy:*');
}

function hasPermission(authContext, requiredPermission) {
  if (isLegacyAuth(authContext)) {
    return true;
  }

  const permissions = normalizePermissionList(authContext);
  if (
    permissions.includes(requiredPermission) ||
    permissions.includes('admin:*') ||
    permissions.includes('*')
  ) {
    return true;
  }

  const segments = String(requiredPermission).split(':');
  if (segments.length >= 3) {
    const scopeWildcard = `${segments[0]}:${segments[1]}:*`;
    if (permissions.includes(scopeWildcard)) {
      return true;
    }
  }

  return false;
}

function listScopedPermissions(authContext, scopePrefix) {
  if (isLegacyAuth(authContext)) {
    return ['*'];
  }

  const permissions = normalizePermissionList(authContext);
  const scopedValues = permissions
    .filter((permission) => permission.startsWith(scopePrefix))
    .map((permission) => permission.slice(scopePrefix.length))
    .filter((permission) => permission.length > 0);

  if (scopedValues.includes('*')) {
    return ['*'];
  }
  return Array.from(new Set(scopedValues));
}

function hasAnyScopedPermission(authContext, scopePrefix) {
  return listScopedPermissions(authContext, scopePrefix).length > 0;
}

function getAllowedDataSourceFlags(authContext) {
  if (isLegacyAuth(authContext)) {
    return {
      fundamental: true,
      market: true,
      custom: true,
    };
  }

  return {
    fundamental: hasPermission(authContext, 'datasource:use:fundamental'),
    market: hasPermission(authContext, 'datasource:use:market'),
    custom: hasPermission(authContext, 'datasource:use:custom'),
  };
}

function sanitizeMatchForPermissions(match, authContext) {
  const allowed = getAllowedDataSourceFlags(authContext);
  if (!allowed.fundamental) {
    return null;
  }

  const sanitized = isPlainObject(match) ? { ...match } : match;
  if (!isPlainObject(sanitized)) {
    return sanitized;
  }

  if (!allowed.market) {
    delete sanitized.odds;
  }
  if (!allowed.custom) {
    delete sanitized.customInfo;
  }

  if (isPlainObject(sanitized.sourceContext)) {
    const sourceContext = { ...sanitized.sourceContext };

    if (isPlainObject(sourceContext.selectedSources)) {
      sourceContext.selectedSources = {
        ...sourceContext.selectedSources,
        fundamental: !!allowed.fundamental && sourceContext.selectedSources.fundamental !== false,
        market: !!allowed.market && sourceContext.selectedSources.market === true,
        custom: !!allowed.custom && sourceContext.selectedSources.custom === true,
      };
    }

    if (Array.isArray(sourceContext.selectedSourceIds)) {
      sourceContext.selectedSourceIds = sourceContext.selectedSourceIds.filter((sourceId) => {
        if (sourceId === 'fundamental') return allowed.fundamental;
        if (sourceId === 'market') return allowed.market;
        if (sourceId === 'custom') return allowed.custom;
        return false;
      });
    }

    if (isPlainObject(sourceContext.capabilities)) {
      sourceContext.capabilities = {
        ...sourceContext.capabilities,
        hasFundamental:
          !!allowed.fundamental && sourceContext.capabilities.hasFundamental !== false,
        hasOdds: !!allowed.market && sourceContext.capabilities.hasOdds === true,
        hasCustom: !!allowed.custom && sourceContext.capabilities.hasCustom === true,
      };
    }

    sanitized.sourceContext = sourceContext;
  }

  return sanitized;
}

function canAccessTemplate(authContext, templateId) {
  if (isLegacyAuth(authContext)) {
    return true;
  }
  return hasPermission(authContext, `template:use:${templateId}`);
}

function canAccessHubManifest(authContext, kind, extensionId) {
  if (isLegacyAuth(authContext)) {
    return true;
  }

  if (kind === 'template') {
    return canAccessTemplate(authContext, extensionId);
  }

  if (kind === 'agent' || kind === 'skill') {
    return hasAnyScopedPermission(authContext, 'template:use:');
  }

  return false;
}

module.exports = {
  isLegacyAuth,
  hasPermission,
  listScopedPermissions,
  getAllowedDataSourceFlags,
  sanitizeMatchForPermissions,
  canAccessTemplate,
  canAccessHubManifest,
};
