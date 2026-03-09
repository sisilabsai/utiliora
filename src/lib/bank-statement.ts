import { detectCsvDelimiter, parseDelimitedText } from "@/lib/csv-cleanup";

export interface StatementTransaction {
  id: string;
  date: string;
  description: string;
  merchant: string;
  normalizedMerchant: string;
  amount: number;
  debit: number;
  credit: number;
  balance: number | null;
  currency: string;
  category: string;
  source: "csv" | "text";
  sourceLine: string;
}

export interface MerchantCluster {
  merchant: string;
  count: number;
  totalSpent: number;
  averageSpent: number;
  category: string;
}

export interface RecurringChargeInsight {
  merchant: string;
  occurrences: number;
  averageAmount: number;
  averageIntervalDays: number;
  category: string;
}

export interface DuplicateChargeInsight {
  merchant: string;
  amount: number;
  dates: string[];
}

export interface SpikeInsight {
  merchant: string;
  amount: number;
  usualAmount: number;
  date: string;
  category: string;
}

export interface BankStatementAnalysis {
  transactions: StatementTransaction[];
  incomeTotal: number;
  expenseTotal: number;
  netCashflow: number;
  recurringCharges: RecurringChargeInsight[];
  duplicateCharges: DuplicateChargeInsight[];
  spikes: SpikeInsight[];
  hiddenFees: StatementTransaction[];
  merchantClusters: MerchantCluster[];
  subscriptions: MerchantCluster[];
  currencies: string[];
}

const DEFAULT_CURRENCY = "USD";

const CATEGORY_RULES: Array<{ category: string; terms: string[] }> = [
  { category: "Fees & Charges", terms: ["fee", "charge", "commission", "maintenance", "atm", "interest", "levy"] },
  { category: "Utilities", terms: ["electricity", "water", "power", "utility", "gas"] },
  { category: "Telecom & Internet", terms: ["airtime", "bundle", "data", "internet", "telecom", "mobile money", "mtn", "airtel", "vodafone"] },
  { category: "Software & SaaS", terms: ["microsoft", "google", "aws", "openai", "adobe", "github", "notion", "figma", "canva", "zoom", "slack"] },
  { category: "Transport & Fuel", terms: ["uber", "bolt", "taxi", "fuel", "petrol", "diesel", "shell", "totalenergies", "parking"] },
  { category: "Food & Dining", terms: ["restaurant", "cafe", "coffee", "pizza", "burger", "bar", "kfc", "food", "supermarket"] },
  { category: "Shopping", terms: ["amazon", "jumia", "shop", "store", "mart", "mall"] },
  { category: "Transfers", terms: ["transfer", "withdrawal", "deposit", "cashout", "cash out", "cash withdrawal", "rtgs", "neft"] },
  { category: "Salary & Income", terms: ["salary", "payroll", "invoice payment", "payout", "refund", "cashback"] },
  { category: "Rent & Housing", terms: ["rent", "landlord", "apartment", "housing"] },
  { category: "Healthcare", terms: ["clinic", "hospital", "pharmacy", "medical"] },
  { category: "Education", terms: ["school", "university", "tuition", "academy"] },
];

function normalizeText(value: string): string {
  return value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim();
}

function normalizeHeaderKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDateValue(raw: string): string {
  const value = raw.trim();
  if (!value) return "";

  const iso = value.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) {
    const year = Number.parseInt(iso[1], 10);
    const month = Number.parseInt(iso[2], 10);
    const day = Number.parseInt(iso[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }

  const slash = value.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (slash) {
    const a = Number.parseInt(slash[1], 10);
    const b = Number.parseInt(slash[2], 10);
    let year = Number.parseInt(slash[3], 10);
    if (year < 100) year += year >= 70 ? 1900 : 2000;
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function parseMoney(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const negative = /^\s*-/.test(trimmed) || /^\(.*\)$/.test(trimmed);
  const normalized = trimmed.replace(/[^\d,.-]/g, "").replace(/^\(|\)$/g, "");
  if (!normalized) return null;

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");
  let next = normalized;
  if (hasComma && hasDot) {
    const decimalSeparator = normalized.lastIndexOf(",") > normalized.lastIndexOf(".") ? "," : ".";
    next = decimalSeparator === "," ? normalized.replace(/\./g, "").replace(",", ".") : normalized.replace(/,/g, "");
  } else if (hasComma) {
    const pieces = normalized.split(",");
    next = pieces.length === 2 && pieces[1].length <= 2 ? `${pieces[0]}.${pieces[1]}` : normalized.replace(/,/g, "");
  }

  const parsed = Number.parseFloat(next);
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

function normalizeMerchantName(description: string): string {
  return description
    .toUpperCase()
    .replace(/\b(POS|ATM|TRF|TRANSFER|PAYMENT|PURCHASE|CARD|DEBIT|CREDIT|REF|REFERENCE|TXN|BANK)\b/g, " ")
    .replace(/\b\d{2,}\b/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

function categorizeTransaction(description: string, amount: number): string {
  const lower = description.toLowerCase();
  const match = CATEGORY_RULES.find((rule) => rule.terms.some((term) => lower.includes(term)));
  if (match) return match.category;
  return amount >= 0 ? "Income & Credits" : "General spending";
}

function daysBetween(left: string, right: string): number {
  const a = new Date(left);
  const b = new Date(right);
  return Math.round(Math.abs(a.getTime() - b.getTime()) / 86_400_000);
}

function makeTransaction(
  entry: Omit<StatementTransaction, "merchant" | "normalizedMerchant" | "category">,
): StatementTransaction {
  const merchant = entry.description.trim() || "Unknown";
  const normalizedMerchant = normalizeMerchantName(merchant) || merchant.toUpperCase();
  return {
    ...entry,
    merchant,
    normalizedMerchant,
    category: categorizeTransaction(merchant, entry.amount),
  };
}

function parseStatementCsv(raw: string): StatementTransaction[] {
  const dataset = parseDelimitedText(raw, detectCsvDelimiter(raw));
  if (!dataset.headers.length) return [];
  const headerKeys = dataset.headers.map(normalizeHeaderKey);

  const findIndex = (...patterns: RegExp[]) => headerKeys.findIndex((header) => patterns.some((pattern) => pattern.test(header)));
  const dateIndex = findIndex(/\b(date|transaction date|posted date|value date)\b/);
  const descriptionIndex = findIndex(/\b(description|details|narration|memo|merchant|particulars)\b/);
  const debitIndex = findIndex(/\b(debit|withdrawal|money out|dr)\b/);
  const creditIndex = findIndex(/\b(credit|deposit|money in|cr)\b/);
  const amountIndex = findIndex(/\b(amount|transaction amount|value)\b/);
  const balanceIndex = findIndex(/\b(balance|running balance|available balance)\b/);
  const currencyIndex = findIndex(/\b(currency|ccy)\b/);
  const typeIndex = findIndex(/\b(type|direction|dr cr|drcr)\b/);

  return dataset.rows
    .map((row, index) => {
      const description = descriptionIndex >= 0 ? row[descriptionIndex] ?? "" : row.find((cell) => /[A-Za-z]{3,}/.test(cell)) ?? "";
      const date = dateIndex >= 0 ? parseDateValue(row[dateIndex] ?? "") : "";
      const debit = debitIndex >= 0 ? Math.abs(parseMoney(row[debitIndex] ?? "") ?? 0) : 0;
      const credit = creditIndex >= 0 ? Math.abs(parseMoney(row[creditIndex] ?? "") ?? 0) : 0;
      const rawAmount = amountIndex >= 0 ? parseMoney(row[amountIndex] ?? "") : null;
      const direction = typeIndex >= 0 ? (row[typeIndex] ?? "").toLowerCase() : "";
      const signedAmount =
        debit > 0
          ? -debit
          : credit > 0
            ? credit
            : rawAmount !== null
              ? /debit|withdraw|dr|out/.test(direction)
                ? -Math.abs(rawAmount)
                : /credit|deposit|cr|in/.test(direction)
                  ? Math.abs(rawAmount)
                  : rawAmount
              : 0;
      const balance = balanceIndex >= 0 ? parseMoney(row[balanceIndex] ?? "") : null;
      const currency = currencyIndex >= 0 && row[currencyIndex]?.trim() ? row[currencyIndex].trim().toUpperCase() : DEFAULT_CURRENCY;

      if (!description.trim() || !date || !signedAmount) return null;

      return makeTransaction({
        id: `csv-${index + 1}`,
        date,
        description: description.trim(),
        amount: signedAmount,
        debit: signedAmount < 0 ? Math.abs(signedAmount) : 0,
        credit: signedAmount > 0 ? signedAmount : 0,
        balance,
        currency,
        source: "csv",
        sourceLine: row.join(" | "),
      });
    })
    .filter((item): item is StatementTransaction => Boolean(item));
}

function parseStatementText(raw: string): StatementTransaction[] {
  const lines = normalizeText(raw).split("\n").map((line) => line.trim()).filter(Boolean);
  const transactions: StatementTransaction[] = [];

  lines.forEach((line, index) => {
    const dateMatch = line.match(/[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{2,4}|\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/);
    if (!dateMatch) return;
    const date = parseDateValue(dateMatch[0]);
    if (!date) return;

    const amountMatches = Array.from(line.matchAll(/-?\(?[$€£¥₹₦₵]?\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})|-?\(?[$€£¥₹₦₵]?\s*\d+(?:[.,]\d{2})/g));
    if (!amountMatches.length) return;
    const signedAmount = parseMoney(amountMatches[0][0] ?? "");
    const balance = amountMatches.length > 1 ? parseMoney(amountMatches[amountMatches.length - 1][0] ?? "") : null;
    if (signedAmount === null || signedAmount === 0) return;

    let description = line.replace(dateMatch[0], " ");
    amountMatches.forEach((match) => {
      description = description.replace(match[0] ?? "", " ");
    });
    description = description.replace(/\s+/g, " ").trim();
    if (!description) return;

    const currency =
      /\b(USD|EUR|GBP|KES|UGX|TZS|RWF|NGN|GHS|ZAR|XAF|XOF|INR|AED|MXN)\b/i.exec(line)?.[1]?.toUpperCase() ??
      DEFAULT_CURRENCY;

    transactions.push(
      makeTransaction({
        id: `text-${index + 1}`,
        date,
        description,
        amount: signedAmount,
        debit: signedAmount < 0 ? Math.abs(signedAmount) : 0,
        credit: signedAmount > 0 ? signedAmount : 0,
        balance,
        currency,
        source: "text",
        sourceLine: line,
      }),
    );
  });

  return transactions;
}

function detectRecurringCharges(transactions: StatementTransaction[]): RecurringChargeInsight[] {
  const spending = transactions.filter((transaction) => transaction.amount < 0);
  const grouped = new Map<string, StatementTransaction[]>();
  spending.forEach((transaction) => {
    const key = transaction.normalizedMerchant;
    const list = grouped.get(key) ?? [];
    list.push(transaction);
    grouped.set(key, list);
  });

  return [...grouped.entries()]
    .map(([merchant, entries]) => {
      const sorted = [...entries].sort((left, right) => left.date.localeCompare(right.date));
      if (sorted.length < 2) return null;
      const intervals = sorted.slice(1).map((entry, index) => daysBetween(entry.date, sorted[index].date));
      const averageIntervalDays = intervals.reduce((sum, value) => sum + value, 0) / Math.max(1, intervals.length);
      const amounts = sorted.map((entry) => Math.abs(entry.amount));
      const averageAmount = amounts.reduce((sum, value) => sum + value, 0) / amounts.length;
      const consistentAmount = amounts.every((amount) => Math.abs(amount - averageAmount) <= Math.max(averageAmount * 0.18, 2));
      if (!consistentAmount || averageIntervalDays < 20 || averageIntervalDays > 40) return null;
      return {
        merchant,
        occurrences: sorted.length,
        averageAmount: Math.round(averageAmount * 100) / 100,
        averageIntervalDays: Math.round(averageIntervalDays * 10) / 10,
        category: sorted[0].category,
      } satisfies RecurringChargeInsight;
    })
    .filter((item): item is RecurringChargeInsight => Boolean(item))
    .sort((left, right) => right.averageAmount - left.averageAmount)
    .slice(0, 12);
}

function detectDuplicateCharges(transactions: StatementTransaction[]): DuplicateChargeInsight[] {
  const grouped = new Map<string, StatementTransaction[]>();
  transactions
    .filter((transaction) => transaction.amount < 0)
    .forEach((transaction) => {
      const key = `${transaction.normalizedMerchant}|${Math.abs(transaction.amount).toFixed(2)}`;
      const list = grouped.get(key) ?? [];
      list.push(transaction);
      grouped.set(key, list);
    });

  return [...grouped.values()]
    .map((entries) => {
      if (entries.length < 2) return null;
      const sorted = [...entries].sort((left, right) => left.date.localeCompare(right.date));
      const nearDuplicateDates = sorted
        .map((entry) => entry.date)
        .filter((date, index, array) => index === 0 || daysBetween(date, array[index - 1]) <= 3);
      if (nearDuplicateDates.length < 2) return null;
      return {
        merchant: sorted[0].normalizedMerchant,
        amount: Math.abs(sorted[0].amount),
        dates: nearDuplicateDates,
      } satisfies DuplicateChargeInsight;
    })
    .filter((item): item is DuplicateChargeInsight => Boolean(item))
    .slice(0, 10);
}

function detectSpikes(transactions: StatementTransaction[]): SpikeInsight[] {
  const grouped = new Map<string, StatementTransaction[]>();
  transactions
    .filter((transaction) => transaction.amount < 0)
    .forEach((transaction) => {
      const list = grouped.get(transaction.normalizedMerchant) ?? [];
      list.push(transaction);
      grouped.set(transaction.normalizedMerchant, list);
    });

  return [...grouped.values()]
    .flatMap((entries) => {
      if (entries.length < 2) return [];
      const average = entries.reduce((sum, entry) => sum + Math.abs(entry.amount), 0) / entries.length;
      return entries
        .filter((entry) => Math.abs(entry.amount) >= Math.max(average * 1.75, average + 20))
        .map((entry) => ({
          merchant: entry.normalizedMerchant,
          amount: Math.abs(entry.amount),
          usualAmount: Math.round(average * 100) / 100,
          date: entry.date,
          category: entry.category,
        }));
    })
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 10);
}

function buildMerchantClusters(transactions: StatementTransaction[]): MerchantCluster[] {
  const grouped = new Map<string, StatementTransaction[]>();
  transactions
    .filter((transaction) => transaction.amount < 0)
    .forEach((transaction) => {
      const list = grouped.get(transaction.normalizedMerchant) ?? [];
      list.push(transaction);
      grouped.set(transaction.normalizedMerchant, list);
    });

  return [...grouped.entries()]
    .map(([merchant, entries]) => {
      const totalSpent = entries.reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
      return {
        merchant,
        count: entries.length,
        totalSpent: Math.round(totalSpent * 100) / 100,
        averageSpent: Math.round((totalSpent / entries.length) * 100) / 100,
        category: entries[0].category,
      } satisfies MerchantCluster;
    })
    .sort((left, right) => right.totalSpent - left.totalSpent)
    .slice(0, 20);
}

export function analyzeBankStatement(raw: string, sourceHint: "csv" | "text" | "auto" = "auto"): BankStatementAnalysis {
  const normalized = normalizeText(raw);
  const transactions =
    sourceHint === "csv"
      ? parseStatementCsv(normalized)
      : sourceHint === "text"
        ? parseStatementText(normalized)
        : (() => {
            const csvTransactions = parseStatementCsv(normalized);
            if (csvTransactions.length >= 2) return csvTransactions;
            return parseStatementText(normalized);
          })();

  const sortedTransactions = [...transactions].sort((left, right) => left.date.localeCompare(right.date));
  const incomeTotal = sortedTransactions.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0);
  const expenseTotal = sortedTransactions.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
  const netCashflow = incomeTotal - expenseTotal;
  const hiddenFees = sortedTransactions.filter((entry) => entry.amount < 0 && entry.category === "Fees & Charges").slice(0, 20);
  const merchantClusters = buildMerchantClusters(sortedTransactions);
  const recurringCharges = detectRecurringCharges(sortedTransactions);
  const duplicateCharges = detectDuplicateCharges(sortedTransactions);
  const spikes = detectSpikes(sortedTransactions);
  const subscriptions = recurringCharges
    .map((entry) => merchantClusters.find((cluster) => cluster.merchant === entry.merchant))
    .filter((entry): entry is MerchantCluster => Boolean(entry));
  const currencies = Array.from(new Set(sortedTransactions.map((entry) => entry.currency).filter(Boolean)));

  return {
    transactions: sortedTransactions,
    incomeTotal: Math.round(incomeTotal * 100) / 100,
    expenseTotal: Math.round(expenseTotal * 100) / 100,
    netCashflow: Math.round(netCashflow * 100) / 100,
    recurringCharges,
    duplicateCharges,
    spikes,
    hiddenFees,
    merchantClusters,
    subscriptions,
    currencies,
  };
}
