export type ReceiptDocumentType = "receipt" | "invoice" | "unknown";

export interface ExtractedPartyInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
}

export interface ExtractedAmountField {
  amount: number | null;
  currency: string;
  sourceLine: string;
}

export interface ExtractedLineItem {
  id: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  total: number | null;
  sourceLine: string;
  confidence: "high" | "medium" | "low";
}

export interface ExtractedBookkeepingRow {
  rowType: "summary" | "item";
  documentType: ReceiptDocumentType;
  merchant: string;
  documentNumber: string;
  transactionDate: string;
  dueDate: string;
  category: string;
  currency: string;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  paymentMethod: string;
  lineDescription: string;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
}

export interface ReceiptInvoiceExtraction {
  documentType: ReceiptDocumentType;
  merchantName: string;
  invoiceNumber: string;
  purchaseDate: string;
  dueDate: string;
  currency: string;
  subtotal: ExtractedAmountField;
  tax: ExtractedAmountField;
  discount: ExtractedAmountField;
  tip: ExtractedAmountField;
  shipping: ExtractedAmountField;
  total: ExtractedAmountField;
  paymentMethod: string;
  categorySuggestion: string;
  vendor: ExtractedPartyInfo;
  lineItems: ExtractedLineItem[];
  confidenceScore: number;
  warnings: string[];
  bookkeepingRows: ExtractedBookkeepingRow[];
}

interface AmountCandidate {
  amount: number;
  currency: string;
  raw: string;
  line: string;
}

interface LabelledAmountMatch {
  amount: number | null;
  currency: string;
  sourceLine: string;
}

const DEFAULT_CURRENCY = "USD";
const CURRENCY_CODE_PATTERN =
  /\b(?:USD|EUR|GBP|JPY|CAD|AUD|NZD|INR|AED|SAR|CHF|CNY|KES|UGX|TZS|RWF|NGN|GHS|ZAR|XAF|XOF|ETB|EGP|MAD|BWP|ZMW|BRL|MXN|SGD|HKD)\b/i;

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₹": "INR",
  "₦": "NGN",
  "₵": "GHS",
};

const TOP_LINE_BLOCKLIST = [
  "invoice",
  "tax invoice",
  "receipt",
  "sales receipt",
  "bill to",
  "ship to",
  "customer copy",
  "merchant copy",
  "page",
  "date",
  "subtotal",
  "total",
  "amount due",
  "balance due",
  "thank you",
];

const PAYMENT_METHOD_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Cash", pattern: /\bcash\b/i },
  { label: "Bank transfer", pattern: /\b(bank transfer|wire transfer|eft|ach)\b/i },
  { label: "Mobile money", pattern: /\b(mobile money|momo|m-pesa|mpesa|airtel money)\b/i },
  { label: "PayPal", pattern: /\bpaypal\b/i },
  { label: "Visa", pattern: /\bvisa\b/i },
  { label: "Mastercard", pattern: /\bmaster\s*card|mastercard\b/i },
  { label: "American Express", pattern: /\bamerican express|amex\b/i },
  { label: "Debit card", pattern: /\bdebit\b/i },
  { label: "Credit card", pattern: /\bcredit\b/i },
];

const CATEGORY_RULES: Array<{ category: string; terms: string[] }> = [
  { category: "Software & SaaS", terms: ["software", "saas", "subscription", "github", "openai", "google workspace", "adobe", "microsoft", "hosting", "domain"] },
  { category: "Meals & Entertainment", terms: ["restaurant", "cafe", "coffee", "lunch", "dinner", "pizza", "bar", "takeaway", "food"] },
  { category: "Travel", terms: ["hotel", "lodge", "flight", "airlines", "uber", "bolt", "taxi", "airport", "booking", "airbnb"] },
  { category: "Fuel & Transport", terms: ["fuel", "petrol", "diesel", "parking", "bus", "train", "fare", "transport"] },
  { category: "Office Supplies", terms: ["office", "stationery", "paper", "toner", "printer", "supplies"] },
  { category: "Telecom & Internet", terms: ["airtime", "bundle", "data", "internet", "telecom", "broadband", "fiber"] },
  { category: "Utilities", terms: ["electricity", "water", "utility", "power", "gas bill"] },
  { category: "Marketing & Ads", terms: ["ads", "campaign", "facebook", "instagram", "linkedin", "google ads", "meta ads"] },
  { category: "Professional Services", terms: ["consulting", "legal", "accounting", "advisory", "retainer"] },
  { category: "Bank Fees", terms: ["bank charge", "service fee", "transfer fee", "processing fee"] },
  { category: "Equipment", terms: ["laptop", "monitor", "keyboard", "mouse", "device", "hardware"] },
];

function normalizeDocumentText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeLine(line: string): string {
  return line.replace(/\s+/g, " ").replace(/[|]+/g, " ").trim();
}

function buildEmptyAmount(currency: string): ExtractedAmountField {
  return { amount: null, currency, sourceLine: "" };
}

function parseMoneyNumber(rawValue: string): number | null {
  const trimmed = rawValue.replace(/[^\d,.\-]/g, "").trim();
  if (!trimmed) return null;

  const hasComma = trimmed.includes(",");
  const hasDot = trimmed.includes(".");
  let normalized = trimmed;

  if (hasComma && hasDot) {
    const decimalSeparator = trimmed.lastIndexOf(",") > trimmed.lastIndexOf(".") ? "," : ".";
    normalized =
      decimalSeparator === ","
        ? trimmed.replace(/\./g, "").replace(",", ".")
        : trimmed.replace(/,/g, "");
  } else if (hasComma) {
    const parts = trimmed.split(",");
    normalized = parts.length === 2 && parts[1].length <= 2 ? `${parts[0]}.${parts[1]}` : trimmed.replace(/,/g, "");
  } else if (hasDot) {
    const parts = trimmed.split(".");
    normalized = parts.length === 2 && parts[1].length <= 2 ? trimmed : trimmed.replace(/\./g, "");
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferCurrencyFromLine(line: string, fallback: string): string {
  const codeMatch = line.match(CURRENCY_CODE_PATTERN)?.[0];
  if (codeMatch) return codeMatch.toUpperCase();

  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOL_MAP)) {
    if (line.includes(symbol)) return code;
  }

  if (/\bksh\b/i.test(line)) return "KES";
  if (/\bugx\b/i.test(line)) return "UGX";
  if (/\btzs\b/i.test(line)) return "TZS";
  return fallback;
}

function collectAmountCandidates(lines: string[], fallbackCurrency: string): AmountCandidate[] {
  const amountPattern =
    /(?:\b[A-Z]{3}\b\s*)?[$€£¥₹₦₵]?\s*-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|(?:\b[A-Z]{3}\b\s*)?[$€£¥₹₦₵]?\s*-?\d+(?:[.,]\d{2})?/g;

  return lines.flatMap((line) => {
    const normalizedLine = sanitizeLine(line);
    const matches = normalizedLine.match(amountPattern) ?? [];
    const currency = inferCurrencyFromLine(normalizedLine, fallbackCurrency);
    return matches
      .map((raw) => ({
        amount: parseMoneyNumber(raw),
        currency,
        raw,
        line: normalizedLine,
      }))
      .filter((entry): entry is AmountCandidate => entry.amount !== null);
  });
}

function matchLabelledAmount(
  lines: string[],
  labels: RegExp[],
  fallbackCurrency: string,
): LabelledAmountMatch {
  for (const line of lines) {
    const normalizedLine = sanitizeLine(line);
    if (!labels.some((pattern) => pattern.test(normalizedLine))) continue;
    const candidates = collectAmountCandidates([normalizedLine], fallbackCurrency);
    if (!candidates.length) continue;
    const best = candidates[candidates.length - 1];
    return { amount: best.amount, currency: best.currency, sourceLine: normalizedLine };
  }
  return { amount: null, currency: fallbackCurrency, sourceLine: "" };
}

function extractFallbackTotal(lines: string[], fallbackCurrency: string): LabelledAmountMatch {
  const candidates = collectAmountCandidates(lines.slice(-6), fallbackCurrency);
  if (!candidates.length) {
    return { amount: null, currency: fallbackCurrency, sourceLine: "" };
  }
  const best = [...candidates].sort((left, right) => right.amount - left.amount)[0];
  return {
    amount: best.amount,
    currency: best.currency,
    sourceLine: best.line,
  };
}

function parseLooseDate(rawValue: string): string | null {
  const value = rawValue.trim().replace(/\.$/, "");
  if (!value) return null;

  const isoMatch = value.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10);
    const day = Number.parseInt(isoMatch[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }

  const slashMatch = value.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (slashMatch) {
    let year = Number.parseInt(slashMatch[3], 10);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const first = Number.parseInt(slashMatch[1], 10);
    const second = Number.parseInt(slashMatch[2], 10);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function extractDateByLabels(lines: string[], labels: RegExp[]): string {
  for (const line of lines) {
    const normalizedLine = sanitizeLine(line);
    if (!labels.some((pattern) => pattern.test(normalizedLine))) continue;
    const match = normalizedLine.match(/[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}|\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/);
    if (!match) continue;
    const parsed = parseLooseDate(match[0]);
    if (parsed) return parsed;
  }
  return "";
}

function extractFallbackDate(lines: string[]): string {
  for (const line of lines) {
    const normalizedLine = sanitizeLine(line);
    const match = normalizedLine.match(/[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}|\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/);
    if (!match) continue;
    const parsed = parseLooseDate(match[0]);
    if (parsed) return parsed;
  }
  return "";
}

function extractDocumentNumber(lines: string[]): string {
  const patterns = [
    /\b(?:invoice|inv)[\s#:.-]*(?:no|number|#)?[\s#:.-]*([A-Z0-9-]{3,})\b/i,
    /\b(?:receipt|rcpt)[\s#:.-]*(?:no|number|#)?[\s#:.-]*([A-Z0-9-]{3,})\b/i,
    /\b(?:reference|ref|order)[\s#:.-]*(?:no|number|#)?[\s#:.-]*([A-Z0-9-]{3,})\b/i,
  ];

  for (const line of lines) {
    const normalizedLine = sanitizeLine(line);
    for (const pattern of patterns) {
      const match = normalizedLine.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
  }

  return "";
}

function extractMerchantName(lines: string[]): string {
  const candidates = lines
    .slice(0, 12)
    .map((line) => sanitizeLine(line))
    .filter((line) => {
      const lower = line.toLowerCase();
      if (!line || line.length < 3 || line.length > 80) return false;
      if (/\bhttps?:\/\//i.test(line) || /@/.test(line)) return false;
      if (/\d{4,}/.test(line)) return false;
      if (TOP_LINE_BLOCKLIST.some((entry) => lower === entry || lower.startsWith(`${entry} `))) return false;
      if (/^(tel|phone|vat|tin|tax id|date|time)\b/i.test(line)) return false;
      return /[A-Za-z]{3,}/.test(line);
    });

  if (candidates.length) return candidates[0];

  const explicit = lines
    .map((line) => sanitizeLine(line))
    .find((line) => /^(from|seller|merchant|vendor)[:\s]/i.test(line));
  if (!explicit) return "";
  return explicit.replace(/^(from|seller|merchant|vendor)[:\s]+/i, "").trim();
}

function extractVendorInfo(lines: string[], merchantName: string): ExtractedPartyInfo {
  const joined = lines.map((line) => sanitizeLine(line)).join("\n");
  const email = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
  const phone =
    joined.match(/(?:\+?\d[\d\s().-]{6,}\d)/)?.[0]?.replace(/\s+/g, " ").trim() ?? "";
  const taxId =
    joined.match(/\b(?:TIN|VAT|PIN|Tax(?:\s+ID)?)[:\s#-]*([A-Z0-9-]{4,})/i)?.[1]?.trim() ?? "";
  const address = lines
    .map((line) => sanitizeLine(line))
    .find((line) => /\b(street|road|avenue|ave|boulevard|drive|kampala|nairobi|kigali|london|suite|building|plot|district)\b/i.test(line)) ?? "";

  return {
    name: merchantName,
    email,
    phone,
    address,
    taxId,
  };
}

function extractPaymentMethod(lines: string[]): string {
  const joined = lines.join("\n");
  for (const entry of PAYMENT_METHOD_PATTERNS) {
    if (entry.pattern.test(joined)) return entry.label;
  }
  return "";
}

function detectDocumentType(lines: string[]): ReceiptDocumentType {
  const joined = lines.join("\n").toLowerCase();
  if (/\binvoice\b/.test(joined) || /\bbalance due\b/.test(joined)) return "invoice";
  if (/\breceipt\b/.test(joined) || /\bthank you\b/.test(joined)) return "receipt";
  return "unknown";
}

function looksLikeTotalLine(line: string): boolean {
  return /\b(sub\s*total|subtotal|tax|vat|gst|sales tax|total|grand total|amount due|balance due|tip|discount|shipping)\b/i.test(line);
}

function extractLineItems(lines: string[], fallbackCurrency: string): ExtractedLineItem[] {
  const items: ExtractedLineItem[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = sanitizeLine(lines[index]);
    if (!line || line.length < 4) continue;
    if (looksLikeTotalLine(line)) continue;
    if (/^(invoice|receipt|date|time|cashier|table|server|payment|change|bill to|ship to)\b/i.test(line)) continue;
    if (!/[A-Za-z]/.test(line)) continue;

    const amountMatches = collectAmountCandidates([line], fallbackCurrency);
    if (!amountMatches.length) continue;

    const segments = line.split(/\s{2,}|\t+|\s\|\s/).map((segment) => segment.trim()).filter(Boolean);
    const descriptionSource = segments.length > 1 ? segments[0] : line;
    const description = descriptionSource.replace(/\b\d+\s*[x×]\s*/i, "").trim();
    if (!description || description.length < 2) continue;

    const totalCandidate = amountMatches[amountMatches.length - 1]?.amount ?? null;
    const unitPriceCandidate = amountMatches.length >= 2 ? amountMatches[amountMatches.length - 2]?.amount ?? null : null;
    const quantityMatch = line.match(/\b(\d+(?:[.,]\d+)?)\s*[x×]\b/i) ?? line.match(/\bqty[:\s]+(\d+(?:[.,]\d+)?)\b/i);
    const quantity = quantityMatch ? parseMoneyNumber(quantityMatch[1]) : null;
    const confidence = segments.length >= 3 || quantity !== null ? "high" : amountMatches.length >= 2 ? "medium" : "low";

    if (totalCandidate === null) continue;

    items.push({
      id: `line-${index + 1}`,
      description,
      quantity,
      unitPrice: unitPriceCandidate,
      total: totalCandidate,
      sourceLine: line,
      confidence,
    });
  }

  const deduped = items.filter((item, index, array) => {
    return array.findIndex((candidate) => candidate.sourceLine === item.sourceLine) === index;
  });

  return deduped.slice(0, 16);
}

function inferCategorySuggestion(merchantName: string, lineItems: ExtractedLineItem[], paymentMethod: string): string {
  const haystack = `${merchantName}\n${lineItems.map((item) => item.description).join("\n")}\n${paymentMethod}`.toLowerCase();
  const match = CATEGORY_RULES.find((entry) => entry.terms.some((term) => haystack.includes(term)));
  return match?.category ?? "General expense";
}

function calculateConfidenceScore(input: {
  merchantName: string;
  purchaseDate: string;
  currency: string;
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  invoiceNumber: string;
  lineItems: ExtractedLineItem[];
  paymentMethod: string;
  documentType: ReceiptDocumentType;
}): number {
  let score = 12;
  if (input.documentType !== "unknown") score += 10;
  if (input.merchantName) score += 18;
  if (input.purchaseDate) score += 14;
  if (input.total !== null) score += 18;
  if (input.subtotal !== null) score += 8;
  if (input.tax !== null) score += 6;
  if (input.currency && input.currency !== DEFAULT_CURRENCY) score += 6;
  if (input.invoiceNumber) score += 8;
  if (input.paymentMethod) score += 5;
  if (input.lineItems.length >= 1) score += 10;
  if (input.lineItems.length >= 3) score += 5;
  return Math.max(0, Math.min(100, score));
}

function buildWarnings(input: {
  merchantName: string;
  purchaseDate: string;
  total: number | null;
  lineItems: ExtractedLineItem[];
  confidenceScore: number;
  rawText: string;
}): string[] {
  const warnings: string[] = [];
  if (!input.merchantName) warnings.push("Merchant name could not be identified confidently.");
  if (!input.purchaseDate) warnings.push("Transaction date was not detected.");
  if (input.total === null) warnings.push("No final total was found. Review the raw text before exporting.");
  if (!input.lineItems.length) warnings.push("No line items were parsed. This is common with very compact receipts.");
  if (input.confidenceScore < 55) warnings.push("Overall confidence is low. Review totals, dates, and invoice number before using the export.");
  const noisyCharacters = (input.rawText.match(/[^A-Za-z0-9\s.,:;()/#&@+\-%$€£¥₹₦₵]/g) ?? []).length;
  if (input.rawText.length > 40 && noisyCharacters / input.rawText.length > 0.08) {
    warnings.push("The extracted text looks noisy, which usually means OCR quality was weak.");
  }
  return warnings;
}

function buildBookkeepingRows(
  extraction: Omit<ReceiptInvoiceExtraction, "bookkeepingRows" | "warnings" | "confidenceScore">,
): ExtractedBookkeepingRow[] {
  const summaryRow: ExtractedBookkeepingRow = {
    rowType: "summary",
    documentType: extraction.documentType,
    merchant: extraction.merchantName,
    documentNumber: extraction.invoiceNumber,
    transactionDate: extraction.purchaseDate,
    dueDate: extraction.dueDate,
    category: extraction.categorySuggestion,
    currency: extraction.currency,
    subtotal: extraction.subtotal.amount,
    tax: extraction.tax.amount,
    total: extraction.total.amount,
    paymentMethod: extraction.paymentMethod,
    lineDescription: "",
    quantity: null,
    unitPrice: null,
    lineTotal: null,
  };

  const itemRows = extraction.lineItems.map((item) => ({
    ...summaryRow,
    rowType: "item" as const,
    lineDescription: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.total,
  }));

  return [summaryRow, ...itemRows];
}

export function analyzeReceiptInvoiceText(rawText: string): ReceiptInvoiceExtraction {
  const normalizedText = normalizeDocumentText(rawText);
  const lines = normalizedText
    .split("\n")
    .map((line) => sanitizeLine(line))
    .filter(Boolean);

  const detectedCurrency = lines.map((line) => inferCurrencyFromLine(line, DEFAULT_CURRENCY)).find(Boolean) ?? DEFAULT_CURRENCY;
  const documentType = detectDocumentType(lines);
  const merchantName = extractMerchantName(lines);
  const invoiceNumber = extractDocumentNumber(lines);
  const purchaseDate = extractDateByLabels(lines, [/\b(date|invoice date|receipt date|issued|transaction date|sale date)\b/i]) || extractFallbackDate(lines);
  const dueDate = extractDateByLabels(lines, [/\b(due|due date|payment due|pay by)\b/i]);
  const subtotal = matchLabelledAmount(lines, [/\b(sub\s*total|subtotal|net total)\b/i], detectedCurrency);
  const tax = matchLabelledAmount(lines, [/\b(tax|vat|gst|sales tax)\b/i], detectedCurrency);
  const discount = matchLabelledAmount(lines, [/\b(discount|promo|coupon)\b/i], detectedCurrency);
  const tip = matchLabelledAmount(lines, [/\btip|gratuity\b/i], detectedCurrency);
  const shipping = matchLabelledAmount(lines, [/\b(shipping|delivery)\b/i], detectedCurrency);
  const labelledTotal = matchLabelledAmount(lines, [/\b(grand total|total due|amount due|balance due|total)\b/i], detectedCurrency);
  const total = labelledTotal.amount === null ? extractFallbackTotal(lines, detectedCurrency) : labelledTotal;
  const paymentMethod = extractPaymentMethod(lines);
  const lineItems = extractLineItems(lines, detectedCurrency);
  const categorySuggestion = inferCategorySuggestion(merchantName, lineItems, paymentMethod);
  const vendor = extractVendorInfo(lines, merchantName);

  const confidenceScore = calculateConfidenceScore({
    merchantName,
    purchaseDate,
    currency: detectedCurrency,
    total: total.amount,
    subtotal: subtotal.amount,
    tax: tax.amount,
    invoiceNumber,
    lineItems,
    paymentMethod,
    documentType,
  });

  const baseExtraction = {
    documentType,
    merchantName,
    invoiceNumber,
    purchaseDate,
    dueDate,
    currency: detectedCurrency,
    subtotal: subtotal.amount === null ? buildEmptyAmount(detectedCurrency) : subtotal,
    tax: tax.amount === null ? buildEmptyAmount(detectedCurrency) : tax,
    discount: discount.amount === null ? buildEmptyAmount(detectedCurrency) : discount,
    tip: tip.amount === null ? buildEmptyAmount(detectedCurrency) : tip,
    shipping: shipping.amount === null ? buildEmptyAmount(detectedCurrency) : shipping,
    total: total.amount === null ? buildEmptyAmount(detectedCurrency) : total,
    paymentMethod,
    categorySuggestion,
    vendor,
    lineItems,
  };

  return {
    ...baseExtraction,
    confidenceScore,
    warnings: buildWarnings({
      merchantName,
      purchaseDate,
      total: total.amount,
      lineItems,
      confidenceScore,
      rawText: normalizedText,
    }),
    bookkeepingRows: buildBookkeepingRows(baseExtraction),
  };
}
