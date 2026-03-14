import { describe, expect, it } from 'vitest';
import { shouldNavigateCommandCenterActionResult } from '@/src/pages/command/useCommandCenterState';

describe('shouldNavigateCommandCenterActionResult', () => {
  it('navigates by default when the manager action result includes a navigation target', () => {
    expect(
      shouldNavigateCommandCenterActionResult({
        navigation: {
          route: '/subject/football/match_1',
          state: {
            importedData: {
              id: 'match_1',
            },
            autoStartAnalysis: true,
            autoStartSourceText: 'analyze match_1 now',
          },
        },
      }),
    ).toBe(true);
  });

  it('does not navigate when no navigation target is present', () => {
    expect(
      shouldNavigateCommandCenterActionResult({
        navigation: undefined,
      }),
    ).toBe(false);
  });

  it('allows callers to suppress navigation explicitly', () => {
    expect(
      shouldNavigateCommandCenterActionResult(
        {
          navigation: {
            route: '/subject/football/match_1',
            state: {
              importedData: {
                id: 'match_1',
              },
              autoStartAnalysis: true,
              autoStartSourceText: 'analyze match_1 now',
            },
          },
        },
        {
          navigateOnSuccess: false,
        },
      ),
    ).toBe(false);
  });
});
