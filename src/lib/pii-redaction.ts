export type PiiFindingType =
  | "email"
  | "phone"
  | "credit-card"
  | "iban"
  | "ssn"
  | "ip-address"
  | "url"
  | "custom-term";

export type PiiReplacementMode = "block" | "label" | "partial";

export interface PiiFinding {
  id: string;
  type: PiiFindingType;
  label: string;
  value: string;
  start: number;
  end: number;
  severity: "high" | "medium";
}

interface PiiPatternDefinition {
  type: PiiFindingType;
  label: string;
  severity: "high" | "medium";
  regex: RegExp;
  validate?: (value: string) => boolean;
}

const PII_PATTERNS: PiiPatternDefinition[] = [
  {
    type: "email",
    label: "Email address",
    severity: "high",
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    type: "phone",
    label: "Phone number",
    severity: "high",
    regex: /(?:(?<=\s)|^)(?:\+?\d[\d(). -]{7,}\d)(?=\s|$)/g,
  },
  {
    type: "credit-card",
    label: "Card number",
    severity: "high",
    regex: /\b(?:\d[ -]*?){13,19}\b/g,
    validate: (value) => {
      const digits = value.replace(/\D/g, "");
      if (digits.length < 13 || digits.length > 19) return false;
      let sum = 0;
      let shouldDouble = false;
      for (let index = digits.length - 1; index >= 0; index -= 1) {
        let digit = Number(digits[index]);
        if (shouldDouble) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
      }
      return sum % 10 === 0;
    },
  },
  {
    type: "iban",
    label: "IBAN / bank account",
    severity: "high",
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/gi,
  },
  {
    type: "ssn",
    label: "National ID / SSN",
    severity: "high",
    regex: /\b\d{3}-\d{2}-\d{4}\b/g,
  },
  {
    type: "ip-address",
    label: "IP address",
    severity: "medium",
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  },
  {
    type: "url",
    label: "URL",
    severity: "medium",
    regex: /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi,
  },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

function overlaps(left: PiiFinding, right: PiiFinding): boolean {
  return left.start < right.end && right.start < left.end;
}

function shouldReplaceExisting(existing: PiiFinding, next: PiiFinding): boolean {
  const existingLength = existing.end - existing.start;
  const nextLength = next.end - next.start;
  if (nextLength !== existingLength) return nextLength > existingLength;
  if (existing.severity !== next.severity) return next.severity === "high";
  return next.label.localeCompare(existing.label) < 0;
}

function insertFinding(findings: PiiFinding[], nextFinding: PiiFinding) {
  for (let index = 0; index < findings.length; index += 1) {
    const current = findings[index];
    if (!overlaps(current, nextFinding)) continue;
    if (shouldReplaceExisting(current, nextFinding)) {
      findings[index] = nextFinding;
    }
    return;
  }
  findings.push(nextFinding);
}

function buildReplacement(value: string, finding: PiiFinding, mode: PiiReplacementMode): string {
  if (mode === "block") return "[REDACTED]";
  if (mode === "label") return `[${finding.label.toUpperCase()}]`;

  const trimmed = value.trim();
  if (trimmed.length <= 4) return "[REDACTED]";
  if (finding.type === "email") {
    const atIndex = trimmed.indexOf("@");
    if (atIndex > 1) {
      return `${trimmed.slice(0, 1)}***${trimmed.slice(atIndex - 1)}`;
    }
  }
  const prefix = trimmed.slice(0, 2);
  const suffix = trimmed.slice(-2);
  return `${prefix}${"*".repeat(Math.max(3, trimmed.length - 4))}${suffix}`;
}

export function detectPiiFindings(text: string, customTerms: string[] = []): PiiFinding[] {
  const source = normalizeWhitespace(text);
  const findings: PiiFinding[] = [];

  PII_PATTERNS.forEach((pattern) => {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    for (const match of source.matchAll(regex)) {
      const value = match[0] ?? "";
      const start = match.index ?? -1;
      if (!value || start < 0) continue;
      if (pattern.validate && !pattern.validate(value)) continue;
      insertFinding(findings, {
        id: `${pattern.type}-${start}-${start + value.length}`,
        type: pattern.type,
        label: pattern.label,
        value,
        start,
        end: start + value.length,
        severity: pattern.severity,
      });
    }
  });

  customTerms
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((term) => {
      const regex = new RegExp(escapeRegExp(term), "gi");
      for (const match of source.matchAll(regex)) {
        const value = match[0] ?? "";
        const start = match.index ?? -1;
        if (!value || start < 0) continue;
        insertFinding(findings, {
          id: `custom-${start}-${start + value.length}`,
          type: "custom-term",
          label: "Custom term",
          value,
          start,
          end: start + value.length,
          severity: "high",
        });
      }
    });

  return findings.sort((left, right) => left.start - right.start || right.end - left.end);
}

export function applyPiiRedactions(
  text: string,
  findings: PiiFinding[],
  selectedIds: string[],
  mode: PiiReplacementMode,
): string {
  const source = normalizeWhitespace(text);
  const selected = findings.filter((finding) => selectedIds.includes(finding.id)).sort((left, right) => left.start - right.start);
  if (selected.length === 0) return source;

  const parts: string[] = [];
  let cursor = 0;
  selected.forEach((finding) => {
    if (finding.start < cursor) return;
    parts.push(source.slice(cursor, finding.start));
    parts.push(buildReplacement(source.slice(finding.start, finding.end), finding, mode));
    cursor = finding.end;
  });
  parts.push(source.slice(cursor));
  return parts.join("");
}

export function summarizePiiCounts(findings: PiiFinding[]): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  findings.forEach((finding) => {
    counts.set(finding.label, (counts.get(finding.label) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => ({ label, count }));
}
