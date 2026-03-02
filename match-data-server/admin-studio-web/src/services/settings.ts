export interface AdminStudioSettings {
  matchDataServerUrl: string;
  matchDataApiKey: string;
}

const SETTINGS_KEY = 'matchflow_admin_studio_settings';

const DEFAULT_SETTINGS: AdminStudioSettings = {
  matchDataServerUrl: String(import.meta.env.VITE_MATCH_DATA_SERVER_URL || '').trim(),
  matchDataApiKey: String(import.meta.env.VITE_MATCH_DATA_API_KEY || '').trim(),
};

export function getSettings(): AdminStudioSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    return {
      ...DEFAULT_SETTINGS,
      ...(JSON.parse(raw) as Partial<AdminStudioSettings>),
    };
  } catch (error) {
    console.error('Failed to load admin studio settings', error);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(next: AdminStudioSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch (error) {
    console.error('Failed to save admin studio settings', error);
  }
}
