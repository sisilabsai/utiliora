import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PASSWORD_HASH_VERSION = "scrypt-v1";
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const normalized = password.normalize("NFKC");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(normalized, salt, KEY_LENGTH).toString("base64");
  return `${PASSWORD_HASH_VERSION}$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [version, salt, hash] = storedHash.split("$");
  if (version !== PASSWORD_HASH_VERSION || !salt || !hash) return false;

  const normalized = password.normalize("NFKC");
  const derived = scryptSync(normalized, salt, KEY_LENGTH);
  const storedBuffer = Buffer.from(hash, "base64");
  if (storedBuffer.length !== derived.length) return false;
  return timingSafeEqual(derived, storedBuffer);
}
