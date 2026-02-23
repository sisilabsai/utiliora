import { NextRequest, NextResponse } from "next/server";

const DNS_RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA"] as const;
type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];

type ResolverProvider = "google" | "cloudflare";

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
  CD?: boolean;
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

interface DnsTypeLookupResult {
  ok: boolean;
  status: number;
  rd: boolean;
  ra: boolean;
  ad: boolean;
  tc: boolean;
  comment?: string;
  responseTimeMs: number;
  answers: DnsAnswerRow[];
  authorities: DnsAnswerRow[];
  error?: string;
}

const TYPE_CODE_TO_NAME: Record<number, string> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  6: "SOA",
  12: "PTR",
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

function parseResolver(rawResolver: string | null): ResolverProvider {
  return rawResolver?.toLowerCase() === "cloudflare" ? "cloudflare" : "google";
}

function parseTypes(rawTypes: string | null): DnsRecordType[] {
  if (!rawTypes) return [...DNS_RECORD_TYPES];
  const normalized = rawTypes
    .split(",")
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry): entry is DnsRecordType => DNS_RECORD_TYPES.includes(entry as DnsRecordType));
  const unique = [...new Set(normalized)];
  return unique.length ? unique : [...DNS_RECORD_TYPES];
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

function parseMxHost(recordData: string): string {
  const parts = recordData.trim().split(/\s+/);
  if (parts.length < 2) return normalizeHostToken(recordData);
  return normalizeHostToken(parts.slice(1).join(" "));
}

async function queryDns(
  domain: string,
  type: DnsRecordType,
  resolver: ResolverProvider,
  timeoutMs: number,
): Promise<DnsTypeLookupResult> {
  const startedAt = Date.now();
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), timeoutMs);

  try {
    const requestUrl =
      resolver === "cloudflare"
        ? `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`
        : `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}&cd=0&do=1`;

    const response = await fetch(requestUrl, {
      cache: "no-store",
      signal: abort.signal,
      headers: resolver === "cloudflare" ? { Accept: "application/dns-json" } : undefined,
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        rd: false,
        ra: false,
        ad: false,
        tc: false,
        responseTimeMs: Date.now() - startedAt,
        answers: [],
        authorities: [],
        error: `Resolver returned status ${response.status}.`,
      };
    }

    const payload = (await response.json()) as DnsWirePayload;
    const answers = (payload.Answer ?? []).map(mapRecord).filter((row): row is DnsAnswerRow => Boolean(row));
    const authorities = (payload.Authority ?? [])
      .map(mapRecord)
      .filter((row): row is DnsAnswerRow => Boolean(row));
    const status = Number.isInteger(payload.Status) ? Number(payload.Status) : -1;

    return {
      ok: status === 0,
      status,
      rd: Boolean(payload.RD),
      ra: Boolean(payload.RA),
      ad: Boolean(payload.AD),
      tc: Boolean(payload.TC),
      comment: typeof payload.Comment === "string" ? payload.Comment : undefined,
      responseTimeMs: Date.now() - startedAt,
      answers,
      authorities,
    };
  } catch (error) {
    const aborted =
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError";

    return {
      ok: false,
      status: -1,
      rd: false,
      ra: false,
      ad: false,
      tc: false,
      responseTimeMs: Date.now() - startedAt,
      answers: [],
      authorities: [],
      error: aborted ? `Resolver timeout after ${timeoutMs} ms.` : "Resolver request failed.",
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
      {
        ok: false,
        error: "Provide a valid domain, for example: example.com",
      },
      { status: 400 },
    );
  }

  const resolver = parseResolver(params.get("resolver"));
  const types = parseTypes(params.get("types")).slice(0, 12);
  const requestedTimeout = Number.parseInt(params.get("timeoutMs") ?? "", 10);
  const timeoutMs = Number.isFinite(requestedTimeout)
    ? Math.max(2000, Math.min(12_000, requestedTimeout))
    : 6000;

  const started = Date.now();
  const lookups = await Promise.all(
    types.map(async (type) => {
      const result = await queryDns(domain, type, resolver, timeoutMs);
      return [type, result] as const;
    }),
  );

  const results = Object.fromEntries(lookups) as Record<DnsRecordType, DnsTypeLookupResult>;
  const dmarcLookup = await queryDns(`_dmarc.${domain}`, "TXT", resolver, timeoutMs);

  const txtRecords = (results.TXT?.answers ?? []).map((record) => record.data);
  const mxRecords = (results.MX?.answers ?? []).map((record) => parseMxHost(record.data));
  const nsRecords = (results.NS?.answers ?? []).map((record) => normalizeHostToken(record.data));
  const hasSpf = txtRecords.some((record) => /\bv=spf1\b/i.test(record));
  const hasDmarc = dmarcLookup.answers.some((record) => /\bv=dmarc1\b/i.test(record.data));
  const hasDnssecSignal = Object.values(results).some((result) => result.ad);
  const totalAnswers = Object.values(results).reduce((sum, result) => sum + result.answers.length, 0);

  return NextResponse.json(
    {
      ok: true,
      domain,
      resolver,
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      timeoutMs,
      types,
      results,
      dmarc: dmarcLookup,
      insights: {
        hasA: (results.A?.answers.length ?? 0) > 0,
        hasAAAA: (results.AAAA?.answers.length ?? 0) > 0,
        hasMx: (results.MX?.answers.length ?? 0) > 0,
        hasTxt: (results.TXT?.answers.length ?? 0) > 0,
        hasNs: (results.NS?.answers.length ?? 0) > 0,
        hasCaa: (results.CAA?.answers.length ?? 0) > 0,
        hasSpf,
        hasDmarc,
        hasDnssecSignal,
        totalAnswers,
        mxHosts: mxRecords,
        nameservers: nsRecords,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
