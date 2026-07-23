// 1. Load the environment variables from your .env.local file
require('dotenv').config({ path: '.env.local' });

// 2. Import the TS crypto file using ts-node (or standard Node path resolution)
// Since we are testing simply, we'll mimic the crypto utility logic in plain JS
const crypto = require('crypto');

const SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

console.log("🔑 Loaded Secret Key:", SECRET_KEY ? `${SECRET_KEY.slice(0, 6)}...[hidden]...` : "❌ NOT FOUND!");

if (!SECRET_KEY) {
  console.error("Error: ENCRYPTION_SECRET_KEY is missing from your .env.local file!");
  process.exit(1);
}

// Mimic our TypeScript functions
function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(SECRET_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return { encryptedData: encrypted, iv: iv.toString('hex'), tag: tag.toString('hex') };
}

function decrypt(encData, ivHex, tagHex) {
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(SECRET_KEY, 'hex'), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  let decrypted = decipher.update(encData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// --- RUN THE TEST ---
const originalApiKey = "EPA_MOCK_API_KEY_123456_SUPER_SECRET";
console.log("\n🧪 Starting Encryption Test...");
console.log("Original EPA Key: ", originalApiKey);

// Encrypt
const result = encrypt(originalApiKey);
console.log("\n🔒 Encrypted Payload (This goes to Supabase):");
console.log(JSON.stringify(result, null, 2));

// Decrypt
const decryptedKey = decrypt(result.encryptedData, result.iv, result.tag);
console.log("\n🔓 Decrypted Output:");
console.log("Decrypted Key:    ", decryptedKey);

if (originalApiKey === decryptedKey) {
  console.log("\n✅ SUCCESS! Encryption and decryption match perfectly.");
} else {
  console.log("\n❌ FAILURE! Decrypted text does not match original.");
}