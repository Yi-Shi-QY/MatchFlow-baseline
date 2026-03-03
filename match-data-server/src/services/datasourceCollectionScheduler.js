const {
  listDatasourceCollectorsForAdmin,
  triggerDatasourceCollectorRunForAdmin,
  listDatasourceCollectionHealthForAdmin,
} = require('./datasourceCollectionService');

const DEFAULT_TICK_MS = (() => {
  const parsed = Number.parseInt(process.env.COLLECTION_SCHEDULER_TICK_MS, 10);
  if (!Number.isFinite(parsed)) {
    return 60_000;
  }
  return Math.max(5_000, Math.min(parsed, 30 * 60_000));
})();

const DEFAULT_STARTUP_DELAY_MS = (() => {
  const parsed = Number.parseInt(process.env.COLLECTION_SCHEDULER_STARTUP_DELAY_MS, 10);
  if (!Number.isFinite(parsed)) {
    return 15_000;
  }
  return Math.max(0, Math.min(parsed, 30 * 60_000));
})();

const DEFAULT_MAX_RUNS_PER_TICK = (() => {
  const parsed = Number.parseInt(process.env.COLLECTION_SCHEDULER_MAX_RUNS_PER_TICK, 10);
  if (!Number.isFinite(parsed)) {
    return 20;
  }
  return Math.max(1, Math.min(parsed, 200));
})();

const ALERT_WEBHOOK_URL = String(process.env.COLLECTION_ALERT_WEBHOOK_URL || '').trim();
const ALERT_MIN_INTERVAL_MS = (() => {
  const parsed = Number.parseInt(process.env.COLLECTION_ALERT_MIN_INTERVAL_MS, 10);
  if (!Number.isFinite(parsed)) {
    return 15 * 60_000;
  }
  return Math.max(30_000, Math.min(parsed, 24 * 60 * 60_000));
})();
const ALERT_TIMEOUT_MS = (() => {
  const parsed = Number.parseInt(process.env.COLLECTION_ALERT_TIMEOUT_MS, 10);
  if (!Number.isFinite(parsed)) {
    return 5_000;
  }
  return Math.max(1_000, Math.min(parsed, 30_000));
})();

function normalizePositiveInteger(input, fallbackValue, min, max) {
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }
  return Math.max(min, Math.min(parsed, max));
}

function parseScheduleMinutesFromCron(scheduleCron) {
  const text = String(scheduleCron || '').trim();
  if (!text) return null;
  const parts = text.split(/\s+/);
  if (parts.length < 5) return null;

  const minuteField = parts[0];
  const hourField = parts[1];

  if (minuteField === '*' && hourField === '*') {
    return 1;
  }
  if (/^\*\/\d+$/.test(minuteField) && hourField === '*') {
    return normalizePositiveInteger(minuteField.split('/')[1], 1, 1, 60);
  }
  if (/^\d+$/.test(minuteField) && hourField === '*') {
    return 60;
  }
  if (/^\d+$/.test(minuteField) && /^\*\/\d+$/.test(hourField)) {
    const everyHours = normalizePositiveInteger(hourField.split('/')[1], 1, 1, 24);
    return everyHours * 60;
  }
  if (/^\d+$/.test(minuteField) && /^\d+$/.test(hourField)) {
    return 24 * 60;
  }
  return null;
}

function resolveScheduleMinutes(collector) {
  const config = collector && collector.config && typeof collector.config === 'object'
    ? collector.config
    : {};
  const configuredMinutes = normalizePositiveInteger(
    config.scheduleEveryMinutes,
    NaN,
    1,
    24 * 60,
  );
  if (Number.isFinite(configuredMinutes)) {
    return configuredMinutes;
  }
  return parseScheduleMinutesFromCron(collector?.scheduleCron);
}

function shouldRunCollector(collector, nowMs) {
  if (!collector || collector.isEnabled !== true) {
    return false;
  }
  const scheduleMinutes = resolveScheduleMinutes(collector);
  if (!Number.isFinite(scheduleMinutes)) {
    return false;
  }
  if (!collector.lastRunAt) {
    return true;
  }
  const lastRunAtMs = new Date(collector.lastRunAt).getTime();
  if (!Number.isFinite(lastRunAtMs)) {
    return true;
  }
  const scheduleWindowMs = scheduleMinutes * 60_000;
  return nowMs - lastRunAtMs >= scheduleWindowMs;
}

async function sendAlertWebhook(payload, logger) {
  if (!ALERT_WEBHOOK_URL) {
    logger.warn(`[collection-scheduler] alert: ${payload.message}`);
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ALERT_TIMEOUT_MS);
  try {
    const response = await fetch(ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      logger.warn(
        `[collection-scheduler] alert webhook returned ${response.status}`,
      );
    }
  } catch (error) {
    logger.warn(`[collection-scheduler] alert webhook failed: ${error.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

function createAlertNotifier(logger) {
  const lastAlertMap = new Map();

  return async (key, payload) => {
    const nowMs = Date.now();
    const previousTs = lastAlertMap.get(key) || 0;
    if (nowMs - previousTs < ALERT_MIN_INTERVAL_MS) {
      return;
    }
    lastAlertMap.set(key, nowMs);
    await sendAlertWebhook(payload, logger);
  };
}

async function listEnabledCollectors(tenantId) {
  const limit = 200;
  let offset = 0;
  const rows = [];

  while (true) {
    const result = await listDatasourceCollectorsForAdmin({
      query: {
        tenantId,
        isEnabled: true,
        limit,
        offset,
      },
      authContext: { tenantId },
    });
    const batch = Array.isArray(result?.data) ? result.data : [];
    if (batch.length === 0) {
      break;
    }
    rows.push(...batch);
    if (batch.length < limit) {
      break;
    }
    offset += limit;
  }

  return rows;
}

function toSortedDueCollectors(collectors) {
  return collectors
    .filter((collector) => shouldRunCollector(collector, Date.now()))
    .sort((left, right) => {
      const leftTs = left.lastRunAt ? new Date(left.lastRunAt).getTime() : 0;
      const rightTs = right.lastRunAt ? new Date(right.lastRunAt).getTime() : 0;
      return leftTs - rightTs;
    });
}

async function triggerDueCollectors({
  tenantId,
  dueCollectors,
  maxRunsPerTick,
  logger,
  notifyAlert,
}) {
  const selected = dueCollectors.slice(0, maxRunsPerTick);
  for (const collector of selected) {
    try {
      await triggerDatasourceCollectorRunForAdmin({
        collectorId: collector.id,
        body: {
          triggerType: 'scheduled',
        },
        authContext: {
          tenantId,
          userId: null,
        },
      });
      logger.info(
        `[collection-scheduler] scheduled run triggered for collector ${collector.id} sourceId=${collector.sourceId}`,
      );
    } catch (error) {
      const message = `[collection-scheduler] scheduled run failed for collector ${collector.id}: ${error.message}`;
      logger.warn(message);
      await notifyAlert(
        `run_failed:${tenantId}:${collector.id}`,
        {
          type: 'datasource_collection_scheduler_alert',
          severity: 'error',
          tenantId,
          collectorId: collector.id,
          sourceId: collector.sourceId,
          status: 'run_failed',
          message,
          timestamp: new Date().toISOString(),
        },
      );
    }
  }
}

async function emitHealthAlerts({ tenantId, logger, notifyAlert }) {
  const health = await listDatasourceCollectionHealthForAdmin({
    query: {
      tenantId,
      includeDisabled: false,
      limit: 200,
    },
    authContext: { tenantId },
  });
  const rows = Array.isArray(health?.data) ? health.data : [];
  for (const item of rows) {
    const status = item?.health?.status;
    if (status !== 'failed' && status !== 'stale') {
      continue;
    }
    const collector = item.collector || {};
    const lagMinutes = item?.health?.lagMinutes;
    const message = `[collection-scheduler] collector unhealthy: sourceId=${collector.sourceId} status=${status} lagMinutes=${lagMinutes}`;
    logger.warn(message);
    await notifyAlert(
      `health_${status}:${tenantId}:${collector.id}`,
      {
        type: 'datasource_collection_scheduler_alert',
        severity: status === 'failed' ? 'error' : 'warning',
        tenantId,
        collectorId: collector.id,
        sourceId: collector.sourceId,
        status,
        lagMinutes,
        slaMaxLagMinutes: item?.health?.slaMaxLagMinutes,
        message,
        timestamp: new Date().toISOString(),
      },
    );
  }
}

function startDatasourceCollectionScheduler(options = {}) {
  const logger = options.logger || console;
  const tenantId = String(options.tenantId || process.env.COLLECTION_SCHEDULER_TENANT_ID || '').trim() || null;
  const tickMs = normalizePositiveInteger(
    options.tickMs,
    DEFAULT_TICK_MS,
    5_000,
    30 * 60_000,
  );
  const startupDelayMs = normalizePositiveInteger(
    options.startupDelayMs,
    DEFAULT_STARTUP_DELAY_MS,
    0,
    30 * 60_000,
  );
  const maxRunsPerTick = normalizePositiveInteger(
    options.maxRunsPerTick,
    DEFAULT_MAX_RUNS_PER_TICK,
    1,
    200,
  );
  const notifyAlert = createAlertNotifier(logger);

  let stopped = false;
  let running = false;
  let timer = null;

  const scheduleNextTick = (delayMs) => {
    if (stopped) return;
    timer = setTimeout(() => {
      void runTick();
    }, delayMs);
  };

  const runTick = async () => {
    if (stopped || running) {
      scheduleNextTick(tickMs);
      return;
    }

    running = true;
    try {
      const collectors = await listEnabledCollectors(tenantId);
      const dueCollectors = toSortedDueCollectors(collectors);

      if (dueCollectors.length > 0) {
        await triggerDueCollectors({
          tenantId,
          dueCollectors,
          maxRunsPerTick,
          logger,
          notifyAlert,
        });
      }

      await emitHealthAlerts({ tenantId, logger, notifyAlert });
    } catch (error) {
      logger.warn(`[collection-scheduler] tick failed: ${error.message}`);
      await notifyAlert(
        `scheduler_tick_failed:${tenantId || 'default'}`,
        {
          type: 'datasource_collection_scheduler_alert',
          severity: 'error',
          tenantId,
          status: 'scheduler_tick_failed',
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      );
    } finally {
      running = false;
      scheduleNextTick(tickMs);
    }
  };

  logger.info(
    `[collection-scheduler] started (tickMs=${tickMs}, startupDelayMs=${startupDelayMs}, maxRunsPerTick=${maxRunsPerTick})`,
  );
  scheduleNextTick(startupDelayMs);

  return async () => {
    stopped = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    logger.info('[collection-scheduler] stopped');
  };
}

module.exports = {
  startDatasourceCollectionScheduler,
};
