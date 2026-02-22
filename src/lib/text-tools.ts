export interface DensityRow {
  keyword: string;
  count: number;
  density: string;
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

export function keywordDensity(text: string, topN = 8): DensityRow[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);

  const total = words.length;
  if (total === 0) return [];

  const frequencies = new Map<string, number>();
  for (const word of words) {
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

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
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

export function safeJsonFormat(value: string): { ok: boolean; output: string } {
  try {
    const parsed = JSON.parse(value);
    return { ok: true, output: JSON.stringify(parsed, null, 2) };
  } catch {
    return { ok: false, output: "Invalid JSON. Please check commas, quotes, and brackets." };
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
