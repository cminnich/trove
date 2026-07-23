import { randomBytes, createHash } from "crypto";

const KEY_PREFIX = "trove_sk_";

/** Generate a new API key: trove_sk_<32 base64url chars> */
export function generateApiKey(): string {
  const random = randomBytes(24).toString("base64url"); // 24 bytes = 32 base64url chars
  return `${KEY_PREFIX}${random}`;
}

/** SHA-256 hex digest of a full API key */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** First 16 characters for safe display (e.g. trove_sk_xxxxxxx...) */
export function getKeyPrefix(key: string): string {
  return key.slice(0, 16);
}

/** Check that a string looks like a valid trove API key */
export function validateApiKeyFormat(key: string): boolean {
  // trove_sk_ (9 chars) + 32 base64url chars = 41 total
  return /^trove_sk_[A-Za-z0-9_-]{32}$/.test(key);
}
