import { NextRequest, NextResponse } from "next/server";

const MAX_TEXT_CHARACTERS = 20_000;
const MAX_VARIATIONS = 6;
const OPENAI_TIMEOUT_MS = 18_000;

type HumanizerStyle = "balanced" | "conversational" | "professional" | "concise" | "storytelling";
type HumanizerTone = "natural" | "formal" | "casual" | "seo";
type HumanizerLengthMode = "same" | "shorter" | "longer";

interface HumanizeRequestPayload {
  text?: unknown;
  style?: unknown;
  tone?: unknown;
  strength?: unknown;
  variations?: unknown;
  lengthMode?: unknown;
  keywordLocks?: unknown;
  preserveKeywords?: unknown;
}

interface HumanizeCandidate {
  text: string;
  explanation?: string;
  source: "api" | "rule-based";
}

interface OpenAiChoice {
  message?: {
    content?: string | null;
  };
}

interface OpenAiResponsePayload {
  choices?: OpenAiChoice[];
}

const STYLE_VALUES = new Set<HumanizerStyle>([
  "balanced",
  "conversational",
  "professional",
  "concise",
  "storytelling",
]);
const TONE_VALUES = new Set<HumanizerTone>(["natural", "formal", "casual", "seo"]);
const LENGTH_MODE_VALUES = new Set<HumanizerLengthMode>(["same", "shorter", "longer"]);

const CONTRACTIONS: Array<{ from: RegExp; to: string }> = [
  { from: /\bdo not\b/gi, to: "don't" },
  { from: /\bdoes not\b/gi, to: "doesn't" },
  { from: /\bcannot\b/gi, to: "can't" },
  { from: /\bit is\b/gi, to: "it's" },
  { from: /\bthat is\b/gi, to: "that's" },
  { from: /\bthere is\b/gi, to: "there's" },
  { from: /\bwe are\b/gi, to: "we're" },
  { from: /\bthey are\b/gi, to: "they're" },
  { from: /\byou are\b/gi, to: "you're" },
  { from: /\bi am\b/gi, to: "I'm" },
  { from: /\bwill not\b/gi, to: "won't" },
];

const EXPANSIONS: Array<{ from: RegExp; to: string }> = [
  { from: /\bdon't\b/gi, to: "do not" },
  { from: /\bdoesn't\b/gi, to: "does not" },
  { from: /\bcan't\b/gi, to: "cannot" },
  { from: /\bit's\b/gi, to: "it is" },
  { from: /\bthat's\b/gi, to: "that is" },
  { from: /\bthere's\b/gi, to: "there is" },
  { from: /\bwe're\b/gi, to: "we are" },
  { from: /\bthey're\b/gi, to: "they are" },
  { from: /\byou're\b/gi, to: "you are" },
  { from: /\bi'm\b/gi, to: "I am" },
  { from: /\bwon't\b/gi, to: "will not" },
];

const TRANSITION_RULES: Array<{ from: RegExp; to: string }> = [
  { from: /^(however|nevertheless|nonetheless)\b[:,]?\s*/i, to: "" },
  { from: /^(moreover|furthermore|additionally)\b[:,]?\s*/i, to: "Also, " },
  { from: /^(therefore|thus)\b[:,]?\s*/i, to: "So, " },
  { from: /^(in conclusion|in summary)\b[:,]?\s*/i, to: "To wrap up, " },
  { from: /^(overall|finally|notably)\b[:,]?\s*/i, to: "" },
];

const CONCISE_RULES: Array<{ from: RegExp; to: string }> = [
  { from: /\bin order to\b/gi, to: "to" },
  { from: /\bit is important to note that\b/gi, to: "" },
  { from: /\bit should be noted that\b/gi, to: "" },
  { from: /\bat this point in time\b/gi, to: "now" },
  { from: /\bdue to the fact that\b/gi, to: "because" },
  { from: /\ba large number of\b/gi, to: "many" },
  { from: /\bfor the purpose of\b/gi, to: "for" },
  { from: /\bin the event that\b/gi, to: "if" },
];

function normalizeText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function parseKeywordLocks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(trimmed.slice(0, 80));
    if (output.length >= 50) break;
  }
  return output;
}

function splitSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function preserveMatchCase(original: string, replacement: string): string {
  if (!original) return replacement;
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0].toUpperCase()) return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  return replacement;
}

function applyRules(text: string, rules: Array<{ from: RegExp; to: string }>): { text: string; changes: number } {
  let next = text;
  let changes = 0;
  for (const rule of rules) {
    next = next.replace(rule.from, (match) => {
      changes += 1;
      return preserveMatchCase(match, rule.to);
    });
  }
  return { text: next, changes };
}

function applyTransitionNormalization(text: string): string {
  const sentences = splitSentences(text);
  if (!sentences.length) return text;
  const rewritten = sentences.map((sentence) => {
    let next = sentence;
    for (const rule of TRANSITION_RULES) {
      if (rule.from.test(next)) {
        next = next.replace(rule.from, rule.to);
        break;
      }
    }
    return next.trim();
  });
  return normalizeText(rewritten.join(" "));
}

function applyLengthMode(text: string, lengthMode: HumanizerLengthMode): string {
  if (lengthMode === "same") return text;
  if (lengthMode === "shorter") {
    return normalizeText(
      text
        .replace(/\b(really|very|quite|basically|actually|just)\b/gi, "")
        .replace(/\s{2,}/g, " "),
    );
  }

  const sentences = splitSentences(text);
  if (!sentences.length) return text;
  const fillers = [
    "This provides clearer context for readers.",
    "That makes the point easier to apply in practice.",
    "It also clarifies why the recommendation matters.",
  ];
  const expanded: string[] = [];
  sentences.forEach((sentence, index) => {
    expanded.push(sentence);
    const words = sentence.split(/\s+/).filter(Boolean).length;
    if (index % 2 === 0 && words < 16) expanded.push(fillers[index % fillers.length]);
  });
  return normalizeText(expanded.join(" "));
}

function tokenize(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function jaccardPercent(left: string, right: string): number {
  const leftSet = new Set(tokenize(left));
  const rightSet = new Set(tokenize(right));
  if (!leftSet.size && !rightSet.size) return 100;
  let overlap = 0;
  leftSet.forEach((token) => {
    if (rightSet.has(token)) overlap += 1;
  });
  const union = leftSet.size + rightSet.size - overlap;
  if (!union) return 100;
  return Number(((overlap / union) * 100).toFixed(1));
}

function criticalRetentionPercent(source: string, rewritten: string): number {
  const pattern = /https?:\/\/[^\s)]+|[\w.+-]+@[\w.-]+\.\w+|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b\d+(?:[.,]\d+)?%?\b/g;
  const tokens = source.match(pattern) ?? [];
  if (!tokens.length) return 100;
  let retained = 0;
  for (const token of tokens) {
    if (rewritten.includes(token)) retained += 1;
  }
  return Number(((retained / tokens.length) * 100).toFixed(1));
}

function meaningScorePercent(source: string, rewritten: string): number {
  const similarity = jaccardPercent(source, rewritten);
  const critical = criticalRetentionPercent(source, rewritten);
  const sourceWords = Math.max(1, tokenize(source).length);
  const rewrittenWords = Math.max(1, tokenize(rewritten).length);
  const ratio = Math.min(sourceWords, rewrittenWords) / Math.max(sourceWords, rewrittenWords);
  const lengthScore = Number((ratio * 100).toFixed(1));
  return Number((similarity * 0.5 + critical * 0.35 + lengthScore * 0.15).toFixed(1));
}

function parsePayload(payload: HumanizeRequestPayload) {
  const text = typeof payload.text === "string" ? normalizeText(payload.text) : "";
  const style = STYLE_VALUES.has(payload.style as HumanizerStyle) ? (payload.style as HumanizerStyle) : "balanced";
  const tone = TONE_VALUES.has(payload.tone as HumanizerTone) ? (payload.tone as HumanizerTone) : "natural";
  const lengthMode = LENGTH_MODE_VALUES.has(payload.lengthMode as HumanizerLengthMode)
    ? (payload.lengthMode as HumanizerLengthMode)
    : "same";
  const strengthRaw = typeof payload.strength === "number" ? payload.strength : Number(payload.strength);
  const strength = Number.isFinite(strengthRaw) ? Math.max(1, Math.min(3, Math.round(strengthRaw))) : 2;
  const variationsRaw = typeof payload.variations === "number" ? payload.variations : Number(payload.variations);
  const variations = Number.isFinite(variationsRaw)
    ? Math.max(1, Math.min(MAX_VARIATIONS, Math.round(variationsRaw)))
    : 3;
  const keywordLocks = parseKeywordLocks(payload.keywordLocks);
  const preserveKeywords = payload.preserveKeywords !== false;

  return {
    text,
    style,
    tone,
    strength,
    variations,
    lengthMode,
    keywordLocks,
    preserveKeywords,
  };
}

function applyKeywordLocks(text: string, keywordLocks: string[]): { text: string; map: Array<{ token: string; value: string }> } {
  const map: Array<{ token: string; value: string }> = [];
  let next = text;
  let index = 0;

  keywordLocks
    .sort((left, right) => right.length - left.length)
    .forEach((term) => {
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
      next = next.replace(pattern, (match) => {
        const token = `__UTILIORA_LOCK_${index}__`;
        map.push({ token, value: match });
        index += 1;
        return token;
      });
    });

  return { text: next, map };
}

function restoreKeywordLocks(text: string, map: Array<{ token: string; value: string }>): string {
  let next = text;
  map.forEach((entry) => {
    next = next.replaceAll(entry.token, entry.value);
  });
  return next;
}

function toneRulesFor(style: HumanizerStyle, tone: HumanizerTone, seed: number): Array<{ from: RegExp; to: string }> {
  const rules: Array<{ from: RegExp; to: string }> = [];
  if (style === "concise") rules.push(...CONCISE_RULES);

  if (tone === "casual" || style === "conversational") {
    rules.push(...CONTRACTIONS);
  } else if (tone === "formal" || style === "professional") {
    rules.push(...EXPANSIONS);
  }

  if (tone === "seo") {
    const seoTermRules: Array<{ from: RegExp; to: string }> = [
      { from: /\bimportant\b/gi, to: seed % 2 === 0 ? "key" : "critical" },
      { from: /\bimprove\b/gi, to: seed % 2 === 0 ? "optimize" : "strengthen" },
      { from: /\bshows\b/gi, to: seed % 2 === 0 ? "demonstrates" : "highlights" },
    ];
    rules.push(...seoTermRules);
  }

  return rules;
}

function buildRuleBasedCandidate(
  source: string,
  style: HumanizerStyle,
  tone: HumanizerTone,
  strength: number,
  lengthMode: HumanizerLengthMode,
  keywordLocks: string[],
  preserveKeywords: boolean,
  seed: number,
): HumanizeCandidate {
  const lockPayload = preserveKeywords ? applyKeywordLocks(source, keywordLocks) : { text: source, map: [] as Array<{ token: string; value: string }> };
  let working = lockPayload.text;

  if (strength >= 1) {
    const toneRules = toneRulesFor(style, tone, seed);
    const rewritten = applyRules(working, toneRules);
    working = rewritten.text;
  }
  if (strength >= 2) {
    working = applyTransitionNormalization(working);
  }
  if (strength >= 3) {
    const concise = applyRules(working, CONCISE_RULES);
    working = concise.text;
  }

  if (style === "storytelling") {
    const sentences = splitSentences(working);
    const hooks = ["In practice,", "Here's the key point:", "Now, this matters because"];
    if (sentences.length && !/^(in practice|here's the key point|now, this matters because)/i.test(sentences[0])) {
      sentences[0] = `${hooks[seed % hooks.length]} ${sentences[0]}`;
    }
    working = normalizeText(sentences.join(" "));
  }

  working = applyLengthMode(working, lengthMode);
  if (preserveKeywords && lockPayload.map.length) {
    working = restoreKeywordLocks(working, lockPayload.map);
  }

  return {
    text: normalizeText(working),
    explanation: "Generated by local deterministic rewrite pipeline.",
    source: "rule-based",
  };
}

function dedupeCandidates(candidates: HumanizeCandidate[]): HumanizeCandidate[] {
  const seen = new Set<string>();
  const output: HumanizeCandidate[] = [];
  for (const candidate of candidates) {
    const normalized = normalizeText(candidate.text);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push({ ...candidate, text: normalized });
  }
  return output;
}

function rankCandidates(source: string, candidates: HumanizeCandidate[]): HumanizeCandidate[] {
  return [...candidates].sort((left, right) => {
    const leftMeaning = meaningScorePercent(source, left.text);
    const rightMeaning = meaningScorePercent(source, right.text);
    if (leftMeaning !== rightMeaning) return rightMeaning - leftMeaning;

    const leftSimilarity = jaccardPercent(source, left.text);
    const rightSimilarity = jaccardPercent(source, right.text);
    return leftSimilarity - rightSimilarity;
  });
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "AbortError";
}

async function fetchOpenAiCandidates(input: {
  text: string;
  style: HumanizerStyle;
  tone: HumanizerTone;
  strength: number;
  lengthMode: HumanizerLengthMode;
  keywordLocks: string[];
  preserveKeywords: boolean;
  variations: number;
}): Promise<HumanizeCandidate[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  const model = process.env.AI_HUMANIZER_MODEL?.trim() || "gpt-4.1-mini";

  const keywordLockLine = input.keywordLocks.length
    ? `Keyword locks to preserve exactly: ${input.keywordLocks.join(", ")}`
    : "No keyword locks.";
  const preserveLine = input.preserveKeywords ? "Keyword locks are strict and must remain exact." : "Keyword locks are optional.";

  const prompt = [
    "Rewrite the text into natural, human-like writing while preserving meaning.",
    `Style: ${input.style}`,
    `Tone: ${input.tone}`,
    `Strength: ${input.strength}`,
    `Length mode: ${input.lengthMode}`,
    keywordLockLine,
    preserveLine,
    `Return exactly ${input.variations} alternatives as JSON.`,
    'Output format: {"candidates":[{"text":"...","explanation":"..."}]}',
    "Do not add markdown fences.",
    "",
    "Text:",
    input.text,
  ].join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.75,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an expert editor. Rewrite text to sound natural, preserve facts and numbers, and keep intent unchanged.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as OpenAiResponsePayload;
    const content = payload.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return [];

    let parsed: { candidates?: Array<{ text?: string; explanation?: string }> };
    try {
      parsed = JSON.parse(content) as { candidates?: Array<{ text?: string; explanation?: string }> };
    } catch {
      return [];
    }

    if (!Array.isArray(parsed.candidates)) return [];
    return parsed.candidates
      .map((entry) => ({
        text: normalizeText(typeof entry.text === "string" ? entry.text : ""),
        explanation: typeof entry.explanation === "string" ? entry.explanation.trim() : undefined,
        source: "api" as const,
      }))
      .filter((entry) => Boolean(entry.text));
  } catch (error) {
    if (isAbortError(error)) return [];
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: NextRequest) {
  let payload: HumanizeRequestPayload;
  try {
    payload = (await request.json()) as HumanizeRequestPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON payload." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const parsed = parsePayload(payload);
  if (!parsed.text) {
    return NextResponse.json(
      { ok: false, error: "Enter text to humanize." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (parsed.text.length > MAX_TEXT_CHARACTERS) {
    return NextResponse.json(
      {
        ok: false,
        error: `Text is too large. Keep it under ${MAX_TEXT_CHARACTERS.toLocaleString("en-US")} characters.`,
      },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }

  const ruleBasedCandidates: HumanizeCandidate[] = [];
  for (let index = 0; index < parsed.variations; index += 1) {
    ruleBasedCandidates.push(
      buildRuleBasedCandidate(
        parsed.text,
        parsed.style,
        parsed.tone,
        parsed.strength,
        parsed.lengthMode,
        parsed.keywordLocks,
        parsed.preserveKeywords,
        index + 1,
      ),
    );
  }

  const apiCandidates = await fetchOpenAiCandidates(parsed);
  const merged = dedupeCandidates([...apiCandidates, ...ruleBasedCandidates]);
  const ranked = rankCandidates(parsed.text, merged).slice(0, parsed.variations);

  return NextResponse.json(
    {
      ok: true,
      provider: apiCandidates.length ? "hybrid" : "rule-based",
      candidates: ranked.map((entry) => ({
        text: entry.text,
        explanation: entry.explanation,
        source: entry.source,
        meaningScore: meaningScorePercent(parsed.text, entry.text),
        similarity: jaccardPercent(parsed.text, entry.text),
        criticalRetention: criticalRetentionPercent(parsed.text, entry.text),
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
