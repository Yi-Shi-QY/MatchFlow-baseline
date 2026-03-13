import React from 'react';
import { useTranslation } from 'react-i18next';
import { listAnalysisDomains } from '@/src/services/domains/registry';
import {
  getSettings,
  saveSettings,
  type AppSettings,
} from '@/src/services/settings';
import { applyTheme } from '@/src/services/theme';
import {
  kickAutomationRuntime,
  scheduleNativeAutomationSync,
} from '@/src/services/automation';

export interface SettingsDomainOption {
  value: string;
  label: string;
}

export function useSettingsState(): {
  settings: AppSettings;
  domainOptions: SettingsDomainOption[];
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
} {
  const { i18n } = useTranslation();
  const [settings, setSettings] = React.useState<AppSettings>(() => getSettings());

  React.useEffect(() => {
    applyTheme(settings.theme);
    if (settings.language !== i18n.language) {
      i18n.changeLanguage(settings.language);
    }
  }, [i18n, settings.language, settings.theme]);

  const domainOptions = React.useMemo(
    () =>
      listAnalysisDomains().map((domain) => ({
        value: domain.id,
        label: domain.name,
      })),
    [],
  );

  const updateSetting = React.useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      const nextSettings = {
        ...settings,
        [key]: value,
      };
      saveSettings(nextSettings);
      setSettings(nextSettings);
      if (key === 'theme') {
        applyTheme(String(value) === 'light' ? 'light' : 'dark');
      }
      if (key === 'language' && typeof value === 'string' && value !== i18n.language) {
        i18n.changeLanguage(value);
      }
      kickAutomationRuntime('settings_saved');
      scheduleNativeAutomationSync('settings_saved');
    },
    [i18n, settings],
  );

  return {
    settings,
    domainOptions,
    updateSetting,
  };
}
