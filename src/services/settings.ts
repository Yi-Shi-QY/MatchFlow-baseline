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
  rememberUserPreferences: boolean;
  requireMemoryConfirmation: boolean;
  enableDailyMemorySummary: boolean;
  showSuggestionReplies: boolean;
}

const SETTINGS_KEY_V3 = 'matchflow_settings_v3';
const LEGACY_SETTINGS_KEY_V2 = 'matchflow_settings_v2';
let settingsCache: AppSettings | null = null;

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
  rememberUserPreferences: true,
  requireMemoryConfirmation: true,
  enableDailyMemorySummary: true,
  showSuggestionReplies: true,
};

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

export function normalizeSettings(input: unknown): AppSettings {
  const defaults = resolveDefaultSettings();
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ...defaults };
  }

  const value = input as Partial<AppSettings> & {
    settingsMode?: unknown;
  };
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
    provider:
      value.provider === 'deepseek' || value.provider === 'openai_compatible'
        ? value.provider
        : 'gemini',
    agentModelMode: value.agentModelMode === 'config' ? 'config' : 'global',
    matchDataServerUrl: normalizedMatchDataServerUrl,
    matchDataApiKey: normalizedMatchDataApiKey,
    skillHttpAllowedHosts: Array.isArray(value.skillHttpAllowedHosts)
      ? value.skillHttpAllowedHosts.filter((host): host is string => typeof host === 'string')
      : [],
    language: value.language === 'zh' ? 'zh' : 'en',
    theme: value.theme === 'light' ? 'light' : 'dark',
    enableAutomation: Boolean(value.enableAutomation),
    enableBackgroundMode: Boolean(value.enableBackgroundMode),
    enableAutonomousPlanning: Boolean(value.enableAutonomousPlanning),
    rememberUserPreferences:
      typeof value.rememberUserPreferences === 'boolean'
        ? value.rememberUserPreferences
        : defaults.rememberUserPreferences,
    requireMemoryConfirmation:
      typeof value.requireMemoryConfirmation === 'boolean'
        ? value.requireMemoryConfirmation
        : defaults.requireMemoryConfirmation,
    enableDailyMemorySummary:
      typeof value.enableDailyMemorySummary === 'boolean'
        ? value.enableDailyMemorySummary
        : defaults.enableDailyMemorySummary,
    showSuggestionReplies:
      typeof value.showSuggestionReplies === 'boolean'
        ? value.showSuggestionReplies
        : defaults.showSuggestionReplies,
  };
}

function persistNormalizedSettings(normalized: AppSettings): void {
  settingsCache = normalized;
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(SETTINGS_KEY_V3, JSON.stringify(normalized));
}

export function getSettings(): AppSettings {
  if (settingsCache) {
    return { ...settingsCache };
  }

  if (typeof localStorage === 'undefined') {
    settingsCache = resolveDefaultSettings();
    return { ...settingsCache };
  }

  try {
    const currentData = localStorage.getItem(SETTINGS_KEY_V3);
    if (currentData) {
      const normalized = normalizeSettings(JSON.parse(currentData));
      persistNormalizedSettings(normalized);
      return { ...normalized };
    }

    const legacyData = localStorage.getItem(LEGACY_SETTINGS_KEY_V2);
    if (legacyData) {
      const normalized = normalizeSettings(JSON.parse(legacyData));
      persistNormalizedSettings(normalized);
      return { ...normalized };
    }
  } catch (e) {
    console.error('Failed to load settings', e);
  }

  settingsCache = resolveDefaultSettings();
  return { ...settingsCache };
}

export function saveSettings(settings: AppSettings) {
  const normalized = normalizeSettings(settings);

  if (typeof localStorage === 'undefined') {
    settingsCache = normalized;
    return;
  }

  try {
    persistNormalizedSettings(normalized);
  } catch (e) {
    console.error('Failed to save settings', e);
  }
}
