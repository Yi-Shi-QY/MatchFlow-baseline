import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/src/services/settings';
import { deriveDiagnosticsModel } from '@/src/pages/settings/diagnosticsModel';

describe('diagnostics model', () => {
  it('keeps the formal diagnostics sections and excludes dev-only options from the formal model', () => {
    const model = deriveDiagnosticsModel({
      settings: DEFAULT_SETTINGS,
      language: 'zh',
    });

    expect(model.sections.map((section) => section.id)).toContain('maintenance');
    expect(model.sections.map((section) => section.id)).toContain('extensions_sync');
    expect(model.sections.map((section) => section.id)).not.toContain('dev_options');
  });
});
