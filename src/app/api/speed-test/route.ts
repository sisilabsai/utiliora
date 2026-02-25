import { NextResponse } from "next/server";

const DEFAULT_BYTES = 1_000_000;
const MIN_BYTES = 128_000;
const MAX_BYTES = 5_000_000;

function resolvePayloadBytes(input: string | null): number {
  const parsed = Number.parseInt(input ?? "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_BYTES;
  return Math.max(MIN_BYTES, Math.min(MAX_BYTES, parsed));
}

function buildPayload(sizeBytes: number, seed: string): string {
  const unit = `UTILIORA_SPEED_TEST_${seed}_`;
  const repeatCount = Math.ceil(sizeBytes / unit.length);
  return unit.repeat(repeatCount).slice(0, sizeBytes);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const bytes = resolvePayloadBytes(searchParams.get("bytes"));
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const body = buildPayload(bytes, token);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      pragma: "no-cache",
      expires: "0",
      "x-utiliora-speed-bytes": String(bytes),
      "x-utiliora-speed-token": token,
    },
  });
}
