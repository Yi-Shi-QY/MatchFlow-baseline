export type WorkspaceNavId =
  | 'chat'
  | 'tasks'
  | 'sources'
  | 'history'
  | 'memory'
  | 'settings';

export interface WorkspaceNavItem {
  id: WorkspaceNavId;
  route: string;
  primary: boolean;
  iconKey: string;
  titleKey: string;
  hintKey: string;
}

const PRIMARY_WORKSPACE_NAV: readonly WorkspaceNavItem[] = [
  {
    id: 'chat',
    route: '/',
    primary: true,
    iconKey: 'chat',
    titleKey: 'workspace.nav.chat.title',
    hintKey: 'workspace.nav.chat.hint',
  },
  {
    id: 'tasks',
    route: '/tasks',
    primary: true,
    iconKey: 'tasks',
    titleKey: 'workspace.nav.tasks.title',
    hintKey: 'workspace.nav.tasks.hint',
  },
  {
    id: 'sources',
    route: '/sources',
    primary: true,
    iconKey: 'sources',
    titleKey: 'workspace.nav.sources.title',
    hintKey: 'workspace.nav.sources.hint',
  },
  {
    id: 'history',
    route: '/history',
    primary: true,
    iconKey: 'history',
    titleKey: 'workspace.nav.history.title',
    hintKey: 'workspace.nav.history.hint',
  },
  {
    id: 'memory',
    route: '/memory',
    primary: true,
    iconKey: 'memory',
    titleKey: 'workspace.nav.memory.title',
    hintKey: 'workspace.nav.memory.hint',
  },
  {
    id: 'settings',
    route: '/settings',
    primary: true,
    iconKey: 'settings',
    titleKey: 'workspace.nav.settings.title',
    hintKey: 'workspace.nav.settings.hint',
  },
] as const;

const SETTINGS_CHILD_ROUTES = ['/settings/connections', '/settings/diagnostics'] as const;
const SECONDARY_WORKSPACE_ROUTES = [...SETTINGS_CHILD_ROUTES, '/extensions'] as const;

function normalizeRoutePath(route: string): string {
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

export function getPrimaryWorkspaceNav(): WorkspaceNavItem[] {
  return PRIMARY_WORKSPACE_NAV.map((item) => ({ ...item }));
}

export function getSettingsChildRoutes(): string[] {
  return [...SETTINGS_CHILD_ROUTES];
}

export function isPrimaryWorkspaceRoute(route: string): boolean {
  const normalizedRoute = normalizeRoutePath(route);
  return PRIMARY_WORKSPACE_NAV.some((item) => normalizeRoutePath(item.route) === normalizedRoute);
}

export function isSettingsChildRoute(route: string): boolean {
  const normalizedRoute = normalizeRoutePath(route);
  return SETTINGS_CHILD_ROUTES.some((item) => normalizeRoutePath(item) === normalizedRoute);
}

export function isSecondaryWorkspaceRoute(route: string): boolean {
  const normalizedRoute = normalizeRoutePath(route);
  return SECONDARY_WORKSPACE_ROUTES.some((item) => normalizeRoutePath(item) === normalizedRoute);
}
