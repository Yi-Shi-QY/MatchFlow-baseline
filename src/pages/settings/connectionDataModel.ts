import { translateText } from '@/src/i18n/translate';
import type { AppSettings } from '@/src/services/settings';

type ConnectionSectionId = 'status' | 'ai_service' | 'data_source';

interface ConnectionSectionModel {
  id: ConnectionSectionId;
  title: string;
}

export interface ConnectionFieldModel {
  id: 'provider' | 'model' | 'base_url' | 'api_key' | 'server_url';
  label: string;
  description: string;
}

export interface ConnectionStatusCardModel {
  title: string;
  description: string;
  aiStatusLabel: string;
  dataStatusLabel: string;
  lastCheckedLabel: string;
}

export interface ConnectionFormSectionModel {
  title: string;
  expanded: true;
  fields: ConnectionFieldModel[];
  testActionLabel: string;
}

export interface ConnectionDataModel {
  sections: ConnectionSectionModel[];
  statusCard: ConnectionStatusCardModel;
  aiServiceSection: ConnectionFormSectionModel;
  dataSourceSection: ConnectionFormSectionModel;
}

function tr(
  language: 'zh' | 'en',
  key: string,
  zh: string,
  en: string,
  options: Record<string, unknown> = {},
): string {
  return translateText(language, key, language === 'zh' ? zh : en, options);
}

function getAiStatusLabel(settings: AppSettings, language: 'zh' | 'en'): string {
  const hasCredential =
    settings.provider === 'gemini'
      ? settings.geminiApiKey.trim().length > 0
      : settings.provider === 'deepseek'
        ? settings.deepseekApiKey.trim().length > 0
        : settings.openaiCompatibleApiKey.trim().length > 0;

  return hasCredential
    ? tr(language, 'settings_connections.status.configured', '已配置', 'Configured')
    : tr(language, 'settings_connections.status.needs_setup', '待配置', 'Needs setup');
}

function getDataStatusLabel(settings: AppSettings, language: 'zh' | 'en'): string {
  const configured = settings.matchDataServerUrl.trim().length > 0;
  return configured
    ? tr(language, 'settings_connections.status.configured', '已配置', 'Configured')
    : tr(language, 'settings_connections.status.needs_setup', '待配置', 'Needs setup');
}

export function deriveConnectionDataModel(input: {
  settings: AppSettings;
  language: 'zh' | 'en';
  lastCheckedLabel?: string;
}): ConnectionDataModel {
  const { settings, language } = input;

  return {
    sections: [
      {
        id: 'status',
        title: tr(language, 'settings_connections.sections.status', '顶部统一状态卡', 'Status'),
      },
      {
        id: 'ai_service',
        title: tr(language, 'settings_connections.sections.ai_service', 'AI 服务', 'AI Service'),
      },
      {
        id: 'data_source',
        title: tr(language, 'settings_connections.sections.data_source', '数据源', 'Data Source'),
      },
    ],
    statusCard: {
      title: tr(language, 'settings_connections.status_card.title', '连接与数据', 'Connections & Data'),
      description: tr(
        language,
        'settings_connections.status_card.description',
        '当前版本直接暴露 AI 与数据源配置，并支持即时连接检查。',
        'The current version exposes AI and data-source settings directly and supports instant connection checks.',
      ),
      aiStatusLabel: getAiStatusLabel(settings, language),
      dataStatusLabel: getDataStatusLabel(settings, language),
      lastCheckedLabel:
        input.lastCheckedLabel ||
        tr(language, 'settings_connections.status.not_checked', '尚未检查', 'Not checked yet'),
    },
    aiServiceSection: {
      title: tr(language, 'settings_connections.sections.ai_service', 'AI 服务', 'AI Service'),
      expanded: true,
      testActionLabel: tr(language, 'settings_connections.actions.test_ai', '检测 AI 连接', 'Test AI connection'),
      fields: [
        {
          id: 'provider',
          label: tr(language, 'settings_connections.fields.provider', 'Provider', 'Provider'),
          description: tr(
            language,
            'settings_connections.descriptions.provider',
            '当前使用的 AI 服务商。',
            'The active AI provider.',
          ),
        },
        {
          id: 'model',
          label: tr(language, 'settings_connections.fields.model', 'Model', 'Model'),
          description: tr(
            language,
            'settings_connections.descriptions.model',
            '当前用于正式回复的模型。',
            'The model used for formal responses.',
          ),
        },
        {
          id: 'base_url',
          label: tr(language, 'settings_connections.fields.base_url', 'Base URL', 'Base URL'),
          description: tr(
            language,
            'settings_connections.descriptions.base_url',
            '兼容接口的基础地址，当前版本可直接修改。',
            'The compatible API base URL exposed directly in this version.',
          ),
        },
        {
          id: 'api_key',
          label: tr(language, 'settings_connections.fields.api_key', 'AI API Key', 'AI API Key'),
          description: tr(
            language,
            'settings_connections.descriptions.api_key',
            '当前 provider 对应的密钥。',
            'The API key for the currently selected provider.',
          ),
        },
      ],
    },
    dataSourceSection: {
      title: tr(language, 'settings_connections.sections.data_source', '数据源', 'Data Source'),
      expanded: true,
      testActionLabel: tr(
        language,
        'settings_connections.actions.test_data',
        '检测数据连接',
        'Test data connection',
      ),
      fields: [
        {
          id: 'server_url',
          label: tr(language, 'settings_connections.fields.server_url', '服务地址', 'Server URL'),
          description: tr(
            language,
            'settings_connections.descriptions.server_url',
            '比赛与扩展服务的基础地址。',
            'The base URL for match and extension services.',
          ),
        },
        {
          id: 'api_key',
          label: tr(language, 'settings_connections.fields.data_api_key', '数据 API Key', 'Data API Key'),
          description: tr(
            language,
            'settings_connections.descriptions.data_api_key',
            '数据服务访问密钥。',
            'The API key used for the data service.',
          ),
        },
      ],
    },
  };
}
