export interface AppSettings {
  provider: 'gemini' | 'deepseek';
  model: string;
  deepseekApiKey: string;
  matchDataServerUrl: string;
  matchDataApiKey: string;
}

const SETTINGS_KEY = 'matchflow_settings';

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'gemini',
  model: 'gemini-3-flash-preview',
  deepseekApiKey: '',
  matchDataServerUrl: '',
  matchDataApiKey: '',
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
