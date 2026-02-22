import { NextResponse } from "next/server";

function firstForwardedIp(value: string | null): string | null {
  if (!value) return null;
  const first = value
    .split(",")
    .map((entry) => entry.trim())
    .find(Boolean);
  return first ?? null;
}

async function fetchIpifyFallback(timeoutMs: number): Promise<string | null> {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), timeoutMs);

  try {
    const response = await fetch("https://api64.ipify.org?format=json", {
      cache: "no-store",
      signal: abort.signal,
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { ip?: string };
    return payload.ip?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  const headerIp = firstForwardedIp(forwardedFor) ?? realIp ?? cfConnectingIp ?? null;
  const fallbackIp = headerIp ? null : await fetchIpifyFallback(4000);
  const ip = headerIp ?? fallbackIp;

  if (!ip) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to resolve public IP from request context.",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      ip,
      source: headerIp ? "request-header" : "ipify-fallback",
      forwardedFor: forwardedFor ?? undefined,
      checkedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
