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

function getAiStatusLabel(settings: AppSettings, language: 'zh' | 'en'): string {
  const hasCredential =
    settings.provider === 'gemini'
      ? settings.geminiApiKey.trim().length > 0
      : settings.provider === 'deepseek'
        ? settings.deepseekApiKey.trim().length > 0
        : settings.openaiCompatibleApiKey.trim().length > 0;

  if (language === 'zh') {
    return hasCredential ? '已配置' : '待配置';
  }
  return hasCredential ? 'Configured' : 'Needs setup';
}

function getDataStatusLabel(settings: AppSettings, language: 'zh' | 'en'): string {
  const configured = settings.matchDataServerUrl.trim().length > 0;
  if (language === 'zh') {
    return configured ? '已配置' : '待配置';
  }
  return configured ? 'Configured' : 'Needs setup';
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
        title: language === 'zh' ? '顶部统一状态卡' : 'Status',
      },
      {
        id: 'ai_service',
        title: language === 'zh' ? 'AI 服务' : 'AI Service',
      },
      {
        id: 'data_source',
        title: language === 'zh' ? '数据源' : 'Data Source',
      },
    ],
    statusCard: {
      title: language === 'zh' ? '连接与数据' : 'Connections & Data',
      description:
        language === 'zh'
          ? '当前版本直接暴露 AI 与数据源配置，并支持即时连接检查。'
          : 'The current version exposes AI and data-source settings directly and supports instant connection checks.',
      aiStatusLabel: getAiStatusLabel(settings, language),
      dataStatusLabel: getDataStatusLabel(settings, language),
      lastCheckedLabel:
        input.lastCheckedLabel ||
        (language === 'zh' ? '尚未检查' : 'Not checked yet'),
    },
    aiServiceSection: {
      title: language === 'zh' ? 'AI 服务' : 'AI Service',
      expanded: true,
      testActionLabel: language === 'zh' ? '检测 AI 连接' : 'Test AI connection',
      fields: [
        {
          id: 'provider',
          label: language === 'zh' ? 'Provider' : 'Provider',
          description: language === 'zh' ? '当前使用的 AI 服务商。' : 'The active AI provider.',
        },
        {
          id: 'model',
          label: language === 'zh' ? 'Model' : 'Model',
          description: language === 'zh' ? '当前用于正式回复的模型。' : 'The model used for formal responses.',
        },
        {
          id: 'base_url',
          label: language === 'zh' ? 'Base URL' : 'Base URL',
          description:
            language === 'zh'
              ? '兼容接口的基础地址，当前版本直接可改。'
              : 'The compatible API base URL exposed directly in this version.',
        },
        {
          id: 'api_key',
          label: language === 'zh' ? 'API Key' : 'API Key',
          description:
            language === 'zh'
              ? '当前 provider 对应的密钥。'
              : 'The API key for the currently selected provider.',
        },
      ],
    },
    dataSourceSection: {
      title: language === 'zh' ? '数据源' : 'Data Source',
      expanded: true,
      testActionLabel: language === 'zh' ? '检测数据连接' : 'Test data connection',
      fields: [
        {
          id: 'server_url',
          label: language === 'zh' ? '服务地址' : 'Server URL',
          description:
            language === 'zh'
              ? '比赛与扩展服务的基础地址。'
              : 'The base URL for match and extension services.',
        },
        {
          id: 'api_key',
          label: language === 'zh' ? 'API Key' : 'API Key',
          description:
            language === 'zh'
              ? '数据服务访问密钥。'
              : 'The API key used for the data service.',
        },
      ],
    },
  };
}
