# MatchFlow Development Guide

This guide covers local development, debugging, and packaging.

## 1. Prerequisites

- Node.js 18+
- npm
- Android Studio (for Android build)
- Xcode (for iOS build on macOS)

## 2. Local Web Development

Install dependencies:

```bash
npm install
```

Start dev server:

```bash
npm run dev
```

Type check:

```bash
npm run lint
```

Build production web bundle:

```bash
npm run build
```

## 3. Capacitor Workflow

Sync web assets to native projects:

```bash
npm run cap:sync
```

Generate icons/splash from `assets/`:

```bash
npm run cap:assets
```

Open native projects:

```bash
npx cap open android
npx cap open ios
```

## 4. Environment Variables

Create `.env` at repo root if needed:

```env
GEMINI_API_KEY=your_key_here
```

You can also configure keys inside app Settings UI.

## 5. Match Data Server

Optional backend is located at `match-data-server/`.

Run server locally:

```bash
cd match-data-server
npm install
npm start
```

More details:

- `match-data-server/DEPLOY.md`
- `match-data-server/DATABASE_GUIDE.md`

## 6. Troubleshooting

- If model call fails with network error:
  - Check API key and endpoint.
  - Check CORS on provider endpoint.
- If match list is empty:
  - Verify Settings: `matchDataServerUrl` / `matchDataApiKey`.
  - App will fallback to mock matches if server is unavailable.
- If native build has stale assets:
  - Run `npm run build` then `npm run cap:sync`.
