import type { ThemeMode } from './settings';

const THEME_DARK_CLASS = 'theme-dark';
const THEME_LIGHT_CLASS = 'theme-light';

function getThemeClass(theme: ThemeMode): string {
  return theme === 'light' ? THEME_LIGHT_CLASS : THEME_DARK_CLASS;
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  const body = document.body;
  const nextThemeClass = getThemeClass(theme);
  const colorScheme = theme === 'light' ? 'light' : 'dark';

  root.classList.remove(THEME_DARK_CLASS, THEME_LIGHT_CLASS);
  root.classList.add(nextThemeClass);
  root.style.colorScheme = colorScheme;

  if (body) {
    body.classList.remove(THEME_DARK_CLASS, THEME_LIGHT_CLASS);
    body.classList.add(nextThemeClass);
    body.style.colorScheme = colorScheme;
  }
}
