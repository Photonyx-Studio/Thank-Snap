import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV, the recommended size for GCM
const PREFIX = "enc:v1:";

function getKey(): Buffer {
  const raw = process.env.SESSION_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "SESSION_ENCRYPTION_KEY must be set to encrypt/decrypt stored secrets " +
        "(generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\")",
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      "SESSION_ENCRYPTION_KEY must decode (base64) to exactly 32 bytes for AES-256",
    );
  }

  return key;
}

/**
 * Encrypts a string at rest with AES-256-GCM, keyed by SESSION_ENCRYPTION_KEY.
 * Used for values (like Shopify access/refresh tokens) that would otherwise
 * sit in Supabase in plaintext - RLS only blocks Supabase's auto-exposed
 * PostgREST API, it doesn't protect against a leaked DB credential or a
 * misconfigured policy, so long-lived tokens get this extra layer.
 */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return (
    PREFIX +
    [iv, authTag, ciphertext].map((buf) => buf.toString("base64")).join(":")
  );
}

/**
 * Decrypts a value produced by encryptSecret(). Values without the PREFIX
 * are returned unchanged - this is what lets rows written before encryption
 * was turned on (plaintext tokens) keep working; they get re-encrypted the
 * next time that session is stored (its next OAuth/refresh cycle).
 */
export function decryptSecret(value: string): string {
  if (!value.startsWith(PREFIX)) return value;

  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(":");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
