const crypto = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(crypto.scrypt);

const HASH_PREFIX = 'scrypt';
const SALT_BYTES = 16;
const KEY_BYTES = 64;

async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }

  const salt = crypto.randomBytes(SALT_BYTES).toString('hex');
  const derivedKey = await scryptAsync(password, salt, KEY_BYTES);
  return `${HASH_PREFIX}$${salt}$${Buffer.from(derivedKey).toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') {
    return false;
  }

  const [prefix, salt, expectedHashHex] = storedHash.split('$');
  if (prefix !== HASH_PREFIX || !salt || !expectedHashHex) {
    return false;
  }

  let expectedHash;
  try {
    expectedHash = Buffer.from(expectedHashHex, 'hex');
  } catch (error) {
    return false;
  }

  if (expectedHash.length === 0) {
    return false;
  }

  const derivedKey = await scryptAsync(password, salt, expectedHash.length);
  const derivedBuffer = Buffer.from(derivedKey);
  if (derivedBuffer.length !== expectedHash.length) {
    return false;
  }

  return crypto.timingSafeEqual(derivedBuffer, expectedHash);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
