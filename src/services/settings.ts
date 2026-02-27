export interface AppSettings {
  provider: 'gemini' | 'deepseek';
  model: string;
  deepseekApiKey: string;
  geminiApiKey: string;
  matchDataServerUrl: string;
  matchDataApiKey: string;
  language: 'en' | 'zh';
  enableBackgroundMode: boolean;
}

const SETTINGS_KEY = 'matchflow_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'gemini',
  model: 'gemini-3-flash-preview',
  deepseekApiKey: '',
  geminiApiKey: '',
  matchDataServerUrl: '',
  matchDataApiKey: '',
  language: 'en',
  enableBackgroundMode: false,
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
