const { buildStartupValidationReport } = require('../src/config');
const db = require('../db');

function printList(prefix, items) {
  items.forEach((item) => {
    console.log(`${prefix} ${item}`);
  });
}

async function main() {
  const report = buildStartupValidationReport({
    nodeEnv: 'production',
  });

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
