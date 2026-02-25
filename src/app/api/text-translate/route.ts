import { NextRequest, NextResponse } from "next/server";
import {
  normalizeTranslationLanguageCode,
  resolveTranslationLanguage,
  splitTextForTranslation,
  TRANSLATION_AUTO_LANGUAGE_CODE,
} from "@/lib/translation";

const MAX_TEXT_CHARACTERS = 20_000;
const MAX_CHUNK_SIZE = 900;
const MAX_CHUNK_COUNT = 40;
const PROVIDER_TIMEOUT_MS = 12_000;

type TranslationProviderName = "google-gtx" | "mymemory" | "libretranslate";

interface TranslateRequestPayload {
  text?: unknown;
  sourceLanguage?: unknown;
  targetLanguage?: unknown;
}

interface ProviderContext {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  timeoutMs: number;
}

interface ProviderChunkResult {
  translatedText: string;
  detectedSourceLanguage?: string;
}

interface ProviderDefinition {
  name: TranslationProviderName;
  translateChunk: (context: ProviderContext) => Promise<ProviderChunkResult>;
}

interface TranslationSuccessPayload {
  translatedText: string;
  detectedSourceLanguage?: string;
}

interface GoogleChunkPayload extends Array<unknown> {
  0?: unknown;
  2?: unknown;
}

interface MyMemoryPayload {
  responseData?: {
    translatedText?: string;
  };
  responseStatus?: number;
  responseDetails?: string;
  matches?: Array<{
    translation?: string;
    quality?: string;
  }>;
}

interface LibreTranslatePayload {
  translatedText?: string;
  detectedLanguage?:
    | string
    | {
        language?: string;
      };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "AbortError";
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  return "Unknown provider failure.";
}

function extractBodyText(body: TranslateRequestPayload): string {
  if (typeof body.text !== "string") return "";
  return body.text.replace(/\r\n?/g, "\n");
}

async function fetchJsonWithTimeout<T>(url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Provider returned status ${response.status}.`);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Provider request timed out after ${timeoutMs} ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function translateChunkWithGoogle(context: ProviderContext): Promise<ProviderChunkResult> {
  const params = new URLSearchParams({
    client: "gtx",
    sl: context.sourceLanguage === TRANSLATION_AUTO_LANGUAGE_CODE ? "auto" : context.sourceLanguage,
    tl: context.targetLanguage,
    dt: "t",
    q: context.text,
  });

  const payload = await fetchJsonWithTimeout<GoogleChunkPayload>(
    `https://translate.googleapis.com/translate_a/single?${params.toString()}`,
    { method: "GET" },
    context.timeoutMs,
  );

  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    throw new Error("Unexpected Google response format.");
  }

  const translatedText = (payload[0] as unknown[])
    .map((entry) => (Array.isArray(entry) && typeof entry[0] === "string" ? entry[0] : ""))
    .join("");

  if (!translatedText.trim()) {
    throw new Error("Google returned an empty translation.");
  }

  return {
    translatedText,
    detectedSourceLanguage: typeof payload[2] === "string" ? payload[2] : undefined,
  };
}

async function translateChunkWithMyMemory(context: ProviderContext): Promise<ProviderChunkResult> {
  const source = context.sourceLanguage === TRANSLATION_AUTO_LANGUAGE_CODE ? "en" : context.sourceLanguage;
  const params = new URLSearchParams({
    q: context.text,
    langpair: `${source}|${context.targetLanguage}`,
  });

  const payload = await fetchJsonWithTimeout<MyMemoryPayload>(
    `https://api.mymemory.translated.net/get?${params.toString()}`,
    { method: "GET" },
    context.timeoutMs,
  );

  if (payload.responseStatus && payload.responseStatus >= 400) {
    throw new Error(payload.responseDetails || `MyMemory rejected request with ${payload.responseStatus}.`);
  }

  let translatedText = typeof payload.responseData?.translatedText === "string" ? payload.responseData.translatedText : "";
  if (!translatedText.trim() && Array.isArray(payload.matches)) {
    const fallback = payload.matches.find((entry) => typeof entry.translation === "string" && entry.translation.trim());
    translatedText = fallback?.translation ?? "";
  }

  translatedText = decodeHtmlEntities(translatedText);

  if (!translatedText.trim()) {
    throw new Error("MyMemory returned an empty translation.");
  }

  return {
    translatedText,
    detectedSourceLanguage: source,
  };
}

const LIBRE_TRANSLATE_ENDPOINTS = [
  "https://translate.argosopentech.com/translate",
  "https://translate.astian.org/translate",
  "https://libretranslate.de/translate",
];

async function translateChunkWithLibre(context: ProviderContext): Promise<ProviderChunkResult> {
  const body = JSON.stringify({
    q: context.text,
    source: context.sourceLanguage === TRANSLATION_AUTO_LANGUAGE_CODE ? "auto" : context.sourceLanguage,
    target: context.targetLanguage,
    format: "text",
    alternatives: 0,
  });

  const errors: string[] = [];

  for (const endpoint of LIBRE_TRANSLATE_ENDPOINTS) {
    try {
      const payload = await fetchJsonWithTimeout<LibreTranslatePayload>(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body,
        },
        context.timeoutMs,
      );

      if (typeof payload.translatedText !== "string" || !payload.translatedText.trim()) {
        throw new Error("LibreTranslate returned an empty translation.");
      }

      const detectedSourceLanguage =
        typeof payload.detectedLanguage === "string"
          ? payload.detectedLanguage
          : typeof payload.detectedLanguage?.language === "string"
            ? payload.detectedLanguage.language
            : undefined;

      return {
        translatedText: payload.translatedText,
        detectedSourceLanguage,
      };
    } catch (error) {
      errors.push(`${endpoint}: ${errorToMessage(error)}`);
    }
  }

  throw new Error(errors.join(" | "));
}

function buildProviderPipeline(sourceLanguage: string): ProviderDefinition[] {
  const providers: ProviderDefinition[] = [
    { name: "google-gtx", translateChunk: translateChunkWithGoogle },
  ];

  if (sourceLanguage !== TRANSLATION_AUTO_LANGUAGE_CODE) {
    providers.push({ name: "mymemory", translateChunk: translateChunkWithMyMemory });
  }

  providers.push({ name: "libretranslate", translateChunk: translateChunkWithLibre });
  return providers;
}

async function translateWithProvider(
  provider: ProviderDefinition,
  chunks: string[],
  sourceLanguage: string,
  targetLanguage: string,
): Promise<TranslationSuccessPayload> {
  const translatedChunks: string[] = [];
  let detectedSourceLanguage: string | undefined;

  for (const chunk of chunks) {
    const leading = chunk.match(/^\s+/)?.[0] ?? "";
    const trailing = chunk.match(/\s+$/)?.[0] ?? "";
    const core = chunk.trim();

    if (!core) {
      translatedChunks.push(chunk);
      continue;
    }

    const translated = await provider.translateChunk({
      text: core,
      sourceLanguage,
      targetLanguage,
      timeoutMs: PROVIDER_TIMEOUT_MS,
    });

    if (!translated.translatedText.trim()) {
      throw new Error("Provider returned blank translated text.");
    }

    translatedChunks.push(`${leading}${translated.translatedText.trim()}${trailing}`);

    if (!detectedSourceLanguage) {
      const normalized = normalizeTranslationLanguageCode(translated.detectedSourceLanguage);
      if (normalized && normalized !== TRANSLATION_AUTO_LANGUAGE_CODE) {
        detectedSourceLanguage = normalized;
      }
    }
  }

  return {
    translatedText: translatedChunks.join(""),
    detectedSourceLanguage,
  };
}

export async function POST(request: NextRequest) {
  let payload: TranslateRequestPayload;
  try {
    payload = (await request.json()) as TranslateRequestPayload;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON payload.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rawText = extractBodyText(payload);
  if (!rawText.trim()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Enter text to translate.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (rawText.length > MAX_TEXT_CHARACTERS) {
    return NextResponse.json(
      {
        ok: false,
        error: `Text is too large. Keep it under ${MAX_TEXT_CHARACTERS.toLocaleString("en-US")} characters.`,
      },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }

  const sourceLanguage = resolveTranslationLanguage(
    typeof payload.sourceLanguage === "string" ? payload.sourceLanguage : null,
    TRANSLATION_AUTO_LANGUAGE_CODE,
    { allowAuto: true },
  );

  const targetLanguage = resolveTranslationLanguage(
    typeof payload.targetLanguage === "string" ? payload.targetLanguage : null,
    "en",
    { allowAuto: false },
  );

  if (sourceLanguage !== TRANSLATION_AUTO_LANGUAGE_CODE && sourceLanguage === targetLanguage) {
    return NextResponse.json(
      {
        ok: true,
        provider: "identity",
        sourceLanguage,
        detectedSourceLanguage: sourceLanguage,
        targetLanguage,
        translatedText: rawText,
        chunks: 1,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const chunks = splitTextForTranslation(rawText, MAX_CHUNK_SIZE);
  if (!chunks.length) {
    return NextResponse.json(
      {
        ok: false,
        error: "Text is empty after normalization.",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (chunks.length > MAX_CHUNK_COUNT) {
    return NextResponse.json(
      {
        ok: false,
        error: "Text has too many segments for one request. Try fewer paragraphs at once.",
      },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }

  const providers = buildProviderPipeline(sourceLanguage);
  const providerErrors: string[] = [];

  for (const provider of providers) {
    try {
      const result = await translateWithProvider(provider, chunks, sourceLanguage, targetLanguage);
      return NextResponse.json(
        {
          ok: true,
          provider: provider.name,
          sourceLanguage,
          detectedSourceLanguage: result.detectedSourceLanguage ?? (sourceLanguage === "auto" ? undefined : sourceLanguage),
          targetLanguage,
          translatedText: result.translatedText,
          chunks: chunks.length,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      providerErrors.push(`${provider.name}: ${errorToMessage(error)}`);
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: "All translation providers failed for this request.",
      details: providerErrors,
    },
    { status: 502, headers: { "Cache-Control": "no-store" } },
  );
}
