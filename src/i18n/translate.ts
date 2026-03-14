import i18n from './config';

export type UiLanguage = 'zh' | 'en';

export function translateText(
  language: UiLanguage,
  key: string,
  defaultValue: string,
  options: Record<string, unknown> = {},
): string {
  return String(
    i18n.t(key, {
      lng: language,
      defaultValue,
      ...options,
    }),
  );
}
