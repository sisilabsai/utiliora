import { NextRequest, NextResponse } from "next/server";

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

function normalizePublicUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = /^[a-zA-Z][\w+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (isPrivateOrLocalHost(parsed.hostname)) return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string };
    const normalizedUrl = normalizePublicUrl(body.url ?? "");
    if (!normalizedUrl) {
      return NextResponse.json({ ok: false, error: "Enter a valid public HTTP or HTTPS URL." }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(normalizedUrl, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": "UtilioraScamShield/1.0",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
        },
      });

      const finalUrl = response.url || normalizedUrl;
      if (isPrivateOrLocalHost(new URL(finalUrl).hostname)) {
        return NextResponse.json({ ok: false, error: "Redirected to a blocked host." }, { status: 400 });
      }

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      const bodyText =
        contentType.includes("text/html") || contentType.includes("text/plain") || contentType.includes("application/xhtml+xml")
          ? (await response.text()).slice(0, 250_000)
          : "";
      const titleMatch = bodyText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = (titleMatch?.[1] ?? "").replace(/\s+/g, " ").trim();

      return NextResponse.json(
        {
          ok: true,
          requestedUrl: normalizedUrl,
          finalUrl,
          status: response.status,
          contentType,
          title,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      const isAbort =
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name?: string }).name === "AbortError";
      return NextResponse.json(
        { ok: false, error: isAbort ? "The destination timed out during inspection." : "Unable to inspect this destination." },
        { status: 502 },
      );
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid scam shield inspection request." }, { status: 400 });
  }
}
