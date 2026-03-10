export type DocumentChangeKind = "added" | "removed" | "modified" | "unchanged";

export interface DocumentChange {
  id: string;
  kind: DocumentChangeKind;
  beforeText: string;
  afterText: string;
  similarity: number;
}

export interface DocumentRiskFlag {
  label: string;
  severity: "high" | "medium" | "low";
  explanation: string;
  afterText: string;
}

export interface DocumentCompareResult {
  beforeBlocks: string[];
  afterBlocks: string[];
  changes: DocumentChange[];
  summary: string[];
  riskFlags: DocumentRiskFlag[];
  counts: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
}

function normalizeText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitIntoBlocks(value: string): string[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];
  const paragraphBlocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (paragraphBlocks.length > 1) return paragraphBlocks;

  return normalized
    .split(/(?<=[.!?])\s+|\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function jaccardSimilarity(left: string, right: string): number {
  const leftTokens = unique(tokenize(left));
  const rightTokens = unique(tokenize(right));
  if (!leftTokens.length && !rightTokens.length) return 1;
  if (!leftTokens.length || !rightTokens.length) return 0;
  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  let intersection = 0;
  leftSet.forEach((token) => {
    if (rightSet.has(token)) intersection += 1;
  });
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union > 0 ? intersection / union : 0;
}

function classifyChanges(beforeBlocks: string[], afterBlocks: string[]): DocumentChange[] {
  const usedAfter = new Set<number>();
  const changes: DocumentChange[] = [];

  beforeBlocks.forEach((beforeText, beforeIndex) => {
    let bestIndex = -1;
    let bestScore = 0;

    afterBlocks.forEach((afterText, afterIndex) => {
      if (usedAfter.has(afterIndex)) return;
      const score = beforeText === afterText ? 1 : jaccardSimilarity(beforeText, afterText);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = afterIndex;
      }
    });

    if (bestIndex >= 0 && bestScore >= 0.92) {
      usedAfter.add(bestIndex);
      changes.push({
        id: `change-${beforeIndex + 1}`,
        kind: "unchanged",
        beforeText,
        afterText: afterBlocks[bestIndex],
        similarity: bestScore,
      });
      return;
    }

    if (bestIndex >= 0 && bestScore >= 0.34) {
      usedAfter.add(bestIndex);
      changes.push({
        id: `change-${beforeIndex + 1}`,
        kind: "modified",
        beforeText,
        afterText: afterBlocks[bestIndex],
        similarity: bestScore,
      });
      return;
    }

    changes.push({
      id: `change-${beforeIndex + 1}`,
      kind: "removed",
      beforeText,
      afterText: "",
      similarity: 0,
    });
  });

  afterBlocks.forEach((afterText, afterIndex) => {
    if (usedAfter.has(afterIndex)) return;
    changes.push({
      id: `added-${afterIndex + 1}`,
      kind: "added",
      beforeText: "",
      afterText,
      similarity: 0,
    });
  });

  return changes;
}

const RISK_PATTERNS: Array<{
  label: string;
  severity: "high" | "medium" | "low";
  pattern: RegExp;
  explanation: string;
}> = [
  {
    label: "Payment terms changed",
    severity: "high",
    pattern: /\b(net\s*\d+|due upon receipt|payment due|late fee|interest of|non-refundable)\b/i,
    explanation: "Payment timing or late-payment terms changed and should be reviewed closely.",
  },
  {
    label: "Deadline or timeline changed",
    severity: "high",
    pattern: /\b(within \d+ days|deadline|deliver by|completion date|termination date|effective date)\b/i,
    explanation: "A date, deadline, or delivery timeline changed.",
  },
  {
    label: "Cancellation language changed",
    severity: "high",
    pattern: /\b(cancel|termination|terminate|notice period|non-cancelable|non cancellable)\b/i,
    explanation: "Cancellation or termination rights changed.",
  },
  {
    label: "Obligation or liability changed",
    severity: "medium",
    pattern: /\b(obligation|liable|liability|indemnif|responsible for|must|shall)\b/i,
    explanation: "Responsibility, obligation, or liability language changed.",
  },
  {
    label: "Renewal or recurring commitment changed",
    severity: "medium",
    pattern: /\b(renewal|auto renew|subscription term|minimum term|recurring)\b/i,
    explanation: "Renewal or ongoing commitment language changed.",
  },
];

function buildRiskFlags(changes: DocumentChange[]): DocumentRiskFlag[] {
  return changes
    .filter((change) => change.kind === "added" || change.kind === "modified")
    .flatMap((change) =>
      RISK_PATTERNS.filter((rule) => rule.pattern.test(change.afterText)).map((rule) => ({
        label: rule.label,
        severity: rule.severity,
        explanation: rule.explanation,
        afterText: change.afterText,
      })),
    )
    .slice(0, 20);
}

function buildSummary(changes: DocumentChange[]): string[] {
  const added = changes.filter((change) => change.kind === "added");
  const removed = changes.filter((change) => change.kind === "removed");
  const modified = changes.filter((change) => change.kind === "modified");

  const lines: string[] = [];
  lines.push(`Added blocks: ${added.length}`);
  lines.push(`Removed blocks: ${removed.length}`);
  lines.push(`Modified blocks: ${modified.length}`);

  const important = [...added, ...modified]
    .filter((change) => change.afterText.length > 0)
    .sort((left, right) => right.afterText.length - left.afterText.length)
    .slice(0, 3)
    .map((change) => change.afterText.slice(0, 180));

  important.forEach((snippet, index) => {
    lines.push(`Priority review ${index + 1}: ${snippet}${snippet.length >= 180 ? "..." : ""}`);
  });

  return lines;
}

export function compareDocumentTexts(beforeText: string, afterText: string): DocumentCompareResult {
  const beforeBlocks = splitIntoBlocks(beforeText);
  const afterBlocks = splitIntoBlocks(afterText);
  const changes = classifyChanges(beforeBlocks, afterBlocks);
  const riskFlags = buildRiskFlags(changes);
  const counts = {
    added: changes.filter((change) => change.kind === "added").length,
    removed: changes.filter((change) => change.kind === "removed").length,
    modified: changes.filter((change) => change.kind === "modified").length,
    unchanged: changes.filter((change) => change.kind === "unchanged").length,
  };

  return {
    beforeBlocks,
    afterBlocks,
    changes,
    summary: buildSummary(changes),
    riskFlags,
    counts,
  };
}

export function buildDocumentCompareMarkdown(result: DocumentCompareResult): string {
  const sections: string[] = [];
  sections.push("# Document Compare Report");
  sections.push("");
  sections.push(`Added: ${result.counts.added}`);
  sections.push(`Removed: ${result.counts.removed}`);
  sections.push(`Modified: ${result.counts.modified}`);
  sections.push(`Unchanged: ${result.counts.unchanged}`);
  sections.push("");
  sections.push("## Summary");
  result.summary.forEach((line) => sections.push(`- ${line}`));
  sections.push("");
  if (result.riskFlags.length) {
    sections.push("## Risk Flags");
    result.riskFlags.forEach((flag) => {
      sections.push(`- [${flag.severity.toUpperCase()}] ${flag.label}: ${flag.explanation}`);
      sections.push(`  ${flag.afterText}`);
    });
    sections.push("");
  }
  sections.push("## Changes");
  result.changes.forEach((change) => {
    sections.push(`### ${change.kind.toUpperCase()} (${Math.round(change.similarity * 100)}%)`);
    if (change.beforeText) sections.push(`Before: ${change.beforeText}`);
    if (change.afterText) sections.push(`After: ${change.afterText}`);
    sections.push("");
  });
  return sections.join("\n").trim();
}
