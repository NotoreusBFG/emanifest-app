import crypto from 'crypto';

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

const scrypt = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, KEY_LENGTH, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });

export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH);
  const derived = await scrypt(pin, salt);
  return salt.toString('hex') + ':' + derived.toString('hex');
}

/**
 * Length-mismatch case is guarded explicitly -- crypto.timingSafeEqual
 * throws on unequal-length buffers rather than returning false, and a
 * corrupted/malformed stored hash must fail closed, not crash the sign
 * request.
 */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(pin, salt);

  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}
