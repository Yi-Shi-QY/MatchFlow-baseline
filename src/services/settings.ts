import {
  getConfiguredLocalFootballTestServerPreset,
  type LocalFootballTestEnv,
  type LocalFootballTestRuntime,
} from './localFootballTestServer';

export type AIProvider = 'gemini' | 'deepseek' | 'openai_compatible';
export type AgentModelMode = 'global' | 'config';
export type ThemeMode = 'dark' | 'light';

export interface AppSettings {
  provider: AIProvider;
  model: string;
  agentModelMode: AgentModelMode;
  activeDomainId: string;
  skillHttpAllowedHosts: string[];
  deepseekApiKey: string;
  geminiApiKey: string;
  openaiCompatibleBaseUrl: string;
  openaiCompatibleApiKey: string;
  matchDataServerUrl: string;
  matchDataApiKey: string;
  language: 'en' | 'zh';
  theme: ThemeMode;
  enableAutomation: boolean;
  enableBackgroundMode: boolean;
  enableAutonomousPlanning: boolean;
}

const SETTINGS_KEY = 'matchflow_settings_v2';
let settingsCache: AppSettings | null = null;

export function resolveDefaultSettings(input: {
  env?: LocalFootballTestEnv;
  runtime?: LocalFootballTestRuntime;
} = {}): AppSettings {
  const preset = getConfiguredLocalFootballTestServerPreset(input);
  return {
    ...DEFAULT_SETTINGS,
    matchDataServerUrl: preset?.matchDataServerUrl ?? DEFAULT_SETTINGS.matchDataServerUrl,
    matchDataApiKey: preset?.matchDataApiKey ?? DEFAULT_SETTINGS.matchDataApiKey,
  };
}

function normalizeSettings(input: unknown): AppSettings {
  const defaults = resolveDefaultSettings();
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ...defaults };
  }

  const value = input as Partial<AppSettings>;
  const normalizedMatchDataServerUrl =
    typeof value.matchDataServerUrl === 'string' && value.matchDataServerUrl.trim().length > 0
      ? value.matchDataServerUrl
      : defaults.matchDataServerUrl;
  const normalizedMatchDataApiKey =
    typeof value.matchDataApiKey === 'string' && value.matchDataApiKey.trim().length > 0
      ? value.matchDataApiKey
      : defaults.matchDataApiKey;

  return {
    ...defaults,
    ...value,
    matchDataServerUrl: normalizedMatchDataServerUrl,
    matchDataApiKey: normalizedMatchDataApiKey,
    skillHttpAllowedHosts: Array.isArray(value.skillHttpAllowedHosts)
      ? value.skillHttpAllowedHosts.filter((host): host is string => typeof host === 'string')
      : [],
    language: value.language === 'zh' ? 'zh' : 'en',
    theme: value.theme === 'light' ? 'light' : 'dark',
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'gemini',
  model: 'gemini-3-flash-preview',
  agentModelMode: 'global',
  activeDomainId: 'football',
  skillHttpAllowedHosts: [],
  deepseekApiKey: '',
  geminiApiKey: '',
  openaiCompatibleBaseUrl: 'https://api.openai.com/v1',
  openaiCompatibleApiKey: '',
  matchDataServerUrl: '',
  matchDataApiKey: '',
  language: 'en',
  theme: 'dark',
  enableAutomation: false,
  enableBackgroundMode: false,
  enableAutonomousPlanning: false,
};

export function getSettings(): AppSettings {
  if (settingsCache) {
    return { ...settingsCache };
  }

  if (typeof localStorage === 'undefined') {
    settingsCache = resolveDefaultSettings();
    return { ...settingsCache };
  }

  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (data) {
      settingsCache = normalizeSettings(JSON.parse(data));
      return { ...settingsCache };
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }

  settingsCache = resolveDefaultSettings();
  return { ...settingsCache };
}

export function saveSettings(settings: AppSettings) {
  if (typeof localStorage === 'undefined') {
    settingsCache = normalizeSettings(settings);
    return;
  }

  try {
    const normalized = normalizeSettings(settings);
    settingsCache = normalized;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}
