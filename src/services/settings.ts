export type AIProvider = 'gemini' | 'deepseek' | 'openai_compatible';
export type AgentModelMode = 'global' | 'config';

export interface AppSettings {
  provider: AIProvider;
  model: string;
  agentModelMode: AgentModelMode;
  deepseekApiKey: string;
  geminiApiKey: string;
  openaiCompatibleBaseUrl: string;
  openaiCompatibleApiKey: string;
  matchDataServerUrl: string;
  matchDataApiKey: string;
  language: 'en' | 'zh';
  enableBackgroundMode: boolean;
  enableAutonomousPlanning: boolean;
}

const SETTINGS_KEY = 'matchflow_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'gemini',
  model: 'gemini-3-flash-preview',
  agentModelMode: 'global',
  deepseekApiKey: '',
  geminiApiKey: '',
  openaiCompatibleBaseUrl: 'https://api.openai.com/v1',
  openaiCompatibleApiKey: '',
  matchDataServerUrl: '',
  matchDataApiKey: '',
  language: 'en',
  enableBackgroundMode: false,
  enableAutonomousPlanning: false,
};

export function getSettings(): AppSettings {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (data) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}
