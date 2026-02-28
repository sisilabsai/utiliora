import { NextRequest, NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-session";
import { getCategories } from "@/lib/categories";
import { getAllTools } from "@/lib/tools";
import { createSupabaseServiceClient } from "@/lib/supabase";

function unauthorizedResponse() {
  return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE_NAME)?.value;
  const session = verifyAdminSessionToken(token);
  if (!session) return unauthorizedResponse();

  try {
    const supabase = createSupabaseServiceClient();
    const { count: totalSubscribers, error: totalError } = await supabase
      .from("newsletter_subscribers")
      .select("*", { count: "exact", head: true });
    if (totalError) throw totalError;

    const { count: activeSubscribers, error: activeError } = await supabase
      .from("newsletter_subscribers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");
    if (activeError) throw activeError;

    const { data: recentSubscribers, error: recentError } = await supabase
      .from("newsletter_subscribers")
      .select("email,source,page_path,status,created_at,last_subscribed_at")
      .order("created_at", { ascending: false })
      .limit(12);
    if (recentError) throw recentError;

    return NextResponse.json({
      ok: true,
      dashboard: {
        user: {
          username: session.username,
          role: session.role,
        },
        newsletter: {
          totalSubscribers: totalSubscribers ?? 0,
          activeSubscribers: activeSubscribers ?? 0,
          recentSubscribers: recentSubscribers ?? [],
        },
        platform: {
          totalTools: getAllTools().length,
          totalCategories: getCategories().length,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json({ ok: false, error: `Overview failed: ${message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: false, error: "Failed to load dashboard data." }, { status: 500 });
  }
}
