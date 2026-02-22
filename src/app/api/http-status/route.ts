import { NextResponse } from "next/server";

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url")?.trim() ?? "";

  if (!targetUrl || !isValidHttpUrl(targetUrl)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Please provide a valid HTTP/HTTPS URL.",
      },
      { status: 400 },
    );
  }

  const start = Date.now();
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 10_000);

  try {
    let response = await fetch(targetUrl, {
      method: "HEAD",
      redirect: "follow",
      signal: abort.signal,
    });

    if (response.status === 405) {
      response = await fetch(targetUrl, {
        method: "GET",
        redirect: "follow",
        signal: abort.signal,
      });
    }

    clearTimeout(timeout);
    return NextResponse.json({
      ok: true,
      status: response.status,
      statusText: response.statusText,
      timingMs: Date.now() - start,
    });
  } catch {
    clearTimeout(timeout);
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to reach URL. It may be blocked or unavailable.",
      },
      { status: 502 },
    );
  }
}
