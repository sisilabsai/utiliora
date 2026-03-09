export type CsvDelimiter = "," | "\t" | ";" | "|";
export type CsvTextCase = "keep" | "lower" | "upper" | "title";

export interface CsvDataset {
  delimiter: CsvDelimiter;
  headers: string[];
  rows: string[][];
}

export interface CsvCleanupOptions {
  trimCells: boolean;
  collapseWhitespace: boolean;
  normalizeHeaders: boolean;
  fillMissingHeaders: boolean;
  dropEmptyRows: boolean;
  dedupeRows: boolean;
  textCase: CsvTextCase;
}

export interface CsvCleanupResult {
  headers: string[];
  rows: string[][];
  duplicateRowsRemoved: number;
  emptyRowsRemoved: number;
  changedCells: number;
}

export interface CsvMappingSuggestion {
  targetHeader: string;
  sourceHeader: string;
  confidence: "high" | "medium" | "low";
}

const COMMON_HEADER_SYNONYMS: Record<string, string[]> = {
  email: ["email address", "e-mail", "mail"],
  phone: ["telephone", "mobile", "phone number", "tel"],
  first_name: ["firstname", "first name", "given name"],
  last_name: ["lastname", "last name", "surname", "family name"],
  full_name: ["name", "customer name", "client name", "full name"],
  company: ["business", "company name", "organization", "organisation"],
  amount: ["value", "price", "cost", "total"],
  order_id: ["order number", "order no", "order", "reference"],
  created_at: ["date", "created", "created date", "timestamp"],
  city: ["town"],
  country: ["nation"],
};

function normalizeLineEndings(value: string): string {
  return value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n");
}

export function detectCsvDelimiter(raw: string): CsvDelimiter {
  const sampleLines = normalizeLineEndings(raw)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);

  const candidates: CsvDelimiter[] = [",", "\t", ";", "|"];
  let best: CsvDelimiter = ",";
  let bestScore = -1;

  candidates.forEach((delimiter) => {
    const counts = sampleLines.map((line) => line.split(delimiter).length - 1).filter((count) => count >= 0);
    const total = counts.reduce((sum, count) => sum + count, 0);
    const nonZero = counts.filter((count) => count > 0).length;
    const score = total + nonZero * 3;
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  });

  return best;
}

export function parseDelimitedText(raw: string, delimiter = detectCsvDelimiter(raw)): CsvDataset {
  const input = normalizeLineEndings(raw);
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (char === "\n" && !inQuotes) {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  const filteredRows = rows.filter((row) => row.some((cell) => cell.length > 0));
  const width = filteredRows.reduce((max, row) => Math.max(max, row.length), 0);
  const normalizedRows = filteredRows.map((row) => {
    const next = [...row];
    while (next.length < width) next.push("");
    return next;
  });

  const headers = normalizedRows[0] ?? [];
  const dataRows = normalizedRows.slice(1);

  return {
    delimiter,
    headers,
    rows: dataRows,
  };
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeHeaderLabel(value: string): string {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeHeaderKey(value: string): string {
  return normalizeHeaderLabel(value).toLowerCase().replace(/\s+/g, "_");
}

function applyTextCase(value: string, textCase: CsvTextCase): string {
  if (textCase === "lower") return value.toLowerCase();
  if (textCase === "upper") return value.toUpperCase();
  if (textCase === "title") return toTitleCase(value);
  return value;
}

function cleanupCell(value: string, options: CsvCleanupOptions): string {
  let next = value;
  if (options.trimCells) next = next.trim();
  if (options.collapseWhitespace) next = next.replace(/\s+/g, " ");
  next = applyTextCase(next, options.textCase);
  return next;
}

export function cleanupCsvDataset(dataset: CsvDataset, options: CsvCleanupOptions): CsvCleanupResult {
  let duplicateRowsRemoved = 0;
  let emptyRowsRemoved = 0;
  let changedCells = 0;

  const usedHeaders = new Set<string>();
  const headers = dataset.headers.map((header, index) => {
    let next = options.normalizeHeaders ? normalizeHeaderLabel(header) : header;
    if (options.trimCells) next = next.trim();
    if (!next && options.fillMissingHeaders) {
      next = `Column ${index + 1}`;
    }
    if (next && usedHeaders.has(next.toLowerCase())) {
      let suffix = 2;
      while (usedHeaders.has(`${next.toLowerCase()}_${suffix}`)) suffix += 1;
      usedHeaders.add(`${next.toLowerCase()}_${suffix}`);
      next = `${next} ${suffix}`;
    } else if (next) {
      usedHeaders.add(next.toLowerCase());
    }
    return next;
  });

  const seen = new Set<string>();
  const rows = dataset.rows.reduce<string[][]>((acc, row) => {
    const nextRow = row.map((cell) => {
      const cleaned = cleanupCell(cell, options);
      if (cleaned !== cell) changedCells += 1;
      return cleaned;
    });

    const isEmpty = nextRow.every((cell) => !cell.trim());
    if (isEmpty && options.dropEmptyRows) {
      emptyRowsRemoved += 1;
      return acc;
    }

    const signature = JSON.stringify(nextRow);
    if (options.dedupeRows && seen.has(signature)) {
      duplicateRowsRemoved += 1;
      return acc;
    }

    seen.add(signature);
    acc.push(nextRow);
    return acc;
  }, []);

  return {
    headers,
    rows,
    duplicateRowsRemoved,
    emptyRowsRemoved,
    changedCells,
  };
}

function scoreHeaderMatch(sourceHeader: string, targetHeader: string): number {
  const sourceKey = makeHeaderKey(sourceHeader);
  const targetKey = makeHeaderKey(targetHeader);
  if (!sourceKey || !targetKey) return 0;
  if (sourceKey === targetKey) return 100;
  if (sourceKey.includes(targetKey) || targetKey.includes(sourceKey)) return 80;

  const sourceVariants = new Set([sourceKey, ...(COMMON_HEADER_SYNONYMS[sourceKey] ?? []).map(makeHeaderKey)]);
  const targetVariants = new Set([targetKey, ...(COMMON_HEADER_SYNONYMS[targetKey] ?? []).map(makeHeaderKey)]);
  for (const variant of sourceVariants) {
    if (targetVariants.has(variant)) return 92;
  }
  for (const variant of sourceVariants) {
    for (const other of targetVariants) {
      if (variant.includes(other) || other.includes(variant)) return 70;
    }
  }
  return 0;
}

export function suggestColumnMappings(sourceHeaders: string[], targetHeaders: string[]): CsvMappingSuggestion[] {
  return targetHeaders
    .map((targetHeader) => {
      const ranked = sourceHeaders
        .map((sourceHeader) => ({
          sourceHeader,
          score: scoreHeaderMatch(sourceHeader, targetHeader),
        }))
        .sort((left, right) => right.score - left.score)[0];
      if (!ranked || ranked.score <= 0) {
        return {
          targetHeader,
          sourceHeader: "",
          confidence: "low" as const,
        };
      }
      return {
        targetHeader,
        sourceHeader: ranked.sourceHeader,
        confidence: ranked.score >= 90 ? "high" : ranked.score >= 70 ? "medium" : "low",
      };
    });
}

export function mapCsvRows(headers: string[], rows: string[][], mapping: Record<string, string>, targetHeaders: string[]): string[][] {
  const sourceIndexByHeader = new Map(headers.map((header, index) => [header, index]));
  return rows.map((row) =>
    targetHeaders.map((targetHeader) => {
      const sourceHeader = mapping[targetHeader];
      if (!sourceHeader) return "";
      const index = sourceIndexByHeader.get(sourceHeader);
      return typeof index === "number" ? row[index] ?? "" : "";
    }),
  );
}

export function buildCsvText(headers: string[], rows: string[][], delimiter: CsvDelimiter = ","): string {
  const escapeCell = (value: string) => {
    if (value.includes('"') || value.includes("\n") || value.includes("\r") || value.includes(delimiter)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCell(cell ?? "")).join(delimiter))
    .join("\n");
}

export function parseTargetSchema(raw: string): string[] {
  return normalizeLineEndings(raw)
    .split(/\n|,/)
    .map((part) => normalizeHeaderLabel(part))
    .filter(Boolean);
}

export function applyCleanupPreset(
  preset: "merchant-name-cleanup" | "dedupe-contacts" | "normalize-ecommerce-exports",
): CsvCleanupOptions {
  if (preset === "merchant-name-cleanup") {
    return {
      trimCells: true,
      collapseWhitespace: true,
      normalizeHeaders: true,
      fillMissingHeaders: true,
      dropEmptyRows: true,
      dedupeRows: false,
      textCase: "title",
    };
  }
  if (preset === "dedupe-contacts") {
    return {
      trimCells: true,
      collapseWhitespace: true,
      normalizeHeaders: true,
      fillMissingHeaders: true,
      dropEmptyRows: true,
      dedupeRows: true,
      textCase: "keep",
    };
  }
  return {
    trimCells: true,
    collapseWhitespace: true,
    normalizeHeaders: true,
    fillMissingHeaders: true,
    dropEmptyRows: true,
    dedupeRows: true,
    textCase: "keep",
  };
}
