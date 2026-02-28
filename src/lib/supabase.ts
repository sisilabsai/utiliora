import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://wlhcdyifkhmnpvupgpuw.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UCulyAlc4IfGOCrt33NA1Q_SxO2U1ai";

function readPublicSupabaseUrl(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || DEFAULT_SUPABASE_URL;
}

function readPublicSupabaseKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
}

function assertSupabaseUrl(url: string): string {
  if (!url) throw new Error("Missing Supabase URL.");
  return url;
}

function assertSupabaseKey(key: string): string {
  if (!key) throw new Error("Missing Supabase key.");
  return key;
}

export function createSupabaseAnonClient(): SupabaseClient {
  const url = assertSupabaseUrl(readPublicSupabaseUrl());
  const key = assertSupabaseKey(readPublicSupabaseKey());
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        "X-Client-Info": "utiliora-newsletter-public",
      },
    },
  });
}

export function createSupabaseServiceClient(): SupabaseClient {
  const url = assertSupabaseUrl(readPublicSupabaseUrl());
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for privileged server operations.");
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        "X-Client-Info": "utiliora-admin-service",
      },
    },
  });
}
