import { describe, expect, it } from 'vitest';
import {
  normalizeWorkspaceRoutePath,
  resolveWorkspaceBackTarget,
  shouldReplacePrimaryWorkspaceNavigation,
  withWorkspaceBackContext,
} from '@/src/services/navigation/workspaceBackNavigation';

describe('workspaceBackNavigation', () => {
  it('normalizes route paths consistently', () => {
    expect(normalizeWorkspaceRoutePath('memory/123/')).toBe('/memory/123');
    expect(normalizeWorkspaceRoutePath('/settings?tab=general')).toBe('/settings');
  });

  it('returns the conversation route for primary workspace pages', () => {
    expect(
      resolveWorkspaceBackTarget({
        pathname: '/memory',
      }),
    ).toBe('/');

    expect(
      resolveWorkspaceBackTarget({
        pathname: '/automation',
      }),
    ).toBe('/');
  });

  it('returns the settings page for secondary settings routes', () => {
    expect(
      resolveWorkspaceBackTarget({
        pathname: '/settings/connections',
      }),
    ).toBe('/settings');
  });

  it('returns diagnostics for the extensions page', () => {
    expect(
      resolveWorkspaceBackTarget({
        pathname: '/extensions',
      }),
    ).toBe('/settings/diagnostics');
  });

  it('uses the provided source route for detail pages when available', () => {
    expect(
      resolveWorkspaceBackTarget({
        pathname: '/subject/football/match_1',
        state: withWorkspaceBackContext(
          {
            importedData: {
              id: 'match_1',
            },
          },
          '/history',
        ),
      }),
    ).toBe('/history');
  });

  it('falls back to the memory page for memory detail routes', () => {
    expect(
      resolveWorkspaceBackTarget({
        pathname: '/memory/memory_1',
      }),
    ).toBe('/memory');
  });

  it('falls back to sources for scan and conversation for share', () => {
    expect(
      resolveWorkspaceBackTarget({
        pathname: '/scan',
      }),
    ).toBe('/sources');

    expect(
      resolveWorkspaceBackTarget({
        pathname: '/share',
      }),
    ).toBe('/');
  });

  it('replaces primary workspace navigation once the user has left the conversation home', () => {
    expect(shouldReplacePrimaryWorkspaceNavigation('/', '/settings')).toBe(false);
    expect(shouldReplacePrimaryWorkspaceNavigation('/history', '/settings')).toBe(true);
    expect(shouldReplacePrimaryWorkspaceNavigation('/history', '/automation')).toBe(true);
    expect(shouldReplacePrimaryWorkspaceNavigation('/subject/football/match_1', '/memory')).toBe(
      true,
    );
    expect(shouldReplacePrimaryWorkspaceNavigation('/settings', '/settings/connections')).toBe(
      false,
    );
  });
});
