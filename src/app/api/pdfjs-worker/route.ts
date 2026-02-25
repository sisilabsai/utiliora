import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const pdfWorkerFilePath = path.join(
  process.cwd(),
  "node_modules",
  "pdfjs-dist",
  "legacy",
  "build",
  "pdf.worker.min.mjs",
);
let cachedWorkerScript: string | null = null;

async function loadPdfWorkerScript(): Promise<string> {
  if (cachedWorkerScript !== null) {
    return cachedWorkerScript;
  }
  cachedWorkerScript = await fs.readFile(pdfWorkerFilePath, "utf8");
  return cachedWorkerScript;
}

export async function GET() {
  try {
    const workerScript = await loadPdfWorkerScript();
    return new NextResponse(workerScript, {
      headers: {
        "Content-Type": "text/javascript; charset=utf-8",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Failed to load PDF worker script." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
