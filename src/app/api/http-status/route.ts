import { NextResponse } from "next/server";

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isPrivateOrLocalHost(value: string): boolean {
  const host = value.trim().toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (host === "::1") return true;
  if (host.startsWith("127.")) return true;
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (host.startsWith("169.254.")) return true;
  if (host.startsWith("fc") || host.startsWith("fd")) return true;
  return false;
}

function normalizeMethod(value: string | null): "HEAD" | "GET" {
  return value?.toUpperCase() === "GET" ? "GET" : "HEAD";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url")?.trim() ?? "";
  const requestedMethod = normalizeMethod(searchParams.get("method"));
  const requestedTimeoutMs = Number.parseInt(searchParams.get("timeoutMs") ?? "", 10);
  const timeoutMs = Number.isFinite(requestedTimeoutMs)
    ? Math.max(2000, Math.min(20_000, requestedTimeoutMs))
    : 10_000;

  if (!targetUrl || !isValidHttpUrl(targetUrl)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please provide a valid HTTP/HTTPS URL.",
      },
      { status: 400 },
    );
  }

  const hostname = new URL(targetUrl).hostname;
  if (isPrivateOrLocalHost(hostname)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Local and private network hosts are blocked for security reasons.",
      },
      { status: 400 },
    );
  }

  const start = Date.now();
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), timeoutMs);

  try {
    let response = await fetch(targetUrl, {
      method: requestedMethod,
      redirect: "follow",
      signal: abort.signal,
    });
    let methodUsed: "HEAD" | "GET" = requestedMethod;

    if (requestedMethod === "HEAD" && response.status === 405) {
      response = await fetch(targetUrl, {
        method: "GET",
        redirect: "follow",
        signal: abort.signal,
      });
      methodUsed = "GET";
    }

    clearTimeout(timeout);
    return NextResponse.json({
      ok: true,
      status: response.status,
      statusText: response.statusText,
      timingMs: Date.now() - start,
      methodUsed,
      redirected: response.redirected,
      finalUrl: response.url,
      contentType: response.headers.get("content-type") ?? undefined,
      contentLength: response.headers.get("content-length") ?? undefined,
    });
  } catch (error) {
    clearTimeout(timeout);
    const isAbort =
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError";

    return NextResponse.json(
      {
        ok: false,
        error: isAbort
          ? `Request timed out after ${timeoutMs} ms.`
          : "Unable to reach URL. It may be blocked or unavailable.",
      },
      { status: 502 },
    );
  }
}
