#!/usr/bin/env node

/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ONE_SHOT_SCRIPT_PATH = path.join(__dirname, 'collectCnJczqSample.js');
const DEFAULT_INTERVAL_MS = 10 * 60_000;
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 3;
const DEFAULT_ALERT_TIMEOUT_MS = 5_000;

function parseIntegerInput(input, fallbackValue, min, max) {
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }
  return Math.max(min, Math.min(parsed, max));
}

function parseArgs(argv) {
  const options = {
    intervalMs: parseIntegerInput(process.env.JCZQ_DAEMON_INTERVAL_MS, DEFAULT_INTERVAL_MS, 10_000, 24 * 60 * 60_000),
    maxConsecutiveFailures: parseIntegerInput(
      process.env.JCZQ_DAEMON_MAX_CONSECUTIVE_FAILURES,
      DEFAULT_MAX_CONSECUTIVE_FAILURES,
      1,
      50,
    ),
    alertWebhookUrl: String(process.env.JCZQ_DAEMON_ALERT_WEBHOOK_URL || process.env.COLLECTION_ALERT_WEBHOOK_URL || '').trim(),
    alertTimeoutMs: parseIntegerInput(
      process.env.JCZQ_DAEMON_ALERT_TIMEOUT_MS,
      DEFAULT_ALERT_TIMEOUT_MS,
      1_000,
      60_000,
    ),
    metricsOut: String(process.env.JCZQ_DAEMON_METRICS_OUT || '').trim(),
    maxLoops: parseIntegerInput(process.env.JCZQ_DAEMON_MAX_LOOPS, 0, 0, 1_000_000),
    passThroughArgs: [],
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--interval-ms' && next) {
      options.intervalMs = parseIntegerInput(next, options.intervalMs, 10_000, 24 * 60 * 60_000);
      index += 1;
      continue;
    }
    if (arg === '--max-consecutive-failures' && next) {
      options.maxConsecutiveFailures = parseIntegerInput(next, options.maxConsecutiveFailures, 1, 50);
      index += 1;
      continue;
    }
    if (arg === '--alert-webhook-url' && next) {
      options.alertWebhookUrl = String(next || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--alert-timeout-ms' && next) {
      options.alertTimeoutMs = parseIntegerInput(next, options.alertTimeoutMs, 1_000, 60_000);
      index += 1;
      continue;
    }
    if (arg === '--metrics-out' && next) {
      options.metricsOut = String(next || '').trim();
      index += 1;
      continue;
    }
    if (arg === '--max-loops' && next) {
      options.maxLoops = parseIntegerInput(next, options.maxLoops, 0, 1_000_000);
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }

    options.passThroughArgs.push(arg);
  }

  return options;
}

function printHelp() {
  console.log(`Usage:
  node scripts/runCnJczqCollectorDaemon.js [daemon-options] [-- passthrough-options]

Daemon options:
  --interval-ms <ms>                 Loop interval (default: ${DEFAULT_INTERVAL_MS})
  --max-consecutive-failures <n>     Alert threshold for continuous failures (default: ${DEFAULT_MAX_CONSECUTIVE_FAILURES})
  --alert-webhook-url <url>          Optional webhook for failure alerts
  --alert-timeout-ms <ms>            Alert webhook timeout (default: ${DEFAULT_ALERT_TIMEOUT_MS})
  --metrics-out <path>               Optional metrics JSON output file
  --max-loops <n>                    Stop after N loops (0 means run forever)
  --help                             Show this message

Pass-through options:
  All unrecognized args are forwarded to:
  node scripts/collectCnJczqSample.js ...

Example:
  node scripts/runCnJczqCollectorDaemon.js \\
    --interval-ms 600000 \\
    --max-consecutive-failures 3 \\
    --metrics-out dist/collections/jczq-daemon-metrics.json \\
    --upload --auto-confirm --auto-release --channel internal \\
    --server-url http://127.0.0.1:3001 --api-key <API_KEY> --min-rows 5
`);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runOneShotCollector(passThroughArgs) {
  const args = [ONE_SHOT_SCRIPT_PATH, ...passThroughArgs];
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd(),
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `collector exited with code=${code === null ? 'null' : code} signal=${signal || '-'}`,
        ),
      );
    });
  });
}

async function sendAlertWebhook(url, timeoutMs, payload) {
  if (!url) {
    console.warn(`[daemon-alert] ${payload.message}`);
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn(`[daemon-alert] webhook returned status ${response.status}`);
    }
  } catch (error) {
    console.warn(`[daemon-alert] webhook failed: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function writeMetrics(metricsOut, metrics) {
  if (!metricsOut) {
    return;
  }
  try {
    fs.mkdirSync(path.dirname(metricsOut), { recursive: true });
    fs.writeFileSync(metricsOut, JSON.stringify(metrics, null, 2), 'utf8');
  } catch (error) {
    console.warn(`[daemon] failed to write metrics: ${error.message}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  let stopped = false;
  let loopCount = 0;
  let consecutiveFailures = 0;
  let lastSuccessAt = null;
  let lastFailureAt = null;
  let lastError = null;

  process.on('SIGINT', () => {
    stopped = true;
    console.log('[daemon] received SIGINT, stopping after current loop');
  });
  process.on('SIGTERM', () => {
    stopped = true;
    console.log('[daemon] received SIGTERM, stopping after current loop');
  });

  console.log(
    `[daemon] starting cn-jczq collector loop intervalMs=${options.intervalMs} maxConsecutiveFailures=${options.maxConsecutiveFailures}`,
  );
  if (options.passThroughArgs.length === 0) {
    console.log('[daemon] warning: no pass-through args; collector runs in fetch-only mode by default.');
  }

  while (!stopped) {
    loopCount += 1;
    const loopStartedAt = new Date().toISOString();
    try {
      console.log(`[daemon] loop #${loopCount} started at ${loopStartedAt}`);
      await runOneShotCollector(options.passThroughArgs);
      consecutiveFailures = 0;
      lastSuccessAt = new Date().toISOString();
      lastError = null;
      console.log(`[daemon] loop #${loopCount} succeeded`);
    } catch (error) {
      consecutiveFailures += 1;
      lastFailureAt = new Date().toISOString();
      lastError = error.message;
      console.error(`[daemon] loop #${loopCount} failed: ${error.message}`);

      if (consecutiveFailures >= options.maxConsecutiveFailures) {
        await sendAlertWebhook(options.alertWebhookUrl, options.alertTimeoutMs, {
          type: 'cn_jczq_collector_daemon_alert',
          severity: 'error',
          message: `collector failed ${consecutiveFailures} times continuously`,
          consecutiveFailures,
          loopCount,
          lastSuccessAt,
          lastFailureAt,
          error: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    writeMetrics(options.metricsOut, {
      loopCount,
      consecutiveFailures,
      lastSuccessAt,
      lastFailureAt,
      lastError,
      intervalMs: options.intervalMs,
      updatedAt: new Date().toISOString(),
    });

    if (options.maxLoops > 0 && loopCount >= options.maxLoops) {
      console.log(`[daemon] reached max loops (${options.maxLoops}), exiting`);
      break;
    }
    if (stopped) {
      break;
    }
    await sleep(options.intervalMs);
  }

  console.log('[daemon] stopped');
}

main().catch((error) => {
  console.error(`[daemon] fatal error: ${error.message}`);
  process.exit(1);
});
