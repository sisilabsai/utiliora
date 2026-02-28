import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes, scryptSync } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://wlhcdyifkhmnpvupgpuw.supabase.co";
const DEFAULT_ADMIN_USERNAME = "admin@utiliora.cloud";
const DEFAULT_ADMIN_PASSWORD = "Admin@Cloud2026";
const PASSWORD_HASH_VERSION = "scrypt-v1";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) return;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key]) return;
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

function hashPassword(password) {
  const normalized = password.normalize("NFKC");
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(normalized, salt, 64).toString("base64");
  return `${PASSWORD_HASH_VERSION}$${salt}$${hash}`;
}

async function run() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY. Add it to .env.local before running this script.");
    process.exitCode = 1;
    return;
  }

  const username = (process.env.ADMIN_SEED_USERNAME?.trim() || DEFAULT_ADMIN_USERNAME).toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD?.trim() || DEFAULT_ADMIN_PASSWORD;
  const role = process.env.ADMIN_SEED_ROLE?.trim() || "owner";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: existing, error: existingError } = await supabase
    .from("admin_users")
    .select("id,username")
    .eq("username", username)
    .maybeSingle();

  if (existingError) {
    console.error("Failed to query admin_users:", existingError.message);
    process.exitCode = 1;
    return;
  }

  if (existing?.id) {
    console.log(`Admin already exists for ${existing.username}. No changes applied.`);
    return;
  }

  const passwordHash = hashPassword(password);
  const nowIso = new Date().toISOString();
  const { error: insertError } = await supabase.from("admin_users").insert({
    username,
    password_hash: passwordHash,
    role,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  });

  if (insertError) {
    console.error("Failed to seed admin user:", insertError.message);
    process.exitCode = 1;
    return;
  }

  console.log(`Admin seeded successfully for ${username}.`);
}

run().catch((error) => {
  console.error("Seed script failed:", error);
  process.exitCode = 1;
});
