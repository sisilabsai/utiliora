import { splitTextForTranslation } from "@/lib/translation";

export const DOCUMENT_TRANSLATOR_MAX_TEXT_LENGTH = 300_000;
export const DOCUMENT_TRANSLATOR_HISTORY_LIMIT = 24;

export interface ProtectedGlossaryText {
  text: string;
  tokenMap: Record<string, string>;
}

export function sanitizeDocumentTranslationText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function parseGlossaryTerms(value: string, maxTerms = 80): string[] {
  const source = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.slice(0, 120));

  const unique = [...new Set(source)];
  unique.sort((left, right) => right.length - left.length || left.localeCompare(right));
  return unique.slice(0, Math.max(0, Math.min(200, maxTerms)));
}

export function protectGlossaryTerms(text: string, terms: string[]): ProtectedGlossaryText {
  if (!text || !terms.length) {
    return { text, tokenMap: {} };
  }

  let output = text;
  const tokenMap: Record<string, string> = {};

  terms.forEach((term, index) => {
    if (!term) return;
    const token = `[[UTERM_${index.toString(36).toUpperCase()}]]`;
    if (!output.includes(term)) return;
    output = output.split(term).join(token);
    tokenMap[token] = term;
  });

  return { text: output, tokenMap };
}

export function restoreGlossaryTokens(text: string, tokenMap: Record<string, string>): string {
  let output = text;
  Object.entries(tokenMap).forEach(([token, term]) => {
    if (!token || !term) return;
    output = output.split(token).join(term);
  });
  return output;
}

export function splitDocumentIntoTranslationChunks(text: string, chunkSize = 3600): string[] {
  const normalized = sanitizeDocumentTranslationText(text);
  if (!normalized) return [];
  return splitTextForTranslation(normalized, Math.max(600, Math.min(4000, Math.round(chunkSize))));
}

export function summarizeProviderCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts)
    .filter(([, count]) => Number.isFinite(count) && count > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  if (!entries.length) return "unknown";
  return entries.map(([provider, count]) => `${provider} x${count}`).join(", ");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildDocumentTranslationWordMarkup(options: {
  title: string;
  sourceLanguageLabel: string;
  targetLanguageLabel: string;
  translatedText: string;
  sourceText?: string;
  includeSourceText?: boolean;
  includeHeader?: boolean;
}): string {
  const title = escapeHtml(options.title.trim() || "translated-document");
  const translated = escapeHtml(options.translatedText || "");
  const source = escapeHtml(options.sourceText || "");
  const includeSource = Boolean(options.includeSourceText && source.trim());
  const includeHeader = options.includeHeader ?? true;

  const metadata = `${escapeHtml(options.sourceLanguageLabel)} -> ${escapeHtml(options.targetLanguageLabel)}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Calibri, Arial, sans-serif; margin: 24px; color: #101317; line-height: 1.5; }
    h1, h2, h3 { margin: 0 0 10px; }
    .meta { color: #4b5b70; margin-bottom: 16px; }
    section { margin-bottom: 24px; }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      border: 1px solid #d4dce8;
      padding: 12px;
      border-radius: 8px;
      background: #f8fafc;
      font-family: Consolas, Menlo, Monaco, monospace;
      font-size: 13px;
      line-height: 1.45;
    }
  </style>
</head>
<body>
  ${includeHeader ? `<h1>${title}</h1><p class="meta">${metadata}</p>` : ""}
  <section>
    <h2>Translated document</h2>
    <pre>${translated || "(No translated content)"}</pre>
  </section>
  ${includeSource ? `<section><h2>Source document</h2><pre>${source}</pre></section>` : ""}
</body>
</html>`;
}
