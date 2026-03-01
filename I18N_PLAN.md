# MatchFlow i18n Plan

## Goal

Keep multilingual behavior stable and prevent text encoding regressions.

## Current Baseline

- Active i18n entry: `src/i18n/config.ts`
- Legacy duplicate entry: `src/i18n/index.ts` now re-exports `config.ts`
- Active locale files:
  - `src/i18n/locales/en.json`
  - `src/i18n/locales/zh.json`

## Rules

1. Keep a single source of truth for locale loading (`config.ts`).
2. Do not introduce new locale variants (`en-US`, `zh-CN`) unless required.
3. All source/docs files must be UTF-8.
4. No hardcoded user-facing strings in pages/components where i18n key exists.

## Implementation Checklist

1. UI text keys
- Add/update keys in `en.json` and `zh.json`.
- Use `t('...')` in page/component code.

2. Agent text
- Ensure Chinese prompt strings are valid UTF-8.
- Keep output contracts (`<title>`, `<thought>`, `<summary>`) unchanged.

3. Validation
- Add CI scan to detect replacement char `U+FFFD`.
- Add optional mojibake keyword scan for common corruption patterns.

## Suggested CI Checks

- `npm run lint`
- JSON parse check for `src/i18n/locales/*.json`
- Encoding check script:
  - fail if file contains `\uFFFD`
  - fail if known mojibake patterns detected

## Migration Notes

- If you need new language support:
  1. Add new locale file.
  2. Extend `resources` in `src/i18n/config.ts`.
  3. Add selector in Settings page.
