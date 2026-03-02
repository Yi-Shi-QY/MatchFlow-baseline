const { buildStartupValidationReport } = require('../src/config');
const db = require('../db');

function printList(prefix, items) {
  items.forEach((item) => {
    console.log(`${prefix} ${item}`);
  });
}

function readPositiveIntEnv(name, fallbackValue) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === null || String(rawValue).trim() === '') {
    return fallbackValue;
  }
  const parsed = Number.parseInt(String(rawValue).trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function main() {
  const report = buildStartupValidationReport({
    nodeEnv: 'production',
  });
  const collectionMaxRecords = readPositiveIntEnv('COLLECTION_MAX_IMPORT_RECORDS', 20000);
  const collectionMaxPayloadBytes = readPositiveIntEnv(
    'COLLECTION_MAX_IMPORT_PAYLOAD_BYTES',
    8 * 1024 * 1024,
  );
  if (collectionMaxRecords === null) {
    report.errors.push('COLLECTION_MAX_IMPORT_RECORDS must be a positive integer');
  }
  if (collectionMaxPayloadBytes === null) {
    report.errors.push('COLLECTION_MAX_IMPORT_PAYLOAD_BYTES must be a positive integer');
  }
  if (collectionMaxRecords !== null && collectionMaxRecords > 200000) {
    report.warnings.push('COLLECTION_MAX_IMPORT_RECORDS is unusually high (>200000)');
  }
  if (
    collectionMaxPayloadBytes !== null
    && collectionMaxPayloadBytes > 64 * 1024 * 1024
  ) {
    report.warnings.push('COLLECTION_MAX_IMPORT_PAYLOAD_BYTES is unusually high (>64MB)');
  }

  console.log('[preflight] validating production configuration');
  if (report.warnings.length > 0) {
    printList('[warn]', report.warnings);
  }

  if (report.errors.length > 0) {
    printList('[error]', report.errors);
    throw new Error('Production configuration is invalid');
  }

  console.log('[preflight] checking database connectivity');
  const dbState = await db.ping();
  if (!dbState.ok) {
    throw new Error(`Database check failed: ${dbState.code} (${dbState.message})`);
  }

  await db.close();
  console.log('[preflight] PASS: production readiness checks completed');
}

main().catch((error) => {
  console.error('[preflight] FAIL');
  console.error(error.message || error);
  process.exit(1);
});
