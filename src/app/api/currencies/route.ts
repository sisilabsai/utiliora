import { NextResponse } from "next/server";

interface CurrencyOption {
  code: string;
  name: string;
}

function normalizeCurrencyEntries(entries: Array<[string, string]>): CurrencyOption[] {
  return entries
    .map(([code, name]) => ({ code: code.trim().toUpperCase(), name: name.trim() }))
    .filter((item) => /^[A-Z]{3}$/.test(item.code) && item.name.length > 0)
    .sort((left, right) => left.code.localeCompare(right.code));
}

function fallbackCurrenciesFromIntl(): CurrencyOption[] {
  const intlWithSupported = Intl as typeof Intl & { supportedValuesOf?: (key: "currency") => string[] };
  const supportedCodes = intlWithSupported.supportedValuesOf?.("currency") ?? [
    "USD",
    "EUR",
    "GBP",
    "JPY",
    "CAD",
    "AUD",
    "INR",
  ];
  const displayNames =
    typeof Intl.DisplayNames === "function"
      ? new Intl.DisplayNames(["en"], { type: "currency" })
      : null;
  const entries = supportedCodes.map((code) => [code, displayNames?.of(code) ?? code] as [string, string]);
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
    const currencies = await fetchFrankfurterCurrencies();
    return NextResponse.json(
      { ok: true, source: "frankfurter", currencies },
      {
        headers: {
          "Cache-Control": "s-maxage=86400, stale-while-revalidate=86400",
        },
      },
    );
  } catch {
    const currencies = fallbackCurrenciesFromIntl();
    return NextResponse.json(
      { ok: true, source: "intl-fallback", currencies },
      {
        headers: {
          "Cache-Control": "s-maxage=86400, stale-while-revalidate=86400",
        },
      },
    );
  }
}
