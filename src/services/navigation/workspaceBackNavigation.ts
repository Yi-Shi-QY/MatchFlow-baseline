import {
  isPrimaryWorkspaceRoute,
  isSecondaryWorkspaceRoute,
} from './workspaceNav';

export interface WorkspaceBackContext {
  returnRoute: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeWorkspaceRoutePath(route: string): string {
  const pathOnly = String(route || '')
    .trim()
    .split(/[?#]/, 1)[0]
    ?.trim();

  if (!pathOnly) {
    return '/';
  }

  const withLeadingSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  const normalized = withLeadingSlash.replace(/\/+$/, '');
  return normalized || '/';
}

function isMemoryDetailRoute(route: string): boolean {
  return /^\/memory\/[^/]+$/i.test(route);
}

function isSubjectDetailRoute(route: string): boolean {
  return /^\/subject\/[^/]+\/[^/]+$/i.test(route);
}

function normalizeBackContextRoute(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  return normalizeWorkspaceRoutePath(value);
}

export function readWorkspaceBackContext(state: unknown): WorkspaceBackContext | null {
  if (!isRecord(state) || !isRecord(state.backContext)) {
    return null;
  }

  const returnRoute = normalizeBackContextRoute(state.backContext.returnRoute);
  if (!returnRoute) {
    return null;
  }

  return {
    returnRoute,
  };
}

export function withWorkspaceBackContext(
  state: Record<string, unknown> | null | undefined,
  returnRoute: string | null | undefined,
): Record<string, unknown> {
  const baseState = isRecord(state) ? state : {};
  const normalizedReturnRoute = normalizeBackContextRoute(returnRoute);

  if (!normalizedReturnRoute) {
    return { ...baseState };
  }

  return {
    ...baseState,
    backContext: {
      returnRoute: normalizedReturnRoute,
    },
  };
}

export function resolveWorkspaceBackTarget(input: {
  pathname: string;
  state?: unknown;
}): string | null {
  const pathname = normalizeWorkspaceRoutePath(input.pathname);
  const backContext = readWorkspaceBackContext(input.state);

  if (pathname === '/') {
    return null;
  }

  if (pathname === '/extensions') {
    return '/settings/diagnostics';
  }

  if (isSecondaryWorkspaceRoute(pathname)) {
    return '/settings';
  }

  if (isMemoryDetailRoute(pathname)) {
    return backContext?.returnRoute || '/memory';
  }

  if (isSubjectDetailRoute(pathname)) {
    return backContext?.returnRoute || '/';
  }

  if (pathname === '/scan') {
    return backContext?.returnRoute || '/sources';
  }

  if (pathname === '/share') {
    return backContext?.returnRoute || '/';
  }

  if (isPrimaryWorkspaceRoute(pathname)) {
    return '/';
  }

  return backContext?.returnRoute || null;
}

export function shouldReplacePrimaryWorkspaceNavigation(
  currentPathname: string,
  targetRoute: string,
): boolean {
  const currentPath = normalizeWorkspaceRoutePath(currentPathname);
  const targetPath = normalizeWorkspaceRoutePath(targetRoute);

  if (!isPrimaryWorkspaceRoute(targetPath) || targetPath === '/') {
    return false;
  }

  return currentPath !== '/';
}
