import { NextRequest, NextResponse } from "next/server";

type CheckSeverity = "critical" | "important" | "info";

interface AuditCheckResult {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  severity: CheckSeverity;
  weight: number;
}

interface PageAudit {
  path: string;
  url: string;
  status: number;
  redirected: boolean;
  finalUrl: string;
  contentType: string;
  noindex: boolean;
  title: string;
  canonical: string;
  wordCount: number;
  internalLinkCount: number;
  error?: string;
}

const TRUST_PAGE_PATHS = ["/about", "/contact", "/privacy", "/terms"] as const;
const ESSENTIAL_ASSET_PATHS = ["/robots.txt", "/sitemap.xml", "/ads.txt"] as const;

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

function normalizeBaseUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = /^[a-zA-Z][\w+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (isPrivateOrLocalHost(parsed.hostname)) return null;
    parsed.hash = "";
    parsed.search = "";
    parsed.pathname = "/";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function normalizeAdditionalPaths(rawPaths: unknown): string[] {
  if (!Array.isArray(rawPaths)) return [];
  const normalized = rawPaths
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .map((path) => {
      const strippedHost = path.replace(/^https?:\/\/[^/]+/i, "");
      const withLeadingSlash = strippedHost.startsWith("/") ? strippedHost : `/${strippedHost}`;
      return withLeadingSlash.split("#")[0]?.trim() ?? withLeadingSlash;
    })
    .filter((path) => path.startsWith("/"));
  return [...new Set(normalized)].slice(0, 10);
}

function extractTagContent(markup: string, pattern: RegExp): string {
  const match = markup.match(pattern);
  if (!match) return "";
  return (match[1] ?? "").replace(/\s+/g, " ").trim();
}

function extractMetaContent(markup: string, name: string): string {
  const pattern = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>`,
    "i",
  );
  return extractTagContent(markup, pattern);
}

function stripHtmlToText(markup: string): string {
  return markup
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractAnchorUrls(markup: string): string[] {
  const matches = Array.from(markup.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi));
  return matches.map((match) => (match[1] ?? "").trim()).filter(Boolean);
}

function summarizePage(
  path: string,
  requestUrl: string,
  status: number,
  redirected: boolean,
  finalUrl: string,
  contentType: string,
  bodyText: string,
): { page: PageAudit; internalPathSet: Set<string> } {
  const title = extractTagContent(bodyText, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const robots = extractMetaContent(bodyText, "robots");
  const canonical = extractTagContent(bodyText, /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
  const plainText = stripHtmlToText(bodyText);
  const wordCount = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;

  const requestHost = new URL(requestUrl).hostname;
  const internalPathSet = new Set<string>();
  const anchors = extractAnchorUrls(bodyText);
  anchors.forEach((href) => {
    if (href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) return;
    try {
      const resolved = new URL(href, requestUrl);
      if (resolved.hostname !== requestHost) return;
      const normalizedPath = resolved.pathname.replace(/\/+$/, "") || "/";
      internalPathSet.add(normalizedPath);
    } catch {
      // Ignore malformed href.
    }
  });

  return {
    page: {
      path,
      url: requestUrl,
      status,
      redirected,
      finalUrl,
      contentType,
      title,
      canonical,
      noindex: /(^|[,\s])noindex([,\s]|$)/i.test(robots),
      wordCount,
      internalLinkCount: internalPathSet.size,
    },
    internalPathSet,
  };
}

async function fetchPageAudit(url: string, path: string, timeoutMs: number): Promise<{ page: PageAudit; internalPathSet: Set<string> }> {
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: abortController.signal,
      headers: {
        "user-agent": "UtilioraAdSenseAudit/1.0",
      },
    });

    const finalUrl = response.url || url;
    const finalHost = new URL(finalUrl).hostname;
    if (isPrivateOrLocalHost(finalHost)) {
      throw new Error("Redirected to a blocked local/private host.");
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const isTextContent =
      contentType.includes("text/") || contentType.includes("application/json") || contentType.includes("application/xml");
    const bodyText = isTextContent ? (await response.text()).slice(0, 500_000) : "";

    return summarizePage(path, url, response.status, response.redirected, finalUrl, contentType, bodyText);
  } catch (error) {
    const isAbort =
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError";

    return {
      page: {
        path,
        url,
        status: 0,
        redirected: false,
        finalUrl: url,
        contentType: "",
        title: "",
        canonical: "",
        noindex: false,
        wordCount: 0,
        internalLinkCount: 0,
        error: isAbort ? `Request timed out after ${timeoutMs} ms.` : "Page request failed.",
      },
      internalPathSet: new Set<string>(),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function severityRank(value: CheckSeverity): number {
  if (value === "critical") return 0;
  if (value === "important") return 1;
  return 2;
}

function getGrade(scorePercent: number): string {
  if (scorePercent >= 85) return "A (ready)";
  if (scorePercent >= 70) return "B (almost ready)";
  if (scorePercent >= 55) return "C (needs improvement)";
  return "D (high risk)";
}

async function runAudit(options: { baseUrl: string; additionalPaths: string[]; timeoutMs: number }) {
  const baseUrl = options.baseUrl;
  const timeoutMs = options.timeoutMs;
  const auditPaths = [
    ...new Set<string>(["/", ...TRUST_PAGE_PATHS, ...ESSENTIAL_ASSET_PATHS, ...options.additionalPaths]),
  ];

  const startedAt = Date.now();
  const pageAudits = await Promise.all(
    auditPaths.map((path) => {
      const absoluteUrl = new URL(path, `${baseUrl}/`).toString();
      return fetchPageAudit(absoluteUrl, path, timeoutMs);
    }),
  );
  const byPath = new Map(pageAudits.map((entry) => [entry.page.path, entry]));
  const homepage = byPath.get("/");
  const trustPages = TRUST_PAGE_PATHS.map((path) => byPath.get(path)?.page).filter((entry): entry is PageAudit => Boolean(entry));
  const robots = byPath.get("/robots.txt")?.page;
  const sitemap = byPath.get("/sitemap.xml")?.page;
  const ads = byPath.get("/ads.txt")?.page;

  const homepagePaths = homepage?.internalPathSet ?? new Set<string>();
  const linksTrustPages = TRUST_PAGE_PATHS.filter((path) => homepagePaths.has(path));

  const checks: AuditCheckResult[] = [
    {
      id: "home-access",
      label: "Homepage is reachable",
      passed: Boolean(homepage && homepage.page.status >= 200 && homepage.page.status < 400),
      detail: homepage?.page.error ?? `Status ${homepage?.page.status ?? 0}`,
      severity: "critical",
      weight: 18,
    },
    {
      id: "home-indexable",
      label: "Homepage is indexable (not noindex)",
      passed: Boolean(homepage && !homepage.page.noindex),
      detail: homepage?.page.noindex ? "Homepage contains noindex directive." : "No noindex detected.",
      severity: "critical",
      weight: 14,
    },
    {
      id: "home-content-depth",
      label: "Homepage has substantial content",
      passed: Boolean(homepage && homepage.page.wordCount >= 280),
      detail: `${homepage?.page.wordCount ?? 0} words detected (recommended: 280+).`,
      severity: "important",
      weight: 10,
    },
    {
      id: "about-page",
      label: "About page exists and is indexable",
      passed: Boolean(byPath.get("/about") && (byPath.get("/about")?.page.status ?? 0) < 400 && !byPath.get("/about")?.page.noindex),
      detail: byPath.get("/about")?.page.error ?? `Status ${byPath.get("/about")?.page.status ?? 0}`,
      severity: "critical",
      weight: 12,
    },
    {
      id: "contact-page",
      label: "Contact page exists and is indexable",
      passed: Boolean(byPath.get("/contact") && (byPath.get("/contact")?.page.status ?? 0) < 400 && !byPath.get("/contact")?.page.noindex),
      detail: byPath.get("/contact")?.page.error ?? `Status ${byPath.get("/contact")?.page.status ?? 0}`,
      severity: "critical",
      weight: 12,
    },
    {
      id: "privacy-page",
      label: "Privacy page exists and is indexable",
      passed: Boolean(byPath.get("/privacy") && (byPath.get("/privacy")?.page.status ?? 0) < 400 && !byPath.get("/privacy")?.page.noindex),
      detail: byPath.get("/privacy")?.page.error ?? `Status ${byPath.get("/privacy")?.page.status ?? 0}`,
      severity: "critical",
      weight: 12,
    },
    {
      id: "terms-page",
      label: "Terms page exists and is indexable",
      passed: Boolean(byPath.get("/terms") && (byPath.get("/terms")?.page.status ?? 0) < 400 && !byPath.get("/terms")?.page.noindex),
      detail: byPath.get("/terms")?.page.error ?? `Status ${byPath.get("/terms")?.page.status ?? 0}`,
      severity: "critical",
      weight: 12,
    },
    {
      id: "robots-txt",
      label: "robots.txt is reachable",
      passed: Boolean(robots && robots.status >= 200 && robots.status < 400),
      detail: robots?.error ?? `Status ${robots?.status ?? 0}`,
      severity: "important",
      weight: 8,
    },
    {
      id: "sitemap-xml",
      label: "sitemap.xml is reachable",
      passed: Boolean(sitemap && sitemap.status >= 200 && sitemap.status < 400),
      detail: sitemap?.error ?? `Status ${sitemap?.status ?? 0}`,
      severity: "important",
      weight: 8,
    },
    {
      id: "ads-txt",
      label: "ads.txt is reachable",
      passed: Boolean(ads && ads.status >= 200 && ads.status < 400),
      detail: ads?.error ?? `Status ${ads?.status ?? 0}`,
      severity: "important",
      weight: 7,
    },
    {
      id: "home-links-trust-pages",
      label: "Homepage links to trust pages",
      passed: linksTrustPages.length >= 3,
      detail: `Homepage links ${linksTrustPages.length}/4 trust pages.`,
      severity: "info",
      weight: 5,
    },
    {
      id: "trust-page-depth",
      label: "Trust pages have enough content",
      passed: trustPages.filter((page) => page.wordCount >= 120).length >= 3,
      detail: `${trustPages.filter((page) => page.wordCount >= 120).length}/4 trust pages have 120+ words.`,
      severity: "important",
      weight: 8,
    },
  ];

  const maxScore = checks.reduce((sum, check) => sum + check.weight, 0);
  const score = checks.reduce((sum, check) => sum + (check.passed ? check.weight : 0), 0);
  const scorePercent = Math.round((score / maxScore) * 100);

  const failedChecks = checks
    .filter((check) => !check.passed)
    .sort((left, right) => severityRank(left.severity) - severityRank(right.severity) || right.weight - left.weight);

  return {
    ok: true,
    baseUrl,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    score: {
      value: score,
      max: maxScore,
      percent: scorePercent,
      grade: getGrade(scorePercent),
      passedChecks: checks.filter((check) => check.passed).length,
      totalChecks: checks.length,
    },
    checks,
    fixOrder: failedChecks.map((check) => ({
      id: check.id,
      label: check.label,
      severity: check.severity,
      detail: check.detail,
    })),
    assets: {
      robots: robots ?? null,
      sitemap: sitemap ?? null,
      adsTxt: ads ?? null,
    },
    pages: pageAudits.map((entry) => entry.page),
    trustPages: TRUST_PAGE_PATHS.map((path) => byPath.get(path)?.page ?? null),
    homepage: homepage?.page ?? null,
    linkedTrustPages: linksTrustPages,
  };
}

function parseTimeout(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 8000;
  return Math.max(2500, Math.min(15_000, Math.round(parsed)));
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      baseUrl?: string;
      additionalPaths?: string[];
      timeoutMs?: number;
    };
    const normalizedBaseUrl = normalizeBaseUrl(body.baseUrl ?? "");
    if (!normalizedBaseUrl) {
      return NextResponse.json(
        { ok: false, error: "Provide a valid public website URL (http/https)." },
        { status: 400 },
      );
    }
    const additionalPaths = normalizeAdditionalPaths(body.additionalPaths ?? []);
    const timeoutMs = parseTimeout(body.timeoutMs);
    const report = await runAudit({ baseUrl: normalizedBaseUrl, additionalPaths, timeoutMs });
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not run audit. Verify input and try again." },
      { status: 500 },
    );
  }
}
