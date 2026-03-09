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

function normalizeAuditUrl(value: string): string | null {
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
    const normalizedUrl = normalizeAuditUrl(body.url ?? "");
    if (!normalizedUrl) {
      return NextResponse.json({ ok: false, error: "Enter a valid public page URL." }, { status: 400 });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(normalizedUrl, {
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": "UtilioraAccessibilityAudit/1.0",
          accept: "text/html,application/xhtml+xml",
        },
      });

      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        return NextResponse.json(
          {
            ok: false,
            error: `Expected an HTML page but received ${contentType || "an unsupported content type"}.`,
          },
          { status: 400 },
        );
      }

      const finalUrl = response.url || normalizedUrl;
      const finalHost = new URL(finalUrl).hostname;
      if (isPrivateOrLocalHost(finalHost)) {
        return NextResponse.json({ ok: false, error: "Redirected to a blocked host." }, { status: 400 });
      }

      const markup = (await response.text()).slice(0, 800_000);
      const titleMatch = markup.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

      return NextResponse.json({
        ok: true,
        requestedUrl: normalizedUrl,
        finalUrl,
        status: response.status,
        title: (titleMatch?.[1] ?? "").replace(/\s+/g, " ").trim(),
        markup,
      });
    } catch (error) {
      const isAbort =
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name?: string }).name === "AbortError";

      return NextResponse.json(
        {
          ok: false,
          error: isAbort ? "The page request timed out." : "Unable to fetch the page for auditing.",
        },
        { status: 500 },
      );
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid accessibility audit request." }, { status: 400 });
  }
}
