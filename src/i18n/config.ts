import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

type LocaleDictionary = Record<string, any>;
type LocaleModule = { default?: LocaleDictionary };

function isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(target: LocaleDictionary, source: LocaleDictionary): LocaleDictionary {
  const result: LocaleDictionary = { ...target };

  Object.entries(source).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      result[key] = value.slice();
      return;
    }

    if (isObject(value) && isObject(result[key])) {
      result[key] = deepMerge(result[key], value);
      return;
    }

    result[key] = value;
  });

  return result;
}

function extractLanguageFromLocalePath(modulePath: string): string | null {
  const normalized = modulePath.replace(/\\/g, '/');
  const match = normalized.match(/\/locales\/([^/]+)\//);
  if (!match?.[1]) return null;
  return match[1].trim();
}

function collectLocaleResources(): Record<string, { translation: LocaleDictionary }> {
  const modules = import.meta.glob('./locales/*/**/*.json', { eager: true }) as Record<
    string,
    LocaleModule
  >;
  const resources: Record<string, { translation: LocaleDictionary }> = {};

  Object.entries(modules).forEach(([modulePath, module]) => {
    const language = extractLanguageFromLocalePath(modulePath);
    const payload = module?.default;
    if (!language || !isObject(payload)) return;

    if (!resources[language]) {
      resources[language] = { translation: {} };
    }

    resources[language].translation = deepMerge(resources[language].translation, payload);
  });

  return resources;
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: collectLocaleResources(),
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh'],
    load: 'languageOnly',
    returnNull: false,
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
