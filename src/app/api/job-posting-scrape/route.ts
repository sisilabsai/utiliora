import { NextResponse } from "next/server";

interface JobPostingScrapeResult {
  ok: true;
  requestedUrl: string;
  finalUrl: string;
  redirected: boolean;
  status: number;
  source: "jsonld" | "html";
  roleTitle: string;
  companyName: string;
  location: string;
  employmentType: string;
  summary: string;
  jobDescription: string;
  wordCount: number;
}

interface JobPostingScrapeError {
  ok: false;
  error: string;
}

type JobPostingRouteResponse = JobPostingScrapeResult | JobPostingScrapeError;

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

function normalizeHttpUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = /^[a-zA-Z][\w+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (isPrivateOrLocalHost(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#x2F;/gi, "/")
    .replace(/&#(\d+);/g, (_match, token) => {
      const code = Number.parseInt(token, 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    });
}

function stripHtmlToText(markup: string): string {
  return decodeHtmlEntities(
    markup
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|li|h1|h2|h3|h4|h5|h6|tr|section|article|div)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

function extractTagContent(markup: string, pattern: RegExp): string {
  const match = markup.match(pattern);
  if (!match) return "";
  return decodeHtmlEntities((match[1] ?? "").replace(/\s+/g, " ").trim());
}

function extractMetaContent(markup: string, name: string): string {
  const pattern = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    "i",
  );
  return extractTagContent(markup, pattern);
}

function extractJsonLdBlocks(markup: string): string[] {
  return Array.from(markup.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => (match[1] ?? "").trim())
    .filter(Boolean);
}

function collectJsonObjects(value: unknown): Record<string, unknown>[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectJsonObjects(entry));
  }
  if (typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const nodes: Record<string, unknown>[] = [record];
  if (Array.isArray(record["@graph"])) {
    nodes.push(...collectJsonObjects(record["@graph"]));
  }
  return nodes;
}

function isJobPostingType(value: unknown): boolean {
  if (typeof value === "string") {
    return value.toLowerCase().includes("jobposting");
  }
  if (Array.isArray(value)) {
    return value.some((entry) => typeof entry === "string" && entry.toLowerCase().includes("jobposting"));
  }
  return false;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getNestedString(record: Record<string, unknown>, path: string[]): string {
  let current: unknown = record;
  for (const key of path) {
    if (!current || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[key];
  }
  return getString(current);
}

function parseJobPostingFromJsonLd(markup: string): {
  roleTitle: string;
  companyName: string;
  location: string;
  employmentType: string;
  summary: string;
  jobDescription: string;
} | null {
  const blocks = extractJsonLdBlocks(markup);
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block) as unknown;
      const objects = collectJsonObjects(parsed);
      const match = objects.find((entry) => isJobPostingType(entry["@type"]));
      if (!match) continue;

      const roleTitle = getString(match.title) || getString(match.name);
      const companyName =
        getNestedString(match, ["hiringOrganization", "name"]) ||
        getNestedString(match, ["hiringOrganization", "legalName"]);
      const employmentType = getString(match.employmentType);
      const summary = getString(match.qualifications) || getString(match.responsibilities) || getString(match.description);
      const descriptionRaw = getString(match.description);
      const descriptionText = stripHtmlToText(descriptionRaw);

      let location = "";
      const jobLocation = match.jobLocation;
      if (Array.isArray(jobLocation) && jobLocation.length) {
        const first = jobLocation[0];
        if (first && typeof first === "object") {
          const firstObj = first as Record<string, unknown>;
          location =
            getNestedString(firstObj, ["address", "addressLocality"]) ||
            getNestedString(firstObj, ["address", "streetAddress"]) ||
            getNestedString(firstObj, ["address", "addressRegion"]) ||
            getNestedString(firstObj, ["address", "addressCountry"]);
        }
      } else if (jobLocation && typeof jobLocation === "object") {
        const locationObj = jobLocation as Record<string, unknown>;
        location =
          getNestedString(locationObj, ["address", "addressLocality"]) ||
          getNestedString(locationObj, ["address", "streetAddress"]) ||
          getNestedString(locationObj, ["address", "addressRegion"]) ||
          getNestedString(locationObj, ["address", "addressCountry"]);
      }

      const jobDescription = descriptionText.slice(0, 30_000);
      if (!jobDescription) continue;
      return {
        roleTitle,
        companyName,
        location,
        employmentType,
        summary: stripHtmlToText(summary).slice(0, 600),
        jobDescription,
      };
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  return null;
}

function extractMainMarkup(markup: string): string {
  const main = markup.match(/<main[\s\S]*?<\/main>/i)?.[0];
  if (main) return main;
  const article = markup.match(/<article[\s\S]*?<\/article>/i)?.[0];
  if (article) return article;
  const body = markup.match(/<body[\s\S]*?<\/body>/i)?.[0];
  return body ?? markup;
}

function parseRoleFromHtml(markup: string): string {
  return (
    extractTagContent(markup, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    extractMetaContent(markup, "og:title") ||
    extractTagContent(markup, /<title[^>]*>([\s\S]*?)<\/title>/i)
  ).slice(0, 140);
}

function parseCompanyFromHtml(markup: string): string {
  return (
    extractMetaContent(markup, "og:site_name") ||
    extractTagContent(markup, /(?:company|organization|employer)\s*[:\-]\s*([^\n<]{2,120})/i)
  ).slice(0, 120);
}

function parseLocationFromHtml(markup: string): string {
  return (
    extractTagContent(markup, /(?:location|city|remote)\s*[:\-]\s*([^\n<]{2,120})/i) ||
    extractMetaContent(markup, "job:location")
  ).slice(0, 120);
}

function buildFormattedJobDescription(options: {
  roleTitle: string;
  companyName: string;
  location: string;
  employmentType: string;
  summary: string;
  detailsText: string;
}): string {
  const lines: string[] = [];
  if (options.roleTitle) lines.push(`Role: ${options.roleTitle}`);
  if (options.companyName) lines.push(`Company: ${options.companyName}`);
  if (options.location) lines.push(`Location: ${options.location}`);
  if (options.employmentType) lines.push(`Employment type: ${options.employmentType}`);
  if (options.summary) lines.push(`Summary: ${options.summary}`);
  if (lines.length) lines.push("");
  lines.push("Job Description:");
  lines.push(options.detailsText);
  return lines.join("\n").trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = normalizeHttpUrl(searchParams.get("url") ?? "");
  const requestedTimeoutMs = Number.parseInt(searchParams.get("timeoutMs") ?? "", 10);
  const timeoutMs = Number.isFinite(requestedTimeoutMs) ? Math.max(3000, Math.min(20_000, requestedTimeoutMs)) : 12_000;

  if (!targetUrl) {
    return NextResponse.json<JobPostingRouteResponse>(
      {
        ok: false,
        error: "Provide a valid public HTTP/HTTPS URL.",
      },
      { status: 400 },
    );
  }

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      redirect: "follow",
      cache: "no-store",
      signal: abortController.signal,
      headers: {
        "user-agent": "UtilioraJobPostingImporter/1.0",
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
    });

    const finalUrl = response.url || targetUrl;
    const finalHost = new URL(finalUrl).hostname;
    if (isPrivateOrLocalHost(finalHost)) {
      return NextResponse.json<JobPostingRouteResponse>(
        { ok: false, error: "Redirected to a blocked local/private host." },
        { status: 400 },
      );
    }

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      return NextResponse.json<JobPostingRouteResponse>(
        { ok: false, error: "This URL does not return an HTML page." },
        { status: 415 },
      );
    }

    const markup = (await response.text()).slice(0, 1_200_000);
    const parsedJsonLd = parseJobPostingFromJsonLd(markup);
    if (parsedJsonLd) {
      const formatted = buildFormattedJobDescription({
        roleTitle: parsedJsonLd.roleTitle,
        companyName: parsedJsonLd.companyName,
        location: parsedJsonLd.location,
        employmentType: parsedJsonLd.employmentType,
        summary: parsedJsonLd.summary,
        detailsText: parsedJsonLd.jobDescription,
      });
      const wordCount = formatted.split(/\s+/).filter(Boolean).length;
      return NextResponse.json<JobPostingRouteResponse>({
        ok: true,
        requestedUrl: targetUrl,
        finalUrl,
        redirected: response.redirected,
        status: response.status,
        source: "jsonld",
        roleTitle: parsedJsonLd.roleTitle,
        companyName: parsedJsonLd.companyName,
        location: parsedJsonLd.location,
        employmentType: parsedJsonLd.employmentType,
        summary: parsedJsonLd.summary,
        jobDescription: formatted,
        wordCount,
      });
    }

    const roleTitle = parseRoleFromHtml(markup);
    const companyName = parseCompanyFromHtml(markup);
    const location = parseLocationFromHtml(markup);
    const summary =
      extractMetaContent(markup, "description") ||
      extractMetaContent(markup, "og:description") ||
      "";
    const detailsText = stripHtmlToText(extractMainMarkup(markup)).slice(0, 30_000);
    if (!detailsText) {
      return NextResponse.json<JobPostingRouteResponse>(
        { ok: false, error: "Could not extract enough readable job text from this URL." },
        { status: 422 },
      );
    }

    const formatted = buildFormattedJobDescription({
      roleTitle,
      companyName,
      location,
      employmentType: "",
      summary: summary.slice(0, 600),
      detailsText,
    });
    const wordCount = formatted.split(/\s+/).filter(Boolean).length;

    return NextResponse.json<JobPostingRouteResponse>({
      ok: true,
      requestedUrl: targetUrl,
      finalUrl,
      redirected: response.redirected,
      status: response.status,
      source: "html",
      roleTitle,
      companyName,
      location,
      employmentType: "",
      summary: summary.slice(0, 600),
      jobDescription: formatted,
      wordCount,
    });
  } catch (error) {
    const isAbort =
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError";
    return NextResponse.json<JobPostingRouteResponse>(
      {
        ok: false,
        error: isAbort ? `Request timed out after ${timeoutMs} ms.` : "Could not fetch this URL right now.",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
