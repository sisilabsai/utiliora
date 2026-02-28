import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase";

interface NewsletterSubscribePayload {
  email?: unknown;
  source?: unknown;
  pagePath?: unknown;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value);
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  let payload: NewsletterSubscribePayload;
  try {
    payload = (await request.json()) as NewsletterSubscribePayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  const rawEmail = typeof payload.email === "string" ? payload.email : "";
  const normalizedEmail = normalizeEmail(rawEmail);
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }

  const source = typeof payload.source === "string" && payload.source.trim() ? payload.source.trim().slice(0, 80) : "site";
  const pagePath =
    typeof payload.pagePath === "string" && payload.pagePath.trim()
      ? payload.pagePath.trim().slice(0, 240)
      : "unknown";

  try {
    const supabase = createSupabaseServiceClient();
    const nowIso = new Date().toISOString();

    const { data: existing, error: existingError } = await supabase
      .from("newsletter_subscribers")
      .select("id,status")
      .eq("email_normalized", normalizedEmail)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("newsletter_subscribers")
        .update({
          email: normalizedEmail,
          status: "active",
          source,
          page_path: pagePath,
          context: {
            ip: getClientIp(request),
            userAgent: request.headers.get("user-agent") || "unknown",
            referrer: request.headers.get("referer") || "",
          },
          last_subscribed_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", existing.id);
      if (updateError) throw updateError;

      return NextResponse.json({
        ok: true,
        message:
          existing.status === "active"
            ? "You are already subscribed."
            : "Welcome back. Your newsletter subscription is active.",
      });
    }

    const { error: insertError } = await supabase.from("newsletter_subscribers").insert({
      email: normalizedEmail,
      email_normalized: normalizedEmail,
      status: "active",
      source,
      page_path: pagePath,
      context: {
        ip: getClientIp(request),
        userAgent: request.headers.get("user-agent") || "unknown",
        referrer: request.headers.get("referer") || "",
      },
      last_subscribed_at: nowIso,
    });
    if (insertError) throw insertError;

    return NextResponse.json({
      ok: true,
      message: "Subscribed successfully. You are now on the Utiliora mailing list.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ok: false, error: `Subscription failed: ${message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "Subscription failed. Please try again." }, { status: 500 });
  }
}
