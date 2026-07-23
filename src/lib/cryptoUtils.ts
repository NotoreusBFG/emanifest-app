import crypto from 'crypto';

// 64 hex chars = 32 bytes, required for aes-256. Generate with:
// `openssl rand -hex 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
const IV_LENGTH = 16; // For AES, this is always 16

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_SECRET_KEY;
  if (!key) {
    throw new Error('Missing ENCRYPTION_SECRET_KEY environment variable! Check your .env.local file.');
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}