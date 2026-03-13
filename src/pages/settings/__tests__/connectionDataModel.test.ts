import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/src/services/settings';
import { deriveConnectionDataModel } from '@/src/pages/settings/connectionDataModel';

describe('connection data model', () => {
  it('keeps the frozen child-page order and exposes AI/data fields directly in the current version', () => {
    const model = deriveConnectionDataModel({
      settings: {
        ...DEFAULT_SETTINGS,
        provider: 'openai_compatible',
        model: 'gpt-4o-mini',
        openaiCompatibleBaseUrl: 'https://api.openai.com/v1',
        matchDataServerUrl: 'http://localhost:3030',
      },
      language: 'zh',
    });

    expect(model.sections.map((section) => section.id)).toEqual([
      'status',
      'ai_service',
      'data_source',
    ]);
    expect(model.aiServiceSection.expanded).toBe(true);
    expect(model.dataSourceSection.expanded).toBe(true);
    expect(model.aiServiceSection.fields.map((field) => field.id)).toEqual([
      'provider',
      'model',
      'base_url',
      'api_key',
    ]);
    expect(model.dataSourceSection.fields.map((field) => field.id)).toEqual([
      'server_url',
      'api_key',
    ]);
  });
});
