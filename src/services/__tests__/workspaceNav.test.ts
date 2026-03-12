import { describe, expect, it } from 'vitest';
import {
  getPrimaryWorkspaceNav,
  getSettingsChildRoutes,
  isPrimaryWorkspaceRoute,
} from '@/src/services/navigation/workspaceNav';

describe('workspace navigation contract', () => {
  it('exposes the frozen primary workspace navigation order', () => {
    expect(getPrimaryWorkspaceNav().map((item) => item.id)).toEqual([
      'chat',
      'tasks',
      'sources',
      'history',
      'memory',
      'settings',
    ]);
  });

  it('keeps settings child routes outside the primary navigation layer', () => {
    expect(getSettingsChildRoutes()).toEqual([
      '/settings/connections',
      '/settings/diagnostics',
    ]);
    expect(isPrimaryWorkspaceRoute('/settings/connections')).toBe(false);
    expect(isPrimaryWorkspaceRoute('/extensions')).toBe(false);
  });
});
