import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, createAdminSessionToken } from "@/lib/admin-session";
import { verifyPassword } from "@/lib/password";
import { createSupabaseServiceClient } from "@/lib/supabase";

interface LoginPayload {
  username?: unknown;
  password?: unknown;
}

const DEFAULT_ADMIN_USERNAME = "admin@utiliora.cloud";

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  let payload: LoginPayload;
  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const username = typeof payload.username === "string" ? normalizeUsername(payload.username) : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "Username and password are required." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const expectedUsername = process.env.ADMIN_USERNAME?.trim().toLowerCase() || DEFAULT_ADMIN_USERNAME;

    const { data: adminUser, error } = await supabase
      .from("admin_users")
      .select("id,username,password_hash,role,is_active")
      .eq("username", username)
      .maybeSingle();
    if (error) throw error;

    if (!adminUser || !adminUser.is_active || adminUser.username !== expectedUsername) {
      return NextResponse.json({ ok: false, error: "Invalid credentials." }, { status: 401 });
    }

    const passwordOk = verifyPassword(password, adminUser.password_hash);
    if (!passwordOk) {
      return NextResponse.json({ ok: false, error: "Invalid credentials." }, { status: 401 });
    }

    const token = createAdminSessionToken(adminUser.username, adminUser.role || "admin");
    const response = NextResponse.json({ ok: true, username: adminUser.username, role: adminUser.role || "admin" });
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    await supabase
      .from("admin_users")
      .update({ last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", adminUser.id);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ok: false, error: `Login failed: ${message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "Login failed. Please try again." }, { status: 500 });
  }
}
