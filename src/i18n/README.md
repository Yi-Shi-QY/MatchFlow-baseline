# i18n Structure

Locale resources are auto-discovered by `src/i18n/config.ts` using:

- `./locales/*/**/*.json`

All discovered JSON files are deep-merged into `translation` for each language.

## Directory layout

- `locales/<lang>/core/*.json`: app-level shared copy (`app`, `settings`)
- `locales/<lang>/features/*.json`: feature-level copy (`extensions`, `scan`, `share`)
- `locales/<lang>/pages/home/*.json`: home page copy, split by concern
- `locales/<lang>/pages/match/*.json`: match page copy, split by concern
- `locales/<lang>/domains/*.json`: domain display names (`domains.<id>.name`)
- `locales/<lang>/domainProfiles/*.json`: domain-specific home/status keys (`<domainId>.home.*`, `<domainId>.status.*`)

## Rules

- Keep each file focused on one concern.
- Every file must keep top-level i18n keys (for example `{ "match": { ... } }`).
- For new domain scaffolding, `scripts/scaffoldDomain.mjs` writes:
  - `locales/<lang>/domains/<id>.json`
  - `locales/<lang>/domainProfiles/<id>.json`
