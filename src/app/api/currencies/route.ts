import { NextResponse } from "next/server";

interface CurrencyOption {
  code: string;
  name: string;
}

const AFRICAN_PRIORITY_CURRENCIES: CurrencyOption[] = [
  { code: "DZD", name: "Algerian Dinar" },
  { code: "AOA", name: "Angolan Kwanza" },
  { code: "BWP", name: "Botswana Pula" },
  { code: "BIF", name: "Burundian Franc" },
  { code: "CVE", name: "Cape Verdean Escudo" },
  { code: "KMF", name: "Comorian Franc" },
  { code: "CDF", name: "Congolese Franc" },
  { code: "DJF", name: "Djiboutian Franc" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "ERN", name: "Eritrean Nakfa" },
  { code: "SZL", name: "Eswatini Lilangeni" },
  { code: "ETB", name: "Ethiopian Birr" },
  { code: "GMD", name: "Gambian Dalasi" },
  { code: "GHS", name: "Ghanaian Cedi" },
  { code: "GNF", name: "Guinean Franc" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "LSL", name: "Lesotho Loti" },
  { code: "LRD", name: "Liberian Dollar" },
  { code: "LYD", name: "Libyan Dinar" },
  { code: "MGA", name: "Malagasy Ariary" },
  { code: "MWK", name: "Malawian Kwacha" },
  { code: "MRO", name: "Mauritanian Ouguiya" },
  { code: "MUR", name: "Mauritian Rupee" },
  { code: "MAD", name: "Moroccan Dirham" },
  { code: "MZN", name: "Mozambican Metical" },
  { code: "NAD", name: "Namibian Dollar" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "RWF", name: "Rwandan Franc" },
  { code: "STN", name: "Sao Tome and Principe Dobra" },
  { code: "SCR", name: "Seychellois Rupee" },
  { code: "SLL", name: "Sierra Leonean Leone" },
  { code: "SOS", name: "Somali Shilling" },
  { code: "ZAR", name: "South African Rand" },
  { code: "SSP", name: "South Sudanese Pound" },
  { code: "SDG", name: "Sudanese Pound" },
  { code: "TZS", name: "Tanzanian Shilling" },
  { code: "TND", name: "Tunisian Dinar" },
  { code: "UGX", name: "Ugandan Shilling" },
  { code: "XAF", name: "Central African CFA Franc" },
  { code: "XOF", name: "West African CFA Franc" },
  { code: "ZMW", name: "Zambian Kwacha" },
  { code: "ZWL", name: "Zimbabwean Dollar" },
];

function normalizeCurrencyEntries(entries: Array<[string, string]>): CurrencyOption[] {
  return entries
    .map(([code, name]) => ({ code: code.trim().toUpperCase(), name: name.trim() }))
    .filter((item) => /^[A-Z]{3}$/.test(item.code) && item.name.length > 0)
    .sort((left, right) => left.code.localeCompare(right.code));
}

function mergeCurrencies(...lists: CurrencyOption[][]): CurrencyOption[] {
  const map = new Map<string, string>();
  lists.forEach((list) => {
    list.forEach((item) => {
      if (!/^[A-Z]{3}$/.test(item.code)) return;
      if (!item.name.trim()) return;
      if (!map.has(item.code)) {
        map.set(item.code, item.name.trim());
      }
    });
  });
  return [...map.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((left, right) => left.code.localeCompare(right.code));
}

function fallbackCurrenciesFromIntl(): CurrencyOption[] {
  const intlWithSupported = Intl as typeof Intl & { supportedValuesOf?: (key: "currency") => string[] };
  const supportedCodes = intlWithSupported.supportedValuesOf?.("currency") ?? [];
  const displayNames =
    typeof Intl.DisplayNames === "function"
      ? new Intl.DisplayNames(["en"], { type: "currency" })
      : null;
  const entries = supportedCodes.map((code) => [code, displayNames?.of(code) ?? code] as [string, string]);
  const fromIntl = normalizeCurrencyEntries(entries);
  return mergeCurrencies(fromIntl, AFRICAN_PRIORITY_CURRENCIES);
}

async function fetchOpenExchangeCurrencies(): Promise<CurrencyOption[]> {
  const response = await fetch("https://openexchangerates.org/api/currencies.json", {
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!response.ok) {
    throw new Error(`OpenExchangeRates returned status ${response.status}`);
  }
  const payload = (await response.json()) as Record<string, string>;
  const entries = Object.entries(payload);
  if (!entries.length) {
    throw new Error("OpenExchangeRates returned empty payload");
  }
  return normalizeCurrencyEntries(entries);
}

async function fetchFrankfurterCurrencies(): Promise<CurrencyOption[]> {
  const response = await fetch("https://api.frankfurter.app/currencies", {
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!response.ok) {
    throw new Error(`Frankfurter returned status ${response.status}`);
  }
  const payload = (await response.json()) as Record<string, string>;
  const entries = Object.entries(payload);
  if (!entries.length) {
    throw new Error("Frankfurter returned empty currency payload");
  }
  return normalizeCurrencyEntries(entries);
}

export async function GET() {
  try {
    const currencies = mergeCurrencies(await fetchOpenExchangeCurrencies(), AFRICAN_PRIORITY_CURRENCIES);
    return NextResponse.json(
      { ok: true, source: "openexchangerates+african-priority", currencies },
      {
        headers: {
          "Cache-Control": "s-maxage=86400, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    try {
      const currencies = mergeCurrencies(await fetchFrankfurterCurrencies(), AFRICAN_PRIORITY_CURRENCIES);
      return NextResponse.json(
        { ok: true, source: "frankfurter+african-priority", currencies },
        {
          headers: {
            "Cache-Control": "s-maxage=86400, stale-while-revalidate=86400",
          },
        },
      );
    } catch {
      const currencies = fallbackCurrenciesFromIntl();
      return NextResponse.json(
        { ok: true, source: "intl-fallback+african-priority", currencies },
        {
          headers: {
            "Cache-Control": "s-maxage=86400, stale-while-revalidate=86400",
          },
        },
      );
    }
  }
}
