export type ScamSignalSeverity = "high" | "medium" | "low";
export type ScamVerdict = "danger" | "caution" | "review" | "low";
export type ScamShieldMode = "url" | "message" | "qr";

export interface ScamSignal {
  id: string;
  title: string;
  severity: ScamSignalSeverity;
  detail: string;
  nextStep: string;
}

export interface ScamUrlRemoteInspection {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  contentType: string;
  title: string;
}

export interface ScamUrlSslInspection {
  ok: boolean;
  authorized: boolean;
  authorizationError: string | null;
  hostnameMatches: boolean;
  hostnameMatchSource: "san" | "common-name" | "none";
  isExpired: boolean;
  expiresSoon: boolean;
  daysRemaining: number | null;
}

export interface ScamAssessmentSummary {
  riskScore: number;
  verdict: ScamVerdict;
  headline: string;
  signals: ScamSignal[];
  nextSteps: string[];
}

export interface ScamUrlAnalysis extends ScamAssessmentSummary {
  normalizedUrl: string;
  host: string;
  usesHttps: boolean;
  shortened: boolean;
  suspiciousTerms: string[];
  remote?: ScamUrlRemoteInspection;
  ssl?: ScamUrlSslInspection;
}

export interface ScamMessageAnalysis extends ScamAssessmentSummary {
  subject: string | null;
  senderEmail: string | null;
  replyToEmail: string | null;
  extractedUrls: string[];
  extractedEmails: string[];
  matchedThemes: string[];
}

export interface ScamQrAnalysis extends ScamAssessmentSummary {
  payloadType: "url" | "wifi" | "sms" | "tel" | "mailto" | "geo" | "text";
  payloadLabel: string;
  extractedUrls: string[];
  urlAnalysis: ScamUrlAnalysis | null;
}

const SHORTENER_HOSTS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "buff.ly",
  "is.gd",
  "cutt.ly",
  "rebrand.ly",
  "rb.gy",
  "tiny.cc",
  "lnkd.in",
]);

const SUSPICIOUS_TLDS = new Set(["zip", "mov", "top", "click", "shop", "xyz", "work", "gq", "country", "stream"]);
const URL_LURE_TERMS = [
  "login",
  "signin",
  "verify",
  "secure",
  "update",
  "password",
  "wallet",
  "bank",
  "invoice",
  "gift",
  "claim",
  "reward",
  "bonus",
  "otp",
  "support",
  "refund",
];

const URGENCY_TERMS = [
  "urgent",
  "immediately",
  "final warning",
  "action required",
  "suspended",
  "expires today",
  "verify now",
  "limited time",
  "within 24 hours",
  "failure to respond",
];

const CREDENTIAL_TERMS = [
  "password",
  "passcode",
  "pin",
  "otp",
  "verification code",
  "2fa",
  "login",
  "sign in",
  "account confirmation",
  "security code",
];

const PAYMENT_TERMS = [
  "gift card",
  "wire transfer",
  "crypto",
  "bitcoin",
  "usdt",
  "payment due",
  "invoice attached",
  "bank details",
  "refund",
  "send money",
];

const ATTACHMENT_TERMS = [".zip", ".html", ".htm", ".iso", ".exe", ".scr", "attachment", "invoice copy", "download file"];

const BRAND_RULES = [
  { brand: "PayPal", domains: ["paypal.com"], tokens: ["paypal"] },
  { brand: "Amazon", domains: ["amazon.com"], tokens: ["amazon"] },
  { brand: "Microsoft", domains: ["microsoft.com", "office.com", "live.com", "outlook.com"], tokens: ["microsoft", "office365", "outlook", "hotmail"] },
  { brand: "Google", domains: ["google.com", "gmail.com"], tokens: ["google", "gmail", "g.co"] },
  { brand: "Apple", domains: ["apple.com", "icloud.com"], tokens: ["apple", "icloud"] },
  { brand: "DHL", domains: ["dhl.com"], tokens: ["dhl"] },
  { brand: "FedEx", domains: ["fedex.com"], tokens: ["fedex"] },
  { brand: "WhatsApp", domains: ["whatsapp.com"], tokens: ["whatsapp"] },
  { brand: "Meta", domains: ["facebook.com", "meta.com", "instagram.com"], tokens: ["facebook", "instagram", "meta"] },
  { brand: "Bank", domains: [], tokens: ["bank", "banking"] },
];

function severityWeight(severity: ScamSignalSeverity): number {
  if (severity === "high") return 24;
  if (severity === "medium") return 12;
  return 5;
}

function severityRank(severity: ScamSignalSeverity): number {
  if (severity === "high") return 0;
  if (severity === "medium") return 1;
  return 2;
}

function buildSummary(signals: ScamSignal[]): ScamAssessmentSummary {
  const ordered = [...signals].sort((left, right) => {
    const severityDifference = severityRank(left.severity) - severityRank(right.severity);
    if (severityDifference !== 0) return severityDifference;
    return left.title.localeCompare(right.title);
  });
  const riskScore = Math.max(0, Math.min(100, ordered.reduce((sum, signal) => sum + severityWeight(signal.severity), 0)));
  const verdict: ScamVerdict = riskScore >= 70 ? "danger" : riskScore >= 42 ? "caution" : riskScore >= 18 ? "review" : "low";
  const headline =
    verdict === "danger"
      ? "High scam risk. Do not click, reply, pay, or sign in until you verify the source independently."
      : verdict === "caution"
        ? "Several strong scam indicators were found. Treat this as suspicious until verified."
        : verdict === "review"
          ? "Some risk signals were detected. Review carefully before taking action."
          : "No strong scam signals were detected, but still verify unexpected requests independently.";
  const nextSteps = Array.from(new Set(ordered.map((signal) => signal.nextStep))).slice(0, 6);
  return { riskScore, verdict, headline, signals: ordered, nextSteps };
}

function addSignal(signals: ScamSignal[], signal: ScamSignal) {
  if (signals.some((entry) => entry.id === signal.id)) return;
  signals.push(signal);
}

function safeTrim(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizePossibleUrl(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;
  const normalized = /^[a-zA-Z][\w+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function isIpHost(host: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":");
}

function countSubdomains(host: string): number {
  const labels = host.split(".").filter(Boolean);
  return Math.max(0, labels.length - 2);
}

function collectSuspiciousTerms(value: string): string[] {
  const haystack = value.toLowerCase();
  return URL_LURE_TERMS.filter((term) => haystack.includes(term));
}

function findBrandImpersonation(host: string, title: string, original: string): string | null {
  const haystack = `${host} ${title} ${original}`.toLowerCase();
  for (const rule of BRAND_RULES) {
    if (!rule.tokens.some((token) => haystack.includes(token.toLowerCase()))) continue;
    const officialMatch = rule.domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
    if (!officialMatch) return rule.brand;
  }
  return null;
}

function extractUrlHost(value: string): string | null {
  const normalized = normalizePossibleUrl(value);
  if (!normalized) return null;
  try {
    return new URL(normalized).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(/(?:https?:\/\/|www\.)[^\s<>"')]+/gi) ?? [];
  const normalized = matches
    .map((entry) => entry.replace(/[),.;]+$/, ""))
    .map((entry) => normalizePossibleUrl(entry) ?? "")
    .filter(Boolean);
  return [...new Set(normalized)];
}

export function extractEmailsFromText(text: string): string[] {
  const matches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return [...new Set(matches.map((value) => value.toLowerCase()))];
}

function parseHeaderValue(text: string, headerName: string): string | null {
  const pattern = new RegExp(`^${headerName}:\\s*(.+)$`, "im");
  const match = text.match(pattern);
  return safeTrim(match?.[1]);
}

function extractEmailDomain(value: string | null): string | null {
  if (!value) return null;
  const emailMatch = value.match(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/i);
  return emailMatch?.[1]?.toLowerCase() ?? null;
}

export function analyzeUrlForScamRisk(
  rawValue: string,
  remote?: ScamUrlRemoteInspection | null,
  ssl?: ScamUrlSslInspection | null,
): ScamUrlAnalysis {
  const signals: ScamSignal[] = [];
  const normalizedUrl = normalizePossibleUrl(rawValue) ?? rawValue.trim();
  let parsed: URL | null = null;

  try {
    parsed = new URL(normalizedUrl);
  } catch {
    addSignal(signals, {
      id: "invalid-url",
      title: "URL format could not be parsed cleanly",
      severity: "medium",
      detail: "Malformed or partially hidden links are common in scam messages.",
      nextStep: "Do not open the link directly. Ask the sender for the official domain and visit it manually.",
    });
    return {
      normalizedUrl,
      host: "Unknown",
      usesHttps: false,
      shortened: false,
      suspiciousTerms: [],
      remote: remote ?? undefined,
      ssl: ssl ?? undefined,
      ...buildSummary(signals),
    };
  }

  const host = parsed.hostname.toLowerCase();
  const usesHttps = parsed.protocol === "https:";
  const shortened = SHORTENER_HOSTS.has(host);
  const suspiciousTerms = collectSuspiciousTerms(`${host} ${parsed.pathname} ${parsed.search}`);

  if (parsed.username || parsed.password) {
    addSignal(signals, {
      id: "embedded-credentials",
      title: "Link contains embedded credentials or an @-style redirect trick",
      severity: "high",
      detail: "Scam links sometimes hide the real destination by placing fake usernames before the actual host.",
      nextStep: "Avoid the link. If the brand is real, navigate to the official site manually from your browser.",
    });
  }

  if (!usesHttps) {
    addSignal(signals, {
      id: "http-link",
      title: "Link does not use HTTPS",
      severity: "medium",
      detail: "Legitimate account, payment, and login pages should almost always use HTTPS.",
      nextStep: "Do not enter credentials or payment details on non-HTTPS pages.",
    });
  }

  if (isIpHost(host)) {
    addSignal(signals, {
      id: "ip-host",
      title: "Link points to a raw IP address instead of a normal domain",
      severity: "high",
      detail: "Attackers often use direct IPs to avoid reputation checks and brand verification.",
      nextStep: "Treat the link as unsafe unless you expected an internal infrastructure URL from a trusted team.",
    });
  }

  if (host.includes("xn--")) {
    addSignal(signals, {
      id: "punycode-host",
      title: "Domain uses punycode or internationalized encoding",
      severity: "medium",
      detail: "Some scam links use lookalike characters to mimic trusted brands.",
      nextStep: "Verify the destination by comparing it with the official domain character by character.",
    });
  }

  if (shortened) {
    addSignal(signals, {
      id: "shortener",
      title: "Shortened URL hides the real destination",
      severity: "medium",
      detail: "Short links make it harder to verify where a message wants you to go.",
      nextStep: "Expand and inspect the final destination before clicking or sharing it.",
    });
  }

  if (countSubdomains(host) >= 3) {
    addSignal(signals, {
      id: "many-subdomains",
      title: "Domain uses many subdomains",
      severity: "low",
      detail: "Long multi-subdomain URLs can be used to make a malicious host look trustworthy at a glance.",
      nextStep: "Read the hostname from right to left and confirm the real base domain.",
    });
  }

  const tld = host.split(".").at(-1) ?? "";
  if (SUSPICIOUS_TLDS.has(tld)) {
    addSignal(signals, {
      id: "risky-tld",
      title: "Domain uses a higher-risk top-level domain",
      severity: "low",
      detail: `The .${tld} extension appears frequently in abusive campaigns. It is not proof of fraud on its own, but it raises review pressure.`,
      nextStep: "Check whether the same organization normally uses this domain on its official website and social profiles.",
    });
  }

  if (normalizedUrl.length >= 140) {
    addSignal(signals, {
      id: "very-long-url",
      title: "URL is unusually long",
      severity: "low",
      detail: "Long URLs can bury the real domain or hide suspicious tracking and redirect parameters.",
      nextStep: "Focus on the hostname first. Ignore the rest of the URL until the base domain is trusted.",
    });
  }

  const encodedMatches = normalizedUrl.match(/%[0-9a-f]{2}/gi) ?? [];
  if (encodedMatches.length >= 6) {
    addSignal(signals, {
      id: "encoded-url",
      title: "URL contains heavy encoded characters",
      severity: "low",
      detail: "Excessive encoding can be used to hide the path or parameters from quick visual checks.",
      nextStep: "Decode the URL before trusting it, especially if the destination is asking for payment or login details.",
    });
  }

  if (suspiciousTerms.length >= 2) {
    addSignal(signals, {
      id: "lure-terms",
      title: "Link uses multiple urgency or credential-lure terms",
      severity: "medium",
      detail: `Detected terms: ${suspiciousTerms.slice(0, 6).join(", ")}.`,
      nextStep: "Treat the page as suspicious until you verify it independently through official channels.",
    });
  }

  const impersonatedBrand = findBrandImpersonation(host, remote?.title ?? "", normalizedUrl);
  if (impersonatedBrand) {
    addSignal(signals, {
      id: "brand-impersonation",
      title: `Possible ${impersonatedBrand} impersonation`,
      severity: "high",
      detail: "The link references a trusted brand, but the hostname does not match that brand's official domain.",
      nextStep: `Do not use the link. Open the official ${impersonatedBrand} website manually from your browser instead.`,
    });
  }

  if (remote) {
      const finalHost = extractUrlHost(remote.finalUrl);
      if (finalHost && finalHost !== host) {
        addSignal(signals, {
          id: "redirected-host",
          title: "Link redirects to a different host",
          severity: "medium",
          detail: `The inspected URL finished on ${finalHost}, which differs from the original host ${host}.`,
          nextStep: "Inspect the final destination carefully before you trust the message or page.",
        });
      }

      if (remote.status >= 400) {
        addSignal(signals, {
          id: "broken-destination",
          title: "Destination returned an error page",
          severity: "low",
          detail: `The inspected destination returned HTTP ${remote.status}. Broken or disposable landing pages are common in scam campaigns.`,
          nextStep: "Do not assume a broken page is safe. Verify the sender through official contact details instead.",
        });
      }

      if (/(verify|sign in|login|account|password|wallet|gift card|invoice)/i.test(remote.title)) {
        addSignal(signals, {
          id: "credential-title",
          title: "Destination title suggests credentials or payment action",
          severity: "medium",
          detail: `The page title was "${remote.title}".`,
          nextStep: "Only continue if you intentionally opened the service from a known-good bookmark or official app.",
        });
      }

      if (remote.contentType && !/text\/html|application\/xhtml\+xml|text\/plain/i.test(remote.contentType)) {
        addSignal(signals, {
          id: "non-html-destination",
          title: "Destination is not a normal webpage",
          severity: "low",
          detail: `The server responded with ${remote.contentType}.`,
          nextStep: "Avoid opening unexpected files or downloads from messages you did not fully verify.",
        });
      }
  }

  if (ssl) {
    if (!ssl.ok) {
      addSignal(signals, {
        id: "ssl-check-failed",
        title: "TLS/SSL validation could not be completed cleanly",
        severity: "medium",
        detail: "The certificate could not be inspected or validated confidently.",
        nextStep: "Treat the site as untrusted until you verify it from a known official source.",
      });
    } else {
      if (!ssl.authorized) {
        addSignal(signals, {
          id: "ssl-not-authorized",
          title: "TLS certificate is not fully trusted",
          severity: "medium",
          detail: ssl.authorizationError || "The server certificate was not authorized cleanly.",
          nextStep: "Do not enter passwords, OTPs, or payment details on this page.",
        });
      }
      if (!ssl.hostnameMatches) {
        addSignal(signals, {
          id: "ssl-host-mismatch",
          title: "Certificate hostname does not match the inspected host",
          severity: "high",
          detail: "A hostname mismatch can indicate interception, misconfiguration, or a deceptive destination.",
          nextStep: "Avoid the site and visit the official domain manually if the brand is legitimate.",
        });
      }
      if (ssl.isExpired || ssl.expiresSoon) {
        addSignal(signals, {
          id: "ssl-expiry",
          title: ssl.isExpired ? "Certificate is expired" : "Certificate expires soon",
          severity: ssl.isExpired ? "high" : "low",
          detail:
            ssl.daysRemaining === null
              ? "Certificate lifetime could not be established cleanly."
              : `Certificate days remaining: ${ssl.daysRemaining}.`,
          nextStep: "Use extra caution. Sensitive actions should only happen on healthy, trusted certificates.",
        });
      }
    }
  }

  return {
    normalizedUrl,
    host,
    usesHttps,
    shortened,
    suspiciousTerms,
    remote: remote ?? undefined,
    ssl: ssl ?? undefined,
    ...buildSummary(signals),
  };
}

export function analyzeMessageForScamRisk(text: string): ScamMessageAnalysis {
  const signals: ScamSignal[] = [];
  const lower = text.toLowerCase();
  const extractedUrls = extractUrlsFromText(text);
  const extractedEmails = extractEmailsFromText(text);
  const subject = parseHeaderValue(text, "subject");
  const senderEmail = parseHeaderValue(text, "from");
  const replyToEmail = parseHeaderValue(text, "reply-to");
  const matchedThemes: string[] = [];

  const urgencyHits = URGENCY_TERMS.filter((term) => lower.includes(term));
  if (urgencyHits.length >= 2) {
    matchedThemes.push("Urgency pressure");
    addSignal(signals, {
      id: "urgency-pressure",
      title: "Message applies urgent time pressure",
      severity: "medium",
      detail: `Detected urgency terms: ${urgencyHits.slice(0, 5).join(", ")}.`,
      nextStep: "Slow down. Verify the request using official contact details before acting.",
    });
  }

  const credentialHits = CREDENTIAL_TERMS.filter((term) => lower.includes(term));
  if (credentialHits.length > 0) {
    matchedThemes.push("Credential harvesting");
    addSignal(signals, {
      id: "credential-request",
      title: "Message asks for login or verification secrets",
      severity: "high",
      detail: `Detected credential terms: ${credentialHits.slice(0, 6).join(", ")}.`,
      nextStep: "Do not share passwords, OTPs, or codes sent by SMS/email. Official teams do not request them this way.",
    });
  }

  const paymentHits = PAYMENT_TERMS.filter((term) => lower.includes(term));
  if (paymentHits.length > 0) {
    matchedThemes.push("Payment pressure");
    addSignal(signals, {
      id: "payment-pressure",
      title: "Message pushes unusual payment behavior",
      severity: "high",
      detail: `Detected payment terms: ${paymentHits.slice(0, 6).join(", ")}.`,
      nextStep: "Verify invoices or money requests through a known contact number or official billing portal.",
    });
  }

  const attachmentHits = ATTACHMENT_TERMS.filter((term) => lower.includes(term));
  if (attachmentHits.length > 0) {
    matchedThemes.push("Attachment risk");
    addSignal(signals, {
      id: "attachment-lure",
      title: "Message encourages opening risky attachments or downloads",
      severity: "medium",
      detail: `Detected attachment indicators: ${attachmentHits.slice(0, 6).join(", ")}.`,
      nextStep: "Do not open attachments or downloads until the sender and business context are verified independently.",
    });
  }

  const senderDomain = extractEmailDomain(senderEmail);
  const replyDomain = extractEmailDomain(replyToEmail);
  if (senderDomain && replyDomain && senderDomain !== replyDomain) {
    matchedThemes.push("Header mismatch");
    addSignal(signals, {
      id: "reply-to-mismatch",
      title: "Reply-To domain differs from sender domain",
      severity: "high",
      detail: `From domain: ${senderDomain}. Reply-To domain: ${replyDomain}.`,
      nextStep: "Do not continue the conversation through the suspicious reply address. Verify the sender externally first.",
    });
  }

  if (senderDomain) {
    const impersonatedBrand = findBrandImpersonation(senderDomain, subject ?? "", senderEmail ?? "");
    if (impersonatedBrand) {
      matchedThemes.push("Brand impersonation");
      addSignal(signals, {
        id: "sender-brand-impersonation",
        title: `Sender address may impersonate ${impersonatedBrand}`,
        severity: "high",
        detail: `The sender references ${impersonatedBrand} but uses ${senderDomain}.`,
        nextStep: `Do not trust the email address. Contact ${impersonatedBrand} through the official website or app instead.`,
      });
    }
  }

  if (extractedUrls.length >= 2) {
    matchedThemes.push("Multiple links");
    addSignal(signals, {
      id: "multiple-links",
      title: "Message contains multiple links",
      severity: "low",
      detail: "Scam campaigns often include several fallbacks in case one destination is blocked.",
      nextStep: "Inspect each link separately before clicking any of them.",
    });
  }

  for (const url of extractedUrls.slice(0, 2)) {
    const urlAnalysis = analyzeUrlForScamRisk(url);
    urlAnalysis.signals
      .filter((signal) => signal.severity !== "low")
      .slice(0, 2)
      .forEach((signal, index) => {
        addSignal(signals, {
          id: `linked-url-${index}-${signal.id}`,
          title: `Linked URL: ${signal.title}`,
          severity: signal.severity,
          detail: `${url} -> ${signal.detail}`,
          nextStep: signal.nextStep,
        });
      });
  }

  return {
    subject,
    senderEmail,
    replyToEmail,
    extractedUrls,
    extractedEmails,
    matchedThemes,
    ...buildSummary(signals),
  };
}

export function analyzeQrPayloadForScamRisk(payload: string): ScamQrAnalysis {
  const trimmed = payload.trim();
  const lower = trimmed.toLowerCase();
  let payloadType: ScamQrAnalysis["payloadType"] = "text";
  let payloadLabel = "Plain text payload";
  let extractedUrls: string[] = [];
  const signals: ScamSignal[] = [];
  let urlAnalysis: ScamUrlAnalysis | null = null;

  if (/^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed)) {
    payloadType = "url";
    payloadLabel = "URL QR payload";
    extractedUrls = [normalizePossibleUrl(trimmed) ?? trimmed];
  } else if (lower.startsWith("wifi:")) {
    payloadType = "wifi";
    payloadLabel = "Wi-Fi network QR";
    addSignal(signals, {
      id: "wifi-qr",
      title: "QR code configures a Wi-Fi network",
      severity: "medium",
      detail: "Connecting to unknown QR-based Wi-Fi can expose users to captive-portal phishing or hostile network monitoring.",
      nextStep: "Only join QR-based Wi-Fi networks when the source is physically trusted and the network name is expected.",
    });
  } else if (lower.startsWith("smsto:") || lower.startsWith("sms:")) {
    payloadType = "sms";
    payloadLabel = "SMS QR payload";
    addSignal(signals, {
      id: "sms-qr",
      title: "QR code prepares an SMS action",
      severity: "medium",
      detail: "SMS QR codes can prefill scam texts, premium numbers, or impersonation responses.",
      nextStep: "Review the destination number and message body before sending anything.",
    });
  } else if (lower.startsWith("tel:")) {
    payloadType = "tel";
    payloadLabel = "Phone-call QR payload";
    addSignal(signals, {
      id: "tel-qr",
      title: "QR code starts a phone call",
      severity: "low",
      detail: "Call QR codes can still be risky if they route users to unknown numbers posing as support desks.",
      nextStep: "Compare the number with the official support number listed on the organization's website.",
    });
  } else if (lower.startsWith("mailto:")) {
    payloadType = "mailto";
    payloadLabel = "Email QR payload";
    addSignal(signals, {
      id: "mailto-qr",
      title: "QR code starts an email draft",
      severity: "low",
      detail: "This can be abused to steer users toward fraudulent support addresses.",
      nextStep: "Confirm the destination email address before sending personal or financial details.",
    });
  } else if (lower.startsWith("geo:")) {
    payloadType = "geo";
    payloadLabel = "Location QR payload";
  } else {
    extractedUrls = extractUrlsFromText(trimmed);
    if (extractedUrls.length > 0) {
      payloadType = "url";
      payloadLabel = "Text payload containing URL";
    }
  }

  if (extractedUrls.length > 0) {
    urlAnalysis = analyzeUrlForScamRisk(extractedUrls[0]);
    urlAnalysis.signals.slice(0, 4).forEach((signal, index) => {
      addSignal(signals, {
        id: `qr-url-${index}-${signal.id}`,
        title: `Embedded URL: ${signal.title}`,
        severity: signal.severity,
        detail: signal.detail,
        nextStep: signal.nextStep,
      });
    });
  }

  return {
    payloadType,
    payloadLabel,
    extractedUrls,
    urlAnalysis,
    ...buildSummary(signals),
  };
}

export function buildScamShieldMarkdown(
  mode: ScamShieldMode,
  label: string,
  result: ScamAssessmentSummary,
  extra: string[] = [],
): string {
  const lines: string[] = [];
  lines.push("# Scam Shield Report");
  lines.push("");
  lines.push(`- Mode: ${mode}`);
  lines.push(`- Source: ${label}`);
  lines.push(`- Risk score: ${result.riskScore}/100`);
  lines.push(`- Verdict: ${result.verdict}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(result.headline);
  lines.push("");
  if (extra.length > 0) {
    lines.push("## Context");
    lines.push("");
    extra.forEach((item) => lines.push(`- ${item}`));
    lines.push("");
  }
  lines.push("## Signals");
  lines.push("");
  if (result.signals.length === 0) {
    lines.push("- No strong scam signals were detected.");
  } else {
    result.signals.forEach((signal, index) => {
      lines.push(`${index + 1}. [${signal.severity}] ${signal.title}`);
      lines.push(`   - Detail: ${signal.detail}`);
      lines.push(`   - Next step: ${signal.nextStep}`);
    });
  }
  lines.push("");
  if (result.nextSteps.length > 0) {
    lines.push("## Safe next steps");
    lines.push("");
    result.nextSteps.forEach((step) => lines.push(`- ${step}`));
    lines.push("");
  }
  return lines.join("\n");
}
