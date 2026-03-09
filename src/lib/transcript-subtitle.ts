export interface SubtitleCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speaker: string;
}

export interface SpeakerSegment {
  speaker: string;
  lines: string[];
  wordCount: number;
}

export interface SubtitleGenerationOptions {
  mediaDurationSeconds?: number;
  targetCharsPerCue?: number;
  minCueSeconds?: number;
  maxCueSeconds?: number;
}

const SPEAKER_PATTERN = /^([A-Za-z][\w .'-]{0,30}|Speaker\s+\d+|Host|Moderator|Interviewer|Guest)\s*:\s*(.+)$/i;

function normalizeText(value: string): string {
  return value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim();
}

export function formatSubtitleTimestamp(ms: number, format: "srt" | "vtt"): string {
  const safeMs = Math.max(0, Math.round(ms));
  const hours = Math.floor(safeMs / 3_600_000);
  const minutes = Math.floor((safeMs % 3_600_000) / 60_000);
  const seconds = Math.floor((safeMs % 60_000) / 1000);
  const milliseconds = safeMs % 1000;
  const separator = format === "srt" ? "," : ".";
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}${separator}${milliseconds.toString().padStart(3, "0")}`;
}

export function parseTranscriptSpeakers(transcript: string): SpeakerSegment[] {
  const normalized = normalizeText(transcript);
  if (!normalized) return [];
  const lines = normalized.split("\n").map((line) => line.trim()).filter(Boolean);
  const segments: SpeakerSegment[] = [];

  lines.forEach((line) => {
    const match = line.match(SPEAKER_PATTERN);
    const speaker = match?.[1]?.trim() || "Speaker";
    const text = match?.[2]?.trim() || line;
    const existing = segments.find((entry) => entry.speaker.toLowerCase() === speaker.toLowerCase());
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (existing) {
      existing.lines.push(text);
      existing.wordCount += wordCount;
      return;
    }
    segments.push({
      speaker,
      lines: [text],
      wordCount,
    });
  });

  return segments.sort((left, right) => right.wordCount - left.wordCount);
}

function splitSentenceBlocks(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return normalized
    .replace(/\n+/g, " \n ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function extractSpeakerAndText(segment: string): { speaker: string; text: string } {
  const match = segment.match(SPEAKER_PATTERN);
  if (!match) {
    return { speaker: "Speaker", text: segment.trim() };
  }
  return {
    speaker: match[1].trim(),
    text: match[2].trim(),
  };
}

export function generateSubtitleCues(transcript: string, options: SubtitleGenerationOptions = {}): SubtitleCue[] {
  const blocks = splitSentenceBlocks(transcript);
  if (!blocks.length) return [];

  const targetChars = Math.max(28, Math.min(160, Math.round(options.targetCharsPerCue ?? 84)));
  const minCueSeconds = Math.max(1.2, Math.min(10, options.minCueSeconds ?? 2));
  const maxCueSeconds = Math.max(minCueSeconds, Math.min(14, options.maxCueSeconds ?? 6));

  const grouped: Array<{ speaker: string; text: string }> = [];
  let currentSpeaker = "Speaker";
  let currentText = "";

  blocks.forEach((block) => {
    const parsed = extractSpeakerAndText(block);
    const nextChunk = parsed.text;
    if (!currentText) {
      currentSpeaker = parsed.speaker;
      currentText = nextChunk;
      return;
    }

    const sameSpeaker = parsed.speaker === currentSpeaker;
    if (sameSpeaker && `${currentText} ${nextChunk}`.length <= targetChars) {
      currentText = `${currentText} ${nextChunk}`.trim();
      return;
    }

    grouped.push({ speaker: currentSpeaker, text: currentText.trim() });
    currentSpeaker = parsed.speaker;
    currentText = nextChunk;
  });

  if (currentText) {
    grouped.push({ speaker: currentSpeaker, text: currentText.trim() });
  }

  const totalWords = grouped.reduce((sum, block) => sum + block.text.split(/\s+/).filter(Boolean).length, 0);
  const fallbackDurationSeconds = grouped.reduce((sum, block) => {
    const words = block.text.split(/\s+/).filter(Boolean).length;
    return sum + Math.min(maxCueSeconds, Math.max(minCueSeconds, words / 2.8));
  }, 0);
  const totalDurationSeconds = Math.max(fallbackDurationSeconds, options.mediaDurationSeconds ?? fallbackDurationSeconds);
  let currentStartMs = 0;

  return grouped.map((block, index) => {
    const words = block.text.split(/\s+/).filter(Boolean).length;
    const proportionalDuration =
      totalWords > 0 ? (words / totalWords) * totalDurationSeconds : Math.max(minCueSeconds, block.text.length / targetChars);
    const cueDurationSeconds = Math.min(maxCueSeconds, Math.max(minCueSeconds, proportionalDuration));
    const startMs = currentStartMs;
    const endMs =
      index === grouped.length - 1
        ? Math.max(startMs + Math.round(cueDurationSeconds * 1000), Math.round(totalDurationSeconds * 1000))
        : startMs + Math.round(cueDurationSeconds * 1000);
    currentStartMs = endMs;
    return {
      id: `cue-${index + 1}`,
      startMs,
      endMs,
      text: block.text,
      speaker: block.speaker,
    };
  });
}

export function exportSrt(cues: SubtitleCue[]): string {
  return cues
    .map((cue, index) => {
      const body = cue.speaker && cue.speaker !== "Speaker" ? `${cue.speaker}: ${cue.text}` : cue.text;
      return `${index + 1}\n${formatSubtitleTimestamp(cue.startMs, "srt")} --> ${formatSubtitleTimestamp(cue.endMs, "srt")}\n${body}`;
    })
    .join("\n\n")
    .trim();
}

export function exportVtt(cues: SubtitleCue[]): string {
  const body = cues
    .map((cue) => {
      const line = cue.speaker && cue.speaker !== "Speaker" ? `${cue.speaker}: ${cue.text}` : cue.text;
      return `${formatSubtitleTimestamp(cue.startMs, "vtt")} --> ${formatSubtitleTimestamp(cue.endMs, "vtt")}\n${line}`;
    })
    .join("\n\n")
    .trim();
  return `WEBVTT\n\n${body}`;
}

function parseTimestampToMs(value: string): number {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":");
  if (parts.length !== 3) return 0;
  const [hours, minutes, secondsPart] = parts;
  const [seconds, milliseconds = "0"] = secondsPart.split(".");
  return (
    Number.parseInt(hours, 10) * 3_600_000 +
    Number.parseInt(minutes, 10) * 60_000 +
    Number.parseInt(seconds, 10) * 1000 +
    Number.parseInt(milliseconds.padEnd(3, "0").slice(0, 3), 10)
  );
}

export function parseSubtitleFile(raw: string): SubtitleCue[] {
  const normalized = normalizeText(raw).replace(/^WEBVTT\s*/i, "").trim();
  if (!normalized) return [];
  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const cues: SubtitleCue[] = [];

  blocks.forEach((block, index) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const timeLineIndex = lines.findIndex((line) => line.includes("-->"));
    if (timeLineIndex < 0) return;
    const [startRaw, endRaw] = lines[timeLineIndex].split("-->").map((line) => line.trim());
    const textLines = lines.slice(timeLineIndex + 1);
    if (!startRaw || !endRaw || !textLines.length) return;
    const body = textLines.join(" ").trim();
    const speakerMatch = body.match(SPEAKER_PATTERN);
    cues.push({
      id: `cue-${index + 1}`,
      startMs: parseTimestampToMs(startRaw),
      endMs: parseTimestampToMs(endRaw),
      text: speakerMatch?.[2]?.trim() || body,
      speaker: speakerMatch?.[1]?.trim() || "Speaker",
    });
  });

  return cues;
}

export function cuesToTranscript(cues: SubtitleCue[]): string {
  return cues
    .map((cue) => {
      const prefix = cue.speaker && cue.speaker !== "Speaker" ? `${cue.speaker}: ` : "";
      return `${prefix}${cue.text}`;
    })
    .join("\n");
}

export function buildSpeakerNotes(cues: SubtitleCue[]): SpeakerSegment[] {
  const grouped = new Map<string, SpeakerSegment>();
  cues.forEach((cue) => {
    const speaker = cue.speaker || "Speaker";
    const line = cue.text.trim();
    if (!line) return;
    const wordCount = line.split(/\s+/).filter(Boolean).length;
    const current = grouped.get(speaker);
    if (current) {
      current.lines.push(line);
      current.wordCount += wordCount;
      return;
    }
    grouped.set(speaker, {
      speaker,
      lines: [line],
      wordCount,
    });
  });
  return [...grouped.values()].sort((left, right) => right.wordCount - left.wordCount);
}

export function buildMeetingMinutes(cues: SubtitleCue[]): string {
  const notes = buildSpeakerNotes(cues);
  if (!notes.length) return "";

  const highlights = cues
    .map((cue) => cue.text.trim())
    .filter((line) => /\b(decide|decision|next|action|follow up|deadline|ship|launch|owner|due)\b/i.test(line))
    .slice(0, 8);

  const summaryLines = notes.slice(0, 5).map((speaker) => {
    const preview = speaker.lines.slice(0, 2).join(" ").trim();
    return `${speaker.speaker}: ${preview}`;
  });

  return [
    "Meeting minutes",
    "",
    "Speaker highlights",
    ...summaryLines.map((line) => `- ${line}`),
    "",
    "Action-oriented lines",
    ...(highlights.length ? highlights.map((line) => `- ${line}`) : ["- No explicit action lines were detected."]),
  ].join("\n");
}
