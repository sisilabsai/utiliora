import { NextRequest, NextResponse } from "next/server";

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

interface RatePayload {
  rate: number;
  date: string;
}

function sanitizeCurrency(code: string | null, fallback: string): string {
  if (!code) return fallback;
  const normalized = code.trim().toUpperCase();
  return CURRENCY_CODE_PATTERN.test(normalized) ? normalized : fallback;
}

async function fetchFrankfurterRate(from: string, to: string): Promise<RatePayload> {
  const response = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
    next: { revalidate: 60 * 30 },
  });
  if (!response.ok) {
    throw new Error(`Frankfurter rate fetch failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { date?: string; rates?: Record<string, number> };
  const rate = payload.rates?.[to];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Frankfurter returned invalid rate payload");
  }

  return {
    rate,
    date: typeof payload.date === "string" && payload.date ? payload.date : new Date().toISOString().slice(0, 10),
  };
}

async function fetchOpenErApiRate(from: string, to: string): Promise<RatePayload> {
  const response = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`, {
    next: { revalidate: 60 * 30 },
  });
  if (!response.ok) {
    throw new Error(`Open ER API rate fetch failed with status ${response.status}`);
  }

  const payload = (await response.json()) as {
    rates?: Record<string, number>;
    time_last_update_utc?: string;
  };
  const rate = payload.rates?.[to];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("Open ER API returned invalid rate payload");
  }

  return {
    rate,
    date:
      typeof payload.time_last_update_utc === "string" && payload.time_last_update_utc
        ? payload.time_last_update_utc
        : new Date().toISOString().slice(0, 10),
  };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const from = sanitizeCurrency(params.get("from"), "USD");
  const to = sanitizeCurrency(params.get("to"), "EUR");

  if (from === to) {
    return NextResponse.json(
      { ok: true, source: "identity", from, to, rate: 1, inverseRate: 1, date: new Date().toISOString().slice(0, 10) },
      {
        headers: {
          "Cache-Control": "s-maxage=1800, stale-while-revalidate=1800",
        },
      },
    );
  }

  try {
    const rate = await fetchFrankfurterRate(from, to);
    return NextResponse.json(
      {
        ok: true,
        source: "frankfurter",
        from,
        to,
        rate: rate.rate,
        inverseRate: rate.rate > 0 ? 1 / rate.rate : 0,
        date: rate.date,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=1800, stale-while-revalidate=1800",
        },
      },
    );
  } catch {
    try {
      const rate = await fetchOpenErApiRate(from, to);
      return NextResponse.json(
        {
          ok: true,
          source: "open-er-api",
          from,
          to,
          rate: rate.rate,
          inverseRate: rate.rate > 0 ? 1 / rate.rate : 0,
          date: rate.date,
        },
        {
          headers: {
            "Cache-Control": "s-maxage=1800, stale-while-revalidate=1800",
          },
        },
      );
    } catch {
      return NextResponse.json(
        {
          ok: false,
          source: "unavailable",
          from,
          to,
          message: "Could not fetch exchange rate at this time.",
        },
        { status: 502 },
      );
    }
  }
}
