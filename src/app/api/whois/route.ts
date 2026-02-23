import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}

interface RdapNameServer {
  ldhName?: string;
  unicodeName?: string;
}

interface RdapPublicId {
  type?: string;
  identifier?: string;
}

interface RdapEntity {
  roles?: string[];
  handle?: string;
  entities?: RdapEntity[];
  publicIds?: RdapPublicId[];
  vcardArray?: unknown;
}

interface RdapLink {
  href?: string;
}

interface RdapNotice {
  title?: string;
  description?: string[];
}

interface RdapPayload {
  ldhName?: string;
  unicodeName?: string;
  handle?: string;
  status?: string[];
  nameservers?: RdapNameServer[];
  events?: RdapEvent[];
  entities?: RdapEntity[];
  secureDNS?: { delegationSigned?: boolean };
  links?: RdapLink[];
  notices?: RdapNotice[];
}

interface FlattenedRdapEntity {
  handle: string;
  roles: string[];
  publicIds: RdapPublicId[];
  profile: {
    fullName: string | null;
    organization: string | null;
    country: string | null;
    email: string | null;
    phone: string | null;
  };
}

const TLD_RDAP_FALLBACKS: Partial<Record<string, string[]>> = {
  com: ["https://rdap.verisign.com/com/v1/domain/{domain}"],
  net: ["https://rdap.verisign.com/net/v1/domain/{domain}"],
  org: ["https://rdap.publicinterestregistry.org/rdap/domain/{domain}"],
  io: ["https://rdap.nic.io/domain/{domain}"],
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

function parseTimeoutMs(rawValue: string | null): number {
  const parsed = Number.parseInt(rawValue ?? "", 10);
  if (!Number.isFinite(parsed)) return 9000;
  return Math.max(3000, Math.min(20_000, parsed));
}

function parseBoolean(rawValue: string | null): boolean {
  return rawValue === "1" || rawValue === "true";
}

function buildCandidateUrls(domain: string): string[] {
  const tld = domain.split(".").at(-1) ?? "";
  const tldFallbacks = (TLD_RDAP_FALLBACKS[tld] ?? []).map((template) =>
    template.replace("{domain}", encodeURIComponent(domain)),
  );
  return [...new Set([`https://rdap.org/domain/${encodeURIComponent(domain)}`, ...tldFallbacks])];
}

async function fetchJsonWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<{ ok: true; payload: RdapPayload } | { ok: false; status: number; error: string }> {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: abort.signal,
      headers: {
        Accept: "application/rdap+json, application/json;q=0.9, */*;q=0.8",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `RDAP endpoint returned ${response.status}.`,
      };
    }

    const payload = (await response.json()) as RdapPayload;
    return { ok: true, payload };
  } catch (error) {
    const aborted =
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      (error as { name?: string }).name === "AbortError";
    return {
      ok: false,
      status: 0,
      error: aborted ? `RDAP request timed out after ${timeoutMs} ms.` : "RDAP request failed.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractVcardField(vcardArray: unknown, propertyName: string): string | null {
  if (!Array.isArray(vcardArray) || vcardArray.length < 2 || !Array.isArray(vcardArray[1])) return null;
  const entries = vcardArray[1] as unknown[];
  const matching = entries.find((entry) => Array.isArray(entry) && entry[0] === propertyName);
  if (!Array.isArray(matching) || matching.length < 4) return null;
  const value = matching[3];
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    const joined = value.filter((part) => typeof part === "string").join(" ").trim();
    return joined || null;
  }
  return null;
}

function flattenRdapEntities(entities: RdapEntity[] | undefined, inheritedRoles: string[] = []): FlattenedRdapEntity[] {
  if (!entities?.length) return [];
  const flattened: FlattenedRdapEntity[] = [];

  entities.forEach((entity) => {
    const roles = [...new Set([...(entity.roles ?? []), ...inheritedRoles])];
    const entry: FlattenedRdapEntity = {
      handle: entity.handle ?? "unknown",
      roles,
      publicIds: entity.publicIds ?? [],
      profile: {
        fullName: extractVcardField(entity.vcardArray, "fn"),
        organization: extractVcardField(entity.vcardArray, "org"),
        country: extractVcardField(entity.vcardArray, "country-name"),
        email: extractVcardField(entity.vcardArray, "email"),
        phone: extractVcardField(entity.vcardArray, "tel"),
      },
    };
    flattened.push(entry);
    flattened.push(...flattenRdapEntities(entity.entities, roles));
  });

  return flattened;
}

function findEventDate(events: RdapEvent[] | undefined, candidates: string[]): string | null {
  if (!events?.length) return null;
  const normalized = candidates.map((candidate) => candidate.toLowerCase());
  const match = events.find((event) => {
    const action = (event.eventAction ?? "").toLowerCase();
    return normalized.some((candidate) => action.includes(candidate));
  });
  if (!match?.eventDate) return null;
  const parsed = new Date(match.eventDate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function extractRegistrar(entities: FlattenedRdapEntity[]): {
  name: string | null;
  handle: string | null;
  ianaId: string | null;
} {
  const registrar = entities.find((entity) => entity.roles.some((role) => role.toLowerCase() === "registrar"));
  if (!registrar) {
    return { name: null, handle: null, ianaId: null };
  }
  const ianaId =
    registrar.publicIds.find((entry) => (entry.type ?? "").toUpperCase() === "IANA Registrar ID")?.identifier ?? null;
  return {
    name: registrar.profile.organization ?? registrar.profile.fullName,
    handle: registrar.handle ?? null,
    ianaId,
  };
}

function calculateDaysRemaining(dateValue: string | null): number | null {
  if (!dateValue) return null;
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.floor((timestamp - Date.now()) / (24 * 60 * 60 * 1000));
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const domain = normalizeDomainInput(params.get("domain"));
  if (!domain) {
    return NextResponse.json(
      { ok: false, error: "Provide a valid domain. Example: example.com" },
      { status: 400 },
    );
  }

  const timeoutMs = parseTimeoutMs(params.get("timeoutMs"));
  const includeRaw = parseBoolean(params.get("includeRaw"));
  const candidates = buildCandidateUrls(domain);

  let selectedPayload: RdapPayload | null = null;
  let selectedSource = "";
  let lastError = "WHOIS lookup failed.";
  let lastStatus = 502;

  for (const candidate of candidates) {
    const result = await fetchJsonWithTimeout(candidate, timeoutMs);
    if (result.ok) {
      selectedPayload = result.payload;
      selectedSource = candidate;
      break;
    }
    lastError = result.error;
    if (result.status === 404) {
      lastStatus = 404;
    } else if (result.status === 0) {
      lastStatus = 504;
    }
  }

  if (!selectedPayload) {
    return NextResponse.json(
      { ok: false, domain, error: lastError },
      { status: lastStatus, headers: { "Cache-Control": "no-store" } },
    );
  }

  const flattenedEntities = flattenRdapEntities(selectedPayload.entities);
  const registrar = extractRegistrar(flattenedEntities);
  const registrant = flattenedEntities.find((entity) =>
    entity.roles.some((role) => role.toLowerCase() === "registrant"),
  );

  const registrationDate = findEventDate(selectedPayload.events, ["registration", "registered"]);
  const expirationDate = findEventDate(selectedPayload.events, ["expiration", "expiry", "expires"]);
  const lastChangedDate = findEventDate(selectedPayload.events, ["last changed"]);
  const lastTransferDate = findEventDate(selectedPayload.events, ["last transfer"]);
  const lastRdapUpdateDate = findEventDate(selectedPayload.events, [
    "last update of rdap database",
    "last update of whois database",
  ]);

  const nameservers = (selectedPayload.nameservers ?? [])
    .map((entry) => normalizeHostToken(entry.ldhName ?? entry.unicodeName ?? ""))
    .filter(Boolean);

  const statuses = (selectedPayload.status ?? []).filter((status) => typeof status === "string");
  const notices = (selectedPayload.notices ?? [])
    .map((entry) => `${entry.title ?? "Notice"}: ${(entry.description ?? []).join(" ")}`.trim())
    .filter((value) => value !== ":" && value.length > 0);
  const links = (selectedPayload.links ?? [])
    .map((entry) => entry.href ?? "")
    .filter((value) => typeof value === "string" && value.length > 0);

  const daysUntilExpiration = calculateDaysRemaining(expirationDate);

  const responsePayload = {
    ok: true,
    domain,
    normalizedDomain: selectedPayload.ldhName ?? domain,
    unicodeDomain: selectedPayload.unicodeName ?? null,
    handle: selectedPayload.handle ?? null,
    rdapSource: selectedSource,
    checkedAt: new Date().toISOString(),
    timeoutMs,
    statuses,
    dnssecSigned:
      typeof selectedPayload.secureDNS?.delegationSigned === "boolean"
        ? selectedPayload.secureDNS.delegationSigned
        : null,
    nameservers,
    registrar,
    registrant: registrant
      ? {
          handle: registrant.handle,
          fullName: registrant.profile.fullName,
          organization: registrant.profile.organization,
          country: registrant.profile.country,
          email: registrant.profile.email,
          phone: registrant.profile.phone,
        }
      : null,
    contacts: flattenedEntities.slice(0, 20).map((entity) => ({
      handle: entity.handle,
      roles: entity.roles,
      fullName: entity.profile.fullName,
      organization: entity.profile.organization,
      country: entity.profile.country,
      email: entity.profile.email,
      phone: entity.profile.phone,
    })),
    events: {
      registration: registrationDate,
      expiration: expirationDate,
      lastChanged: lastChangedDate,
      lastTransfer: lastTransferDate,
      lastRdapUpdate: lastRdapUpdateDate,
      daysUntilExpiration,
      expired: typeof daysUntilExpiration === "number" ? daysUntilExpiration < 0 : null,
    },
    notices,
    links,
    ...(includeRaw ? { raw: selectedPayload } : {}),
  };

  return NextResponse.json(responsePayload, { headers: { "Cache-Control": "no-store" } });
}

