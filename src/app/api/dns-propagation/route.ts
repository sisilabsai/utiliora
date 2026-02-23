import { NextRequest, NextResponse } from "next/server";

const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA"] as const;
type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

interface DnsWireRecord {
  name?: string;
  type?: number;
  TTL?: number;
  data?: string;
}

interface DnsWirePayload {
  Status?: number;
  TC?: boolean;
  RD?: boolean;
  RA?: boolean;
  AD?: boolean;
  Comment?: string;
  Answer?: DnsWireRecord[];
  Authority?: DnsWireRecord[];
}

interface DnsAnswerRow {
  name: string;
  type: string;
  ttl: number | null;
  data: string;
}

interface DnsResolverDefinition {
  id: "google" | "cloudflare" | "quad9" | "adguard";
  label: string;
  endpoint: string;
  needsJsonHeader: boolean;
}

interface DnsResolverResult {
  resolver: DnsResolverDefinition["id"];
  resolverLabel: string;
  ok: boolean;
  status: number;
  responseTimeMs: number;
  ad: boolean;
  tc: boolean;
  rd: boolean;
  ra: boolean;
  answers: DnsAnswerRow[];
  authorities: DnsAnswerRow[];
  answerSet: string[];
  answerFingerprint: string;
  error?: string;
}

const RESOLVERS: DnsResolverDefinition[] = [
  {
    id: "google",
    label: "Google (8.8.8.8)",
    endpoint: "https://dns.google/resolve",
    needsJsonHeader: false,
  },
  {
    id: "cloudflare",
    label: "Cloudflare (1.1.1.1)",
    endpoint: "https://cloudflare-dns.com/dns-query",
    needsJsonHeader: true,
  },
  {
    id: "quad9",
    label: "Quad9 (9.9.9.9)",
    endpoint: "https://dns.quad9.net/dns-query",
    needsJsonHeader: true,
  },
  {
    id: "adguard",
    label: "AdGuard (94.140.14.14)",
    endpoint: "https://dns.adguard-dns.com/dns-query",
    needsJsonHeader: true,
  },
];

const TYPE_CODE_TO_NAME: Record<number, string> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  6: "SOA",
  15: "MX",
  16: "TXT",
  28: "AAAA",
  33: "SRV",
  257: "CAA",
};

function normalizeHostToken(value: string): string {
  return value.trim().replace(/\.$/, "");
}

function normalizeDomainInput(rawValue: string | null): string | null {
  if (!rawValue) return null;
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (/^https?:\/\//i.test(candidate)) {
    try {
      candidate = new URL(candidate).hostname;
    } catch {
      return null;
    }
  } else {
    candidate = candidate.split("/")[0] ?? candidate;
  }

  const normalized = normalizeHostToken(candidate.toLowerCase());
  if (!normalized || normalized.length > 253) return null;
  if (!normalized.includes(".")) return null;

  const labels = normalized.split(".");
  const valid = labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label),
  );
  return valid ? normalized : null;
}

function parseRecordType(rawType: string | null): DnsRecordType {
  const normalized = rawType?.trim().toUpperCase();
  if (normalized && DNS_RECORD_TYPES.includes(normalized as DnsRecordType)) {
    return normalized as DnsRecordType;
  }
  return "A";
}

function parseTimeoutMs(rawValue: string | null): number {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (!Number.isFinite(parsed)) return 6000;
  return Math.max(2000, Math.min(12_000, parsed));
}

function mapRecord(record: DnsWireRecord): DnsAnswerRow | null {
  const data = (record.data ?? "").trim();
  if (!data) return null;
  return {
    name: normalizeHostToken(record.name ?? ""),
    type: TYPE_CODE_TO_NAME[record.type ?? -1] ?? String(record.type ?? "UNKNOWN"),
    ttl: Number.isFinite(record.TTL) ? Number(record.TTL) : null,
    data,
  };
}

function normalizeAnswerValue(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^"|"$/g, "").trim();
}

function fingerprintAnswers(answerSet: string[]): string {
  return answerSet.length ? answerSet.join(" | ") : "__NO_ANSWER__";
}

async function queryResolver(
  resolver: DnsResolverDefinition,
  domain: string,
  type: DnsRecordType,
  timeoutMs: number,
): Promise<DnsResolverResult> {
  const started = Date.now();
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), timeoutMs);

  try {
    const url = `${resolver.endpoint}?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`;
    const response = await fetch(url, {
      cache: "no-store",
      signal: abort.signal,
      headers: resolver.needsJsonHeader ? { Accept: "application/dns-json" } : undefined,
    });
    if (!response.ok) {
      return {
        resolver: resolver.id,
        resolverLabel: resolver.label,
        ok: false,
        status: response.status,
        responseTimeMs: Date.now() - started,
        ad: false,
        tc: false,
        rd: false,
        ra: false,
        answers: [],
        authorities: [],
        answerSet: [],
        answerFingerprint: "__NO_ANSWER__",
        error: `Resolver returned ${response.status}.`,
      };
    }

    const payload = (await response.json()) as DnsWirePayload;
    const status = Number.isInteger(payload.Status) ? Number(payload.Status) : -1;
    const answers = (payload.Answer ?? []).map(mapRecord).filter((record): record is DnsAnswerRow => Boolean(record));
    const authorities = (payload.Authority ?? [])
      .map(mapRecord)
      .filter((record): record is DnsAnswerRow => Boolean(record));
    const answerSet = [...new Set(answers.map((answer) => normalizeAnswerValue(answer.data)).filter(Boolean))].sort();
    const answerFingerprint = fingerprintAnswers(answerSet);

    return {
      resolver: resolver.id,
      resolverLabel: resolver.label,
      ok: status === 0,
      status,
      responseTimeMs: Date.now() - started,
      ad: Boolean(payload.AD),
      tc: Boolean(payload.TC),
      rd: Boolean(payload.RD),
      ra: Boolean(payload.RA),
      answers,
      authorities,
      answerSet,
      answerFingerprint,
      ...(status !== 0 && payload.Comment ? { error: payload.Comment } : {}),
    };
  } catch (error) {
    const aborted =
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError";
    return {
      resolver: resolver.id,
      resolverLabel: resolver.label,
      ok: false,
      status: -1,
      responseTimeMs: Date.now() - started,
      ad: false,
      tc: false,
      rd: false,
      ra: false,
      answers: [],
      authorities: [],
      answerSet: [],
      answerFingerprint: "__NO_ANSWER__",
      error: aborted ? `Timeout after ${timeoutMs} ms.` : "Resolver request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const domain = normalizeDomainInput(params.get("domain"));
  if (!domain) {
    return NextResponse.json(
      { ok: false, error: "Provide a valid domain, for example: example.com" },
      { status: 400 },
    );
  }

  const type = parseRecordType(params.get("type"));
  const timeoutMs = parseTimeoutMs(params.get("timeoutMs"));
  const started = Date.now();

  const resolverResults = await Promise.all(
    RESOLVERS.map((resolver) => queryResolver(resolver, domain, type, timeoutMs)),
  );

  const successful = resolverResults.filter((result) => !result.error);
  const fingerprintFrequency = new Map<string, number>();
  successful.forEach((result) => {
    fingerprintFrequency.set(result.answerFingerprint, (fingerprintFrequency.get(result.answerFingerprint) ?? 0) + 1);
  });

  const sortedFingerprints = [...fingerprintFrequency.entries()].sort((a, b) => b[1] - a[1]);
  const majorityFingerprint = sortedFingerprints[0]?.[0] ?? "__NO_ANSWER__";
  const majorityCount = sortedFingerprints[0]?.[1] ?? 0;
  const consensusAnswers =
    majorityFingerprint === "__NO_ANSWER__" ? [] : majorityFingerprint.split(" | ").map((entry) => entry.trim());

  const propagationPercent =
    successful.length > 0 ? Math.round((majorityCount / successful.length) * 1000) / 10 : 0;

  const propagationMismatches = resolverResults
    .filter((result) => !result.error && result.answerFingerprint !== majorityFingerprint)
    .map((result) => ({
      resolver: result.resolver,
      resolverLabel: result.resolverLabel,
      answerSet: result.answerSet,
    }));

  return NextResponse.json(
    {
      ok: true,
      domain,
      type,
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      timeoutMs,
      resolvers: resolverResults,
      summary: {
        resolverCount: resolverResults.length,
        successfulResolvers: successful.length,
        failedResolvers: resolverResults.length - successful.length,
        uniqueAnswerSets: sortedFingerprints.length,
        majorityCount,
        propagationPercent,
        fullyPropagated: sortedFingerprints.length <= 1,
        consensusAnswers,
        mismatches: propagationMismatches,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

