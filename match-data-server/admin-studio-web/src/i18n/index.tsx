import React from 'react';
import {
  ADMIN_STUDIO_SETTINGS_UPDATED_EVENT,
  getSettings,
  saveSettings,
  type AdminStudioLanguage,
} from '@/src/services/settings';

interface I18nContextValue {
  language: AdminStudioLanguage;
  setLanguage: (next: AdminStudioLanguage) => void;
  t: (en: string, zh?: string) => string;
}

const I18nContext = React.createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = React.useState<AdminStudioLanguage>(() => getSettings().language);

  React.useEffect(() => {
    const handleSettingsUpdated = () => {
      setLanguageState(getSettings().language);
    };
    window.addEventListener(ADMIN_STUDIO_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    return () => {
      window.removeEventListener(ADMIN_STUDIO_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    };
  }, []);

  const setLanguage = React.useCallback((next: AdminStudioLanguage) => {
    saveSettings({ language: next });
    setLanguageState(next);
  }, []);

  const t = React.useCallback(
    (en: string, zh?: string) => {
      if (language === 'zh') {
        return zh || en;
      }
      return en;
    },
    [language],
  );

  const value = React.useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = React.useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
}

