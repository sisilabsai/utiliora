export interface TranslationLanguageOption {
  code: string;
  label: string;
}

export const TRANSLATION_AUTO_LANGUAGE_CODE = "auto";

export const TRANSLATION_LANGUAGE_OPTIONS: TranslationLanguageOption[] = [
  { code: "af", label: "Afrikaans" },
  { code: "ar", label: "Arabic" },
  { code: "bg", label: "Bulgarian" },
  { code: "bn", label: "Bengali" },
  { code: "ca", label: "Catalan" },
  { code: "cs", label: "Czech" },
  { code: "da", label: "Danish" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "et", label: "Estonian" },
  { code: "fa", label: "Persian" },
  { code: "fi", label: "Finnish" },
  { code: "fr", label: "French" },
  { code: "gu", label: "Gujarati" },
  { code: "he", label: "Hebrew" },
  { code: "hi", label: "Hindi" },
  { code: "hr", label: "Croatian" },
  { code: "hu", label: "Hungarian" },
  { code: "id", label: "Indonesian" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "kn", label: "Kannada" },
  { code: "ko", label: "Korean" },
  { code: "lt", label: "Lithuanian" },
  { code: "lv", label: "Latvian" },
  { code: "ml", label: "Malayalam" },
  { code: "mr", label: "Marathi" },
  { code: "ms", label: "Malay" },
  { code: "nl", label: "Dutch" },
  { code: "no", label: "Norwegian" },
  { code: "pl", label: "Polish" },
  { code: "pt", label: "Portuguese" },
  { code: "pt-br", label: "Portuguese (Brazil)" },
  { code: "ro", label: "Romanian" },
  { code: "ru", label: "Russian" },
  { code: "sk", label: "Slovak" },
  { code: "sl", label: "Slovenian" },
  { code: "so", label: "Somali" },
  { code: "sq", label: "Albanian" },
  { code: "sr", label: "Serbian" },
  { code: "sv", label: "Swedish" },
  { code: "sw", label: "Swahili" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "th", label: "Thai" },
  { code: "tl", label: "Tagalog" },
  { code: "tr", label: "Turkish" },
  { code: "uk", label: "Ukrainian" },
  { code: "ur", label: "Urdu" },
  { code: "vi", label: "Vietnamese" },
  { code: "zh", label: "Chinese (Simplified)" },
  { code: "zh-tw", label: "Chinese (Traditional)" },
  { code: "zu", label: "Zulu" },
];

const LANGUAGE_ALIAS_MAP: Record<string, string> = {
  fil: "tl",
  iw: "he",
  nb: "no",
  "pt-pt": "pt",
  "zh-cn": "zh",
  "zh-hans": "zh",
  "zh-hant": "zh-tw",
  "zh-hk": "zh-tw",
};

const TRANSLATION_LANGUAGE_LABELS = new Map(
  TRANSLATION_LANGUAGE_OPTIONS.map((entry) => [entry.code, entry.label]),
);

const TRANSLATION_LANGUAGE_CODES = new Set(TRANSLATION_LANGUAGE_OPTIONS.map((entry) => entry.code));

const TRANSLATION_LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8})?$/;

export function normalizeTranslationLanguageCode(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase().replace(/_/g, "-");
  if (!trimmed) return null;
  const aliased = LANGUAGE_ALIAS_MAP[trimmed] ?? trimmed;
  if (!TRANSLATION_LANGUAGE_CODE_PATTERN.test(aliased)) return null;
  return aliased;
}

export function isSupportedTranslationLanguage(code: string): boolean {
  return TRANSLATION_LANGUAGE_CODES.has(code);
}

interface ResolveTranslationLanguageOptions {
  allowAuto: boolean;
  supportedOnly?: boolean;
}

export function resolveTranslationLanguage(
  value: string | null | undefined,
  fallback: string,
  options: ResolveTranslationLanguageOptions,
): string {
  const normalized = normalizeTranslationLanguageCode(value);
  if (!normalized) return fallback;
  if (options.allowAuto && normalized === TRANSLATION_AUTO_LANGUAGE_CODE) return TRANSLATION_AUTO_LANGUAGE_CODE;
  if (normalized === TRANSLATION_AUTO_LANGUAGE_CODE) return fallback;
  if (options.supportedOnly && !isSupportedTranslationLanguage(normalized)) return fallback;
  return normalized;
}

function splitOversizedSegment(segment: string, maxChunkLength: number): string[] {
  const chunks: string[] = [];
  let cursor = 0;

  while (cursor < segment.length) {
    let end = Math.min(segment.length, cursor + maxChunkLength);
    if (end < segment.length) {
      const minBreak = cursor + Math.floor(maxChunkLength * 0.55);
      let breakPoint = -1;
      for (let index = end; index > minBreak; index -= 1) {
        const token = segment[index];
        if (
          token === " " ||
          token === "\n" ||
          token === "\t" ||
          token === "." ||
          token === "," ||
          token === ";" ||
          token === ":" ||
          token === "!" ||
          token === "?"
        ) {
          breakPoint = index + 1;
          break;
        }
      }
      if (breakPoint > cursor + 24) {
        end = breakPoint;
      }
    }

    if (end <= cursor) {
      end = Math.min(segment.length, cursor + maxChunkLength);
    }

    chunks.push(segment.slice(cursor, end));
    cursor = end;
  }

  return chunks;
}

export function splitTextForTranslation(value: string, maxChunkLength = 900): string[] {
  const safeLimit = Math.max(120, Math.min(4000, Math.floor(maxChunkLength)));
  const normalized = value.replace(/\r\n?/g, "\n");
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (!current) return;
    chunks.push(current);
    current = "";
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const segment = index < lines.length - 1 ? `${line}\n` : line;

    if (segment.length <= safeLimit) {
      if (current && current.length + segment.length > safeLimit) {
        flush();
      }
      current += segment;
      continue;
    }

    flush();
    splitOversizedSegment(segment, safeLimit).forEach((part) => {
      chunks.push(part);
    });
  }

  flush();
  return chunks;
}

export function getTranslationLanguageLabel(code: string): string {
  if (code === TRANSLATION_AUTO_LANGUAGE_CODE) return "Auto detect";
  return TRANSLATION_LANGUAGE_LABELS.get(code) ?? code.toUpperCase();
}

export function buildTranslationPreview(value: string, maxLength = 120): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(24, maxLength - 1))}...`;
}
