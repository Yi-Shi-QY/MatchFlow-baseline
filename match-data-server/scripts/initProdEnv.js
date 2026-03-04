const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const serverExamplePath = path.join(repoRoot, '.env.example');
const serverCurrentPath = path.join(repoRoot, '.env');
const serverProdPath = path.join(repoRoot, '.env.production');
const webProdPath = path.join(repoRoot, 'admin-studio-web', '.env.production');

function parseEnvText(text) {
  const map = {};
  text
    .split(/\r?\n/)
    .forEach((line) => {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (!match) {
        return;
      }
      const key = match[1];
      const value = match[2];
      map[key] = value;
    });
  return map;
}

function ensureFileText(filePath) {
  if (!fs.existsSync(filePath)) {
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function buildServerProductionEnv(templateText, currentValues) {
  const lines = templateText.split(/\r?\n/);
  return lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) {
      return line;
    }

    const key = match[1];
    let value = match[2];
    const currentValue = currentValues[key];
    if (typeof currentValue === 'string' && currentValue.length > 0) {
      value = currentValue;
    }

    if (key === 'NODE_ENV') {
      value = 'production';
    }

    if (key === 'CORS_ALLOWED_ORIGINS') {
      const normalized = String(value || '').trim();
      if (!normalized || normalized === '*') {
        value = 'https://admin.example.com';
      }
    }

    return `${key}=${value}`;
  }).join('\n');
}

function buildWebProductionEnv(serverProdValues) {
  const apiKey = (serverProdValues.API_KEY || '').trim();
  const lines = [
    'VITE_MATCH_DATA_SERVER_URL=https://api.example.com',
    apiKey
      ? `VITE_MATCH_DATA_API_KEY=${apiKey}`
      : 'VITE_MATCH_DATA_API_KEY=replace-with-server-api-key',
  ];
  return `${lines.join('\n')}\n`;
}

function writeIfNeeded(filePath, content, force) {
  const exists = fs.existsSync(filePath);
  if (exists && !force) {
    return false;
  }
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

function main() {
  const force = process.argv.includes('--force');

  if (!fs.existsSync(serverExamplePath)) {
    throw new Error(`Missing template file: ${serverExamplePath}`);
  }

  const templateText = fs.readFileSync(serverExamplePath, 'utf8');
  const currentText = ensureFileText(serverCurrentPath);
  const currentValues = parseEnvText(currentText);
  const serverProdText = buildServerProductionEnv(templateText, currentValues);

  const wroteServer = writeIfNeeded(serverProdPath, `${serverProdText}\n`, force);
  const serverProdValues = parseEnvText(serverProdText);
  const webProdText = buildWebProductionEnv(serverProdValues);
  const wroteWeb = writeIfNeeded(webProdPath, webProdText, force);

  console.log(
    wroteServer
      ? `[env:prod:init] wrote ${path.relative(repoRoot, serverProdPath)}`
      : `[env:prod:init] skip existing ${path.relative(repoRoot, serverProdPath)} (use --force to overwrite)`,
  );
  console.log(
    wroteWeb
      ? `[env:prod:init] wrote ${path.relative(repoRoot, webProdPath)}`
      : `[env:prod:init] skip existing ${path.relative(repoRoot, webProdPath)} (use --force to overwrite)`,
  );

  console.log('[env:prod:init] review required values before deployment:');
  console.log('- .env.production: DATABASE_URL');
  console.log('- .env.production: CORS_ALLOWED_ORIGINS');
  console.log('- .env.production: DEEPSEEK_API_KEY (optional but required for live model preview)');
  console.log('- admin-studio-web/.env.production: VITE_MATCH_DATA_SERVER_URL');
}

main();
