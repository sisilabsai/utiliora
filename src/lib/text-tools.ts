export interface DensityRow {
  keyword: string;
  count: number;
  density: string;
}

export interface KeywordDensityOptions {
  nGram?: 1 | 2 | 3;
  minLength?: number;
  excludeStopWords?: boolean;
}

export interface SlugifyOptions {
  separator?: "-" | "_";
  lowercase?: boolean;
  maxLength?: number;
  removeStopWords?: boolean;
}

export interface JsonFormatOptions {
  minify?: boolean;
  sortKeys?: boolean;
  indent?: number;
}

export interface JsonFormatResult {
  ok: boolean;
  output: string;
  error?: string;
  line?: number;
  column?: number;
  sizeBefore: number;
  sizeAfter?: number;
}

const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "because",
  "been",
  "before",
  "being",
  "between",
  "both",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "here",
  "him",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "may",
  "more",
  "most",
  "my",
  "no",
  "not",
  "of",
  "on",
  "one",
  "or",
  "other",
  "our",
  "out",
  "she",
  "so",
  "some",
  "than",
  "that",
  "the",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "too",
  "under",
  "up",
  "us",
  "very",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "who",
  "will",
  "with",
  "you",
  "your",
]);

function normalizeForTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function countWords(value: string): number {
  if (!normalizeWhitespace(value)) return 0;
  return normalizeWhitespace(value).split(" ").length;
}

export function countCharacters(value: string, includeSpaces: boolean): number {
  return includeSpaces ? value.length : value.replace(/\s+/g, "").length;
}

export function keywordDensity(text: string, topN = 8, options: KeywordDensityOptions = {}): DensityRow[] {
  const nGram = options.nGram ?? 1;
  const minLength = options.minLength ?? 3;
  const excludeStopWords = options.excludeStopWords ?? false;

  const rawWords = normalizeForTokens(text).filter((word) => word.length >= minLength);
  const words = excludeStopWords ? rawWords.filter((word) => !STOP_WORDS.has(word)) : rawWords;

  const grams: string[] = [];
  if (nGram === 1) {
    grams.push(...words);
  } else {
    for (let index = 0; index <= words.length - nGram; index += 1) {
      grams.push(words.slice(index, index + nGram).join(" "));
    }
  }

  const total = grams.length;
  if (total === 0) return [];

  const frequencies = new Map<string, number>();
  for (const word of grams) {
    frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
  }

  return [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([keyword, count]) => ({
      keyword,
      count,
      density: `${((count / total) * 100).toFixed(2)}%`,
    }));
}

export function slugify(value: string, options: SlugifyOptions = {}): string {
  const separator = options.separator ?? "-";
  const lowercase = options.lowercase ?? true;
  const maxLength = options.maxLength ?? 120;
  const removeStopWords = options.removeStopWords ?? false;

  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .trim();

  const words = normalized
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !removeStopWords || !STOP_WORDS.has(word.toLowerCase()))
    .map((word) => (lowercase ? word.toLowerCase() : word));

  const joined = words.join(separator).replace(new RegExp(`${separator}{2,}`, "g"), separator);
  if (joined.length <= maxLength) return joined;

  const slice = joined.slice(0, maxLength);
  const lastSeparator = slice.lastIndexOf(separator);
  if (lastSeparator > 0) return slice.slice(0, lastSeparator);
  return slice;
}

export function minifyCss(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>+])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

export function minifyJs(value: string): string {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}();,:+\-*/<>=&|!?[\]])\s*/g, "$1")
    .trim();
}

function sortJsonRecursively(input: unknown): unknown {
  if (Array.isArray(input)) return input.map((item) => sortJsonRecursively(item));
  if (input && typeof input === "object") {
    const objectInput = input as Record<string, unknown>;
    const orderedEntries = Object.entries(objectInput)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, val]) => [key, sortJsonRecursively(val)] as const);
    return Object.fromEntries(orderedEntries);
  }
  return input;
}

function lineAndColumnFromPosition(text: string, position: number): { line: number; column: number } {
  const safePos = Math.max(0, Math.min(position, text.length));
  const before = text.slice(0, safePos);
  const lines = before.split("\n");
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

export function safeJsonFormat(value: string, options: JsonFormatOptions = {}): JsonFormatResult {
  const sizeBefore = value.length;
  try {
    const parsed = JSON.parse(value);
    const sorted = options.sortKeys ? sortJsonRecursively(parsed) : parsed;
    const output = options.minify
      ? JSON.stringify(sorted)
      : JSON.stringify(sorted, null, Math.max(0, options.indent ?? 2));
    return { ok: true, output, sizeBefore, sizeAfter: output.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    const match = message.match(/position\s+(\d+)/i);
    const position = match ? Number.parseInt(match[1], 10) : -1;
    const pointer = position >= 0 ? lineAndColumnFromPosition(value, position) : null;
    const details = pointer ? `${message} (line ${pointer.line}, col ${pointer.column})` : message;
    return {
      ok: false,
      output: "Invalid JSON. Please check commas, quotes, and brackets.",
      error: details,
      line: pointer?.line,
      column: pointer?.column,
      sizeBefore,
    };
  }
}

export function markdownToHtml(markdown: string): string {
  const escaped = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const withCode = escaped.replace(/```([\s\S]*?)```/g, (_match, code) => `<pre><code>${code.trim()}</code></pre>`);
  const withHeadings = withCode
    .replace(/^###\s(.+)$/gm, "<h3>$1</h3>")
    .replace(/^##\s(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#\s(.+)$/gm, "<h1>$1</h1>");
  const withBold = withHeadings.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const withItalic = withBold.replace(/\*(.+?)\*/g, "<em>$1</em>");
  const withLinks = withItalic.replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noopener noreferrer">$1</a>');

  const lines = withLinks.split("\n");
  const output: string[] = [];
  let listOpen = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^- /.test(trimmed)) {
      if (!listOpen) {
        output.push("<ul>");
        listOpen = true;
      }
      output.push(`<li>${trimmed.replace(/^- /, "")}</li>`);
      continue;
    }

    if (listOpen) {
      output.push("</ul>");
      listOpen = false;
    }

    if (!trimmed) {
      output.push("");
      continue;
    }

    if (/^<h[1-3]>/.test(trimmed) || /^<pre>/.test(trimmed)) {
      output.push(trimmed);
    } else {
      output.push(`<p>${trimmed}</p>`);
    }
  }

  if (listOpen) output.push("</ul>");
  return output.join("\n");
}

export function generateLoremIpsum(paragraphs: number): string {
  const seed =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer auctor, velit at vulputate feugiat, eros sapien luctus arcu, non volutpat lectus lectus sit amet odio.";
  return Array.from({ length: Math.max(1, paragraphs) }, () => seed).join("\n\n");
}
