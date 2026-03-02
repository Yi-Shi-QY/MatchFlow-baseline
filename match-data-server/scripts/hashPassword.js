const { hashPassword } = require('../src/services/passwordService');

async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error('Usage: npm run hash-password -- "<plain-text-password>"');
    process.exit(1);
  }

  const hashed = await hashPassword(password);
  console.log(hashed);
}

main().catch((error) => {
  console.error('Failed to hash password:', error.message);
  process.exit(1);
});
