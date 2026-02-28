import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE_NAME = "utiliora_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const DEFAULT_DEV_SECRET = "utiliora-admin-dev-secret-change-in-production";

export interface AdminSessionPayload {
  username: string;
  role: string;
  iat: number;
  exp: number;
}

function readSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET?.trim() || DEFAULT_DEV_SECRET;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf-8");
}

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", readSessionSecret()).update(encodedPayload).digest("base64url");
}

export function createAdminSessionToken(username: string, role: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    username,
    role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminSessionToken(token: string | undefined | null): AdminSessionPayload | null {
  if (!token) return null;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signPayload(encodedPayload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as AdminSessionPayload;
    if (!parsed?.username || !parsed?.role || !parsed.exp || !parsed.iat) return null;
    const now = Math.floor(Date.now() / 1000);
    if (parsed.exp <= now) return null;
    return parsed;
  } catch {
    return null;
  }
}
