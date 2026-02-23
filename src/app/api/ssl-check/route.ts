import { lookup } from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface ParsedTarget {
  raw: string;
  host: string;
  port: number;
  normalized: string;
}

interface ChainCertificate {
  depth: number;
  subject: string;
  issuer: string;
  validFrom: string | null;
  validTo: string | null;
  serialNumber: string | null;
  fingerprint256: string | null;
  selfSigned: boolean;
}

function parseTarget(rawValue: string | null): ParsedTarget | null {
  if (!rawValue) return null;
  const raw = rawValue.trim();
  if (!raw) return null;

  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    const parsed = new URL(hasScheme ? raw : `https://${raw}`);
    const host = parsed.hostname.trim();
    if (!host) return null;

    const parsedPort = parsed.port ? Number.parseInt(parsed.port, 10) : 443;
    if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) return null;

    return {
      raw,
      host,
      port: parsedPort,
      normalized: `${host}:${parsedPort}`,
    };
  } catch {
    return null;
  }
}

function isPrivateIpv4(address: string): boolean {
  const segments = address.split(".").map((segment) => Number.parseInt(segment, 10));
  if (segments.length !== 4 || segments.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return true;
  }
  const [a, b] = segments;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  if (normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true;
  }
  return false;
}

function isPrivateIpAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

function isPrivateOrLocalHost(host: string): boolean {
  const normalized = host.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "localhost" || normalized.endsWith(".local")) return true;
  if (normalized === "::1") return true;

  const version = net.isIP(normalized);
  if (version === 4 || version === 6) return isPrivateIpAddress(normalized);
  return false;
}

function formatDistinguishedName(value: unknown): string {
  if (!value || typeof value !== "object") return "Unknown";
  const entries = Object.entries(value as Record<string, unknown>)
    .filter((entry) => typeof entry[1] === "string" && String(entry[1]).trim().length > 0)
    .map(([key, content]) => `${key}=${String(content)}`);
  return entries.length ? entries.join(", ") : "Unknown";
}

function parseSanList(rawSan: string | undefined): string[] {
  if (!rawSan) return [];
  return rawSan
    .split(",")
    .map((entry) => entry.trim())
    .map((entry) => entry.replace(/^[^:]+:\s*/i, ""))
    .filter(Boolean);
}

function toIsoDate(rawValue: string | undefined): string | null {
  if (!rawValue) return null;
  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toPem(raw: Buffer | undefined): string | null {
  if (!raw || !Buffer.isBuffer(raw)) return null;
  const body = raw.toString("base64").match(/.{1,64}/g)?.join("\n");
  if (!body) return null;
  return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`;
}

function extractChain(root: tls.DetailedPeerCertificate): ChainCertificate[] {
  const chain: ChainCertificate[] = [];
  const seenFingerprints = new Set<string>();
  let current: tls.DetailedPeerCertificate | null = root;

  for (let depth = 0; depth < 12; depth += 1) {
    if (!current || !Object.keys(current).length) break;
    const fingerprint = current.fingerprint256 || current.serialNumber || `depth-${depth}`;
    if (seenFingerprints.has(fingerprint)) break;
    seenFingerprints.add(fingerprint);

    const subject = formatDistinguishedName(current.subject);
    const issuer = formatDistinguishedName(current.issuer);
    chain.push({
      depth,
      subject,
      issuer,
      validFrom: toIsoDate(current.valid_from),
      validTo: toIsoDate(current.valid_to),
      serialNumber: current.serialNumber || null,
      fingerprint256: current.fingerprint256 || null,
      selfSigned: subject === issuer,
    });

    const issuerCertificate = current.issuerCertificate as tls.DetailedPeerCertificate | undefined;
    if (!issuerCertificate || !Object.keys(issuerCertificate).length) break;
    if (
      issuerCertificate.fingerprint256 &&
      current.fingerprint256 &&
      issuerCertificate.fingerprint256 === current.fingerprint256
    ) {
      break;
    }
    current = issuerCertificate;
  }

  return chain;
}

async function resolveHostAddresses(host: string): Promise<string[]> {
  try {
    const entries = await lookup(host, { all: true, verbatim: true });
    const unique = [...new Set(entries.map((entry) => entry.address))];
    return unique.slice(0, 20);
  } catch {
    return [];
  }
}

async function inspectTlsCertificate(target: ParsedTarget, timeoutMs: number, includePem: boolean) {
  return await new Promise<{
    timingMs: number;
    protocol: string;
    alpnProtocol: string;
    authorized: boolean;
    authorizationError: string | null;
    cipher: tls.CipherNameAndProtocol;
    certificate: {
      subject: string;
      issuer: string;
      serialNumber: string | null;
      fingerprint256: string | null;
      fingerprint: string | null;
      validFrom: string | null;
      validTo: string | null;
      daysRemaining: number | null;
      isExpired: boolean;
      expiresSoon: boolean;
      subjectAltNames: string[];
      subjectAltNameCount: number;
      infoAccess: string[];
      extKeyUsage: string[];
      pem?: string;
    };
    chain: ChainCertificate[];
  }>((resolve, reject) => {
    const started = Date.now();
    let settled = false;

    const finishError = (message: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };

    const socket = tls.connect({
      host: target.host,
      port: target.port,
      servername: net.isIP(target.host) ? undefined : target.host,
      rejectUnauthorized: false,
      ALPNProtocols: ["h2", "http/1.1"],
    });

    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      finishError(`TLS handshake timed out after ${timeoutMs} ms.`);
    });

    socket.once("error", (error) => {
      finishError(error.message || "TLS connection failed.");
    });

    socket.once("secureConnect", () => {
      if (settled) return;
      const peer = socket.getPeerCertificate(true) as tls.DetailedPeerCertificate;
      if (!peer || !Object.keys(peer).length) {
        socket.end();
        finishError("Server did not present a certificate.");
        return;
      }

      const validTo = toIsoDate(peer.valid_to);
      const validFrom = toIsoDate(peer.valid_from);
      const validToMs = validTo ? new Date(validTo).getTime() : NaN;
      const now = Date.now();
      const daysRemaining =
        Number.isFinite(validToMs) ? Math.floor((validToMs - now) / (24 * 60 * 60 * 1000)) : null;
      const isExpired = typeof daysRemaining === "number" ? daysRemaining < 0 : false;
      const expiresSoon = typeof daysRemaining === "number" ? daysRemaining >= 0 && daysRemaining <= 30 : false;
      const sans = parseSanList(peer.subjectaltname);
      const infoAccess = peer.infoAccess
        ? Object.entries(peer.infoAccess).flatMap(([label, values]) =>
            (values ?? []).map((value) => `${label}: ${value}`),
          )
        : [];

      settled = true;
      socket.end();

      resolve({
        timingMs: Date.now() - started,
        protocol: socket.getProtocol() ?? "unknown",
        alpnProtocol: socket.alpnProtocol || "none",
        authorized: socket.authorized,
        authorizationError:
          typeof socket.authorizationError === "string"
            ? socket.authorizationError
            : socket.authorizationError instanceof Error
              ? socket.authorizationError.message
              : null,
        cipher: socket.getCipher(),
        certificate: {
          subject: formatDistinguishedName(peer.subject),
          issuer: formatDistinguishedName(peer.issuer),
          serialNumber: peer.serialNumber || null,
          fingerprint256: peer.fingerprint256 || null,
          fingerprint: peer.fingerprint || null,
          validFrom,
          validTo,
          daysRemaining,
          isExpired,
          expiresSoon,
          subjectAltNames: sans,
          subjectAltNameCount: sans.length,
          infoAccess,
          extKeyUsage: Array.isArray(peer.ext_key_usage) ? peer.ext_key_usage : [],
          ...(includePem ? { pem: toPem(peer.raw) ?? undefined } : {}),
        },
        chain: extractChain(peer),
      });
    });
  });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const target = parseTarget(params.get("target"));
  if (!target) {
    return NextResponse.json(
      {
        ok: false,
        error: "Provide a valid host or URL. Example: https://example.com",
      },
      { status: 400 },
    );
  }

  if (isPrivateOrLocalHost(target.host)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Local and private targets are blocked for security reasons.",
      },
      { status: 400 },
    );
  }

  const requestedTimeout = Number.parseInt(params.get("timeoutMs") ?? "", 10);
  const timeoutMs = Number.isFinite(requestedTimeout)
    ? Math.max(3000, Math.min(20_000, requestedTimeout))
    : 9000;
  const includePem = params.get("includePem") === "true";

  const resolvedAddresses = await resolveHostAddresses(target.host);
  if (resolvedAddresses.some((address) => isPrivateIpAddress(address))) {
    return NextResponse.json(
      {
        ok: false,
        error: "Resolved target points to a private network address and is blocked.",
      },
      { status: 400 },
    );
  }

  try {
    const inspection = await inspectTlsCertificate(target, timeoutMs, includePem);
    return NextResponse.json(
      {
        ok: true,
        target: target.raw,
        host: target.host,
        port: target.port,
        normalizedTarget: target.normalized,
        checkedAt: new Date().toISOString(),
        timeoutMs,
        resolvedAddresses,
        timingMs: inspection.timingMs,
        protocol: inspection.protocol,
        alpnProtocol: inspection.alpnProtocol,
        authorized: inspection.authorized,
        authorizationError: inspection.authorizationError,
        cipher: inspection.cipher,
        certificate: inspection.certificate,
        chain: inspection.chain,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "TLS inspection failed.";
    return NextResponse.json(
      {
        ok: false,
        target: target.raw,
        host: target.host,
        port: target.port,
        normalizedTarget: target.normalized,
        checkedAt: new Date().toISOString(),
        resolvedAddresses,
        error: message,
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
