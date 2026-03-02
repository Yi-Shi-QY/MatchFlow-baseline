#!/usr/bin/env node

/* eslint-disable no-console */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DEFAULT_SOURCE_URL = 'https://trade.500.com/jczq/?playid=269&g=2';
const DEFAULT_SOURCE_ID = 'cn_jczq_500';
const DEFAULT_COLLECTOR_NAME = 'CN JCZQ 500 Collector';
const DEFAULT_CHANNEL = 'internal';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 1200;
const DEFAULT_MIN_ROWS = 1;

function parseIntegerInput(input, fallbackValue, min, max) {
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }
  return Math.max(min, Math.min(parsed, max));
}

function parseArgs(argv) {
  const options = {
    sourceUrl: DEFAULT_SOURCE_URL,
    sourceId: DEFAULT_SOURCE_ID,
    collectorName: DEFAULT_COLLECTOR_NAME,
    upload: false,
    autoConfirm: false,
    autoRelease: false,
    channel: DEFAULT_CHANNEL,
    serverUrl: process.env.MATCH_DATA_SERVER_URL || '',
    apiKey: process.env.MATCH_DATA_API_KEY || process.env.API_KEY || '',
    out: '',
    timeoutMs: DEFAULT_TIMEOUT_MS,
    retries: DEFAULT_RETRIES,
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    minRows: DEFAULT_MIN_ROWS,
    allowDuplicate: false,
    force: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--source-url' && next) {
      options.sourceUrl = next.trim();
      index += 1;
      continue;
    }
    if (arg === '--source-id' && next) {
      options.sourceId = next.trim();
      index += 1;
      continue;
    }
    if (arg === '--collector-name' && next) {
      options.collectorName = next.trim();
      index += 1;
      continue;
    }
    if (arg === '--server-url' && next) {
      options.serverUrl = next.trim();
      index += 1;
      continue;
    }
    if (arg === '--api-key' && next) {
      options.apiKey = next.trim();
      index += 1;
      continue;
    }
    if (arg === '--channel' && next) {
      options.channel = next.trim();
      index += 1;
      continue;
    }
    if (arg === '--out' && next) {
      options.out = next.trim();
      index += 1;
      continue;
    }
    if (arg === '--timeout-ms' && next) {
      options.timeoutMs = parseIntegerInput(next, DEFAULT_TIMEOUT_MS, 1000, 120000);
      index += 1;
      continue;
    }
    if (arg === '--retries' && next) {
      options.retries = parseIntegerInput(next, DEFAULT_RETRIES, 0, 8);
      index += 1;
      continue;
    }
    if (arg === '--retry-delay-ms' && next) {
      options.retryDelayMs = parseIntegerInput(next, DEFAULT_RETRY_DELAY_MS, 100, 30000);
      index += 1;
      continue;
    }
    if (arg === '--min-rows' && next) {
      options.minRows = parseIntegerInput(next, DEFAULT_MIN_ROWS, 1, 100000);
      index += 1;
      continue;
    }
    if (arg === '--upload') {
      options.upload = true;
      continue;
    }
    if (arg === '--allow-duplicate') {
      options.allowDuplicate = true;
      continue;
    }
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (arg === '--auto-confirm') {
      options.autoConfirm = true;
      continue;
    }
    if (arg === '--auto-release') {
      options.autoRelease = true;
      options.autoConfirm = true;
      options.upload = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/collectCnJczqSample.js [options]

Options:
  --source-url <url>       Upstream page URL (default: ${DEFAULT_SOURCE_URL})
  --source-id <id>         Datasource sourceId in collection system (default: ${DEFAULT_SOURCE_ID})
  --collector-name <name>  Collector display name
  --out <path>             Output JSON file path
  --timeout-ms <ms>        Upstream fetch timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS})
  --retries <n>            Upstream fetch retry count after first attempt (default: ${DEFAULT_RETRIES})
  --retry-delay-ms <ms>    Base retry delay in milliseconds (default: ${DEFAULT_RETRY_DELAY_MS})
  --min-rows <n>           Minimum parsed rows required for success (default: ${DEFAULT_MIN_ROWS})
  --upload                 Upload collected payload to server collection API
  --allow-duplicate        Allow server to create duplicate snapshot content (default: false)
  --force                  Force import even if collector is disabled
  --server-url <url>       Match Data Server URL, e.g. http://127.0.0.1:3001
  --api-key <token>        API key / bearer token
  --auto-confirm           Confirm imported snapshot automatically
  --auto-release           Release imported snapshot automatically (implies --upload --auto-confirm)
  --channel <name>         Release channel: internal|beta|stable (default: ${DEFAULT_CHANNEL})
  --help                   Show this message
`);
}

function decodeHtml(buffer) {
  const encodings = ['gb18030', 'gbk', 'utf-8'];
  for (const encoding of encodings) {
    try {
      return new TextDecoder(encoding).decode(buffer);
    } catch {
      // try next encoding
    }
  }
  return buffer.toString('utf8');
}

function decodeHtmlEntity(input) {
  if (typeof input !== 'string' || input.length === 0) {
    return '';
  }
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;/g, '\'')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDataAttributes(rawTag) {
  const attrs = {};
  const matcher = /data-([a-z0-9_-]+)="([^"]*)"/gi;
  let match = matcher.exec(rawTag);
  while (match) {
    attrs[match[1]] = decodeHtmlEntity(match[2]);
    match = matcher.exec(rawTag);
  }
  return attrs;
}

function parseOdds(rowHtml) {
  const oddsByType = {};
  const matcher = /data-type="([a-z0-9_]+)"\s+data-value="([0-9]+)"\s+data-sp="([0-9.]+)"/gi;
  let match = matcher.exec(rowHtml);
  while (match) {
    const type = match[1];
    const value = match[2];
    const sp = Number.parseFloat(match[3]);

    if (!oddsByType[type]) {
      oddsByType[type] = {};
    }

    const key = value === '3'
      ? 'win'
      : value === '1'
        ? 'draw'
        : value === '0'
          ? 'lose'
          : value;
    oddsByType[type][key] = Number.isFinite(sp) ? sp : match[3];

    match = matcher.exec(rowHtml);
  }
  return oddsByType;
}

function parseScore(rowHtml) {
  const scoreMatch = rowHtml.match(/<a[^>]*class="score"[^>]*>([^<]+)<\/a>/i);
  if (!scoreMatch) {
    return null;
  }
  return decodeHtmlEntity(scoreMatch[1]);
}

function parseRowsFromHtml(html) {
  const rowRegex = /<tr class="bet-tb-tr[^"]*"[^>]*>[\s\S]*?<\/tr>/gi;
  const rows = [];
  let rowMatch = rowRegex.exec(html);
  while (rowMatch) {
    const rowHtml = rowMatch[0];
    const openTagMatch = rowHtml.match(/^<tr[^>]*>/i);
    if (!openTagMatch) {
      rowMatch = rowRegex.exec(html);
      continue;
    }

    const attrs = parseDataAttributes(openTagMatch[0]);
    const odds = parseOdds(rowHtml);
    const score = parseScore(rowHtml);

    const row = {
      matchNum: attrs.matchnum || null,
      processName: attrs.processname || null,
      fixtureId: attrs.fixtureid || null,
      infoMatchId: attrs.infomatchid || null,
      matchDate: attrs.matchdate || null,
      matchTime: attrs.matchtime || null,
      buyEndTime: attrs.buyendtime || null,
      league: attrs.simpleleague || null,
      homeTeam: attrs.homesxname || null,
      awayTeam: attrs.awaysxname || null,
      handicap: attrs.rangqiu || null,
      isEnded: attrs.isend === '1',
      score,
      odds,
    };
    rows.push(row);
    rowMatch = rowRegex.exec(html);
  }
  return rows;
}

function sha256Json(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value || {})).digest('hex');
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithRetry(url, {
  headers,
  timeoutMs,
  retries,
  retryDelayMs,
}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
      });

      if (response.ok) {
        return response;
      }

      const retriable = response.status >= 500 || response.status === 408 || response.status === 429;
      const error = new Error(`upstream request failed: ${response.status}`);
      error.retriable = retriable;
      throw error;
    } catch (error) {
      lastError = error;
      const isAbort = error?.name === 'AbortError';
      const retriable = isAbort || error?.retriable !== false;
      if (!retriable || attempt >= retries) {
        throw error;
      }

      const waitMs = retryDelayMs * (attempt + 1);
      console.warn(`[collect] upstream fetch retry ${attempt + 1}/${retries} after ${waitMs}ms`);
      await sleep(waitMs);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error('upstream request failed');
}

async function requestJson(serverUrl, pathname, {
  method = 'GET',
  token = '',
  query,
  body,
} = {}) {
  const url = new URL(pathname, serverUrl);
  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || String(value).trim() === '') {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }

  const headers = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message = payload?.error?.message || `Request failed: ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

async function ensureCollector({ serverUrl, token, sourceId, collectorName, sourceUrl }) {
  const listed = await requestJson(serverUrl, '/admin/data-collections/collectors', {
    method: 'GET',
    token,
    query: {
      sourceId,
      limit: 20,
    },
  });
  const existing = Array.isArray(listed?.data) ? listed.data : [];
  if (existing.length > 0) {
    return existing[0];
  }

  const created = await requestJson(serverUrl, '/admin/data-collections/collectors', {
    method: 'POST',
    token,
    body: {
      sourceId,
      name: collectorName,
      provider: 'manual_import',
      config: {
        upstream: sourceUrl,
      },
      isEnabled: true,
    },
  });
  return created.data;
}

function defaultOutputPath() {
  const now = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(process.cwd(), 'dist', 'collections', `cn-jczq-500-${now}.json`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  console.log(`[collect] fetch source: ${options.sourceUrl}`);
  console.log(`[collect] fetch config: timeoutMs=${options.timeoutMs}, retries=${options.retries}, retryDelayMs=${options.retryDelayMs}`);
  const response = await fetchWithRetry(options.sourceUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 MatchFlowCollector/2.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.7',
      Referer: 'https://trade.500.com/',
    },
    timeoutMs: options.timeoutMs,
    retries: options.retries,
    retryDelayMs: options.retryDelayMs,
  });

  const htmlBuffer = Buffer.from(await response.arrayBuffer());
  const html = decodeHtml(htmlBuffer);
  const rows = parseRowsFromHtml(html);
  if (rows.length < options.minRows) {
    throw new Error(`parsed rows(${rows.length}) below minimum threshold(${options.minRows})`);
  }

  const endedCount = rows.filter((row) => row.isEnded).length;
  const upcomingCount = rows.length - endedCount;
  const collectedAt = new Date().toISOString();
  const payload = {
    source: options.sourceUrl,
    sourceId: options.sourceId,
    collectedAt,
    timezone: 'Asia/Shanghai',
    rows,
    summary: {
      total: rows.length,
      ended: endedCount,
      upcoming: upcomingCount,
    },
  };
  const contentHash = sha256Json({
    source: options.sourceUrl,
    sourceId: options.sourceId,
    rows,
    summary: payload.summary,
  });

  const outPath = options.out || defaultOutputPath();
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`[collect] parsed rows: ${rows.length}`);
  console.log(`[collect] content hash: ${contentHash}`);
  console.log(`[collect] saved file: ${outPath}`);
  console.log(`[collect] sample: ${rows[0].matchNum || '-'} ${rows[0].homeTeam || '-'} vs ${rows[0].awayTeam || '-'}`);

  if (!options.upload) {
    console.log('[collect] upload skipped (--upload not set).');
    return;
  }

  if (!options.serverUrl || !options.apiKey) {
    throw new Error('upload mode requires --server-url and --api-key');
  }

  const collector = await ensureCollector({
    serverUrl: options.serverUrl,
    token: options.apiKey,
    sourceId: options.sourceId,
    collectorName: options.collectorName,
    sourceUrl: options.sourceUrl,
  });
  console.log(`[collect] collector: ${collector.id} (${collector.name})`);

  const imported = await requestJson(
    options.serverUrl,
    `/admin/data-collections/collectors/${encodeURIComponent(collector.id)}/import`,
    {
      method: 'POST',
      token: options.apiKey,
      body: {
        triggerType: 'manual',
        sourceId: options.sourceId,
        payload,
        recordCount: rows.length,
        contentHash,
        allowDuplicate: options.allowDuplicate,
        force: options.force,
      },
    },
  );

  const snapshotId = imported?.data?.snapshot?.id;
  const deduplicated = imported?.data?.deduplicated === true
    || imported?.data?.run?.resultSummary?.deduplicated === true;
  console.log(`[collect] imported run: ${imported?.data?.run?.id || '-'}, snapshot: ${snapshotId || '-'}, deduplicated=${deduplicated}`);

  if (!snapshotId || !options.autoConfirm) {
    return;
  }

  const confirmed = await requestJson(
    options.serverUrl,
    `/admin/data-collections/snapshots/${encodeURIComponent(snapshotId)}/confirm`,
    {
      method: 'POST',
      token: options.apiKey,
      body: {
        action: 'confirm',
        notes: 'auto-confirmed by collectCnJczqSample.js',
      },
    },
  );
  console.log(`[collect] confirmed snapshot: ${confirmed?.data?.id || snapshotId}`);

  if (!options.autoRelease) {
    return;
  }

  const released = await requestJson(
    options.serverUrl,
    `/admin/data-collections/snapshots/${encodeURIComponent(snapshotId)}/release`,
    {
      method: 'POST',
      token: options.apiKey,
      body: {
        channel: options.channel || DEFAULT_CHANNEL,
      },
    },
  );
  console.log(`[collect] released snapshot: ${released?.data?.snapshot?.id || snapshotId} channel=${released?.data?.snapshot?.releaseChannel || options.channel}`);
}

main().catch((error) => {
  console.error('[collect] failed:', error.message);
  if (error.payload) {
    console.error(JSON.stringify(error.payload, null, 2));
  }
  process.exit(1);
});
