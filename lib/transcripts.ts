import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

const TRANSCRIPTS_DIR = join(process.cwd(), "transcripts");

export type TranscriptInfo = {
  id: string;
  fileName: string;
  localPath: string;
  title: string;
  sourceUrl: string | null;
  campaign: string | null;
  episodeNumber: number | null;
  code: string | null;
  lineCount: number;
  sizeBytes: number;
};

export type ParsedTranscriptLine = {
  id: string;
  timestamp: string;
  startSeconds: number;
  speakerLabel: string;
  text: string;
  lineNumber: number;
};

export type ParsedTranscript = TranscriptInfo & {
  rawMarkdown: string;
  transcriptText: string;
  lines: ParsedTranscriptLine[];
};

const transcriptLinePattern =
  /^\*\*\[(?<timestamp>\d{2}:\d{2}:\d{2})\]\s+(?<speaker>[^:]+):\*\*\s*(?<text>.*)$/;

export async function listTranscriptFiles(): Promise<TranscriptInfo[]> {
  const entries = await readdir(TRANSCRIPTS_DIR);
  const markdownFiles = entries
    .filter((entry) => entry.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return Promise.all(markdownFiles.map((fileName) => getTranscriptInfo(fileName)));
}

export async function parseTranscriptById(id: string): Promise<ParsedTranscript> {
  const files = await listTranscriptFiles();
  const info = files.find((file) => file.id === id);

  if (!info) {
    throw new Error(`Transcript not found: ${id}`);
  }

  const rawMarkdown = await readFile(info.localPath, "utf8");
  const markdownLines = rawMarkdown.split(/\r?\n/);
  const lines: ParsedTranscriptLine[] = [];

  markdownLines.forEach((line, index) => {
    const match = line.match(transcriptLinePattern);

    if (!match?.groups) {
      return;
    }

    lines.push({
      id: `${info.id}-line-${String(lines.length + 1).padStart(5, "0")}`,
      timestamp: match.groups.timestamp,
      startSeconds: timestampToSeconds(match.groups.timestamp),
      speakerLabel: match.groups.speaker.trim(),
      text: match.groups.text.trim(),
      lineNumber: index + 1,
    });
  });

  return {
    ...info,
    rawMarkdown,
    transcriptText: lines
      .map((line) => `[${line.timestamp}] ${line.speakerLabel}: ${line.text}`)
      .join("\n"),
    lines,
  };
}

async function getTranscriptInfo(fileName: string): Promise<TranscriptInfo> {
  const localPath = join(TRANSCRIPTS_DIR, fileName);
  const [rawMarkdown, fileStat] = await Promise.all([
    readFile(localPath, "utf8"),
    stat(localPath),
  ]);
  const markdownLines = rawMarkdown.split(/\r?\n/);
  const title = markdownLines.find((line) => line.startsWith("# "))?.slice(2).trim();
  const sourceUrl =
    markdownLines
      .find((line) => line.startsWith("- Source:"))
      ?.replace("- Source:", "")
      .trim() || null;
  const episodeText =
    markdownLines
      .find((line) => line.startsWith("- Episode:"))
      ?.replace("- Episode:", "")
      .trim() || null;
  const code = basename(fileName, ".md").split(" ")[0] || null;
  const episodeNumberMatch = episodeText?.match(/Episode\s+(\d+)/i);
  const campaignMatch = episodeText?.match(/Campaign\s+(\d+)/i);
  const id = code ? `c${campaignMatch?.[1] ?? "1"}e${code.split("x")[1]?.padStart(3, "0")}` : slugify(fileName);
  const lineCount = markdownLines.filter((line) => transcriptLinePattern.test(line)).length;

  return {
    id,
    fileName,
    localPath,
    title: title || basename(fileName, ".md"),
    sourceUrl,
    campaign: campaignMatch ? `Campaign ${campaignMatch[1]}` : null,
    episodeNumber: episodeNumberMatch ? Number(episodeNumberMatch[1]) : null,
    code,
    lineCount,
    sizeBytes: fileStat.size,
  };
}

function timestampToSeconds(timestamp: string) {
  const [hours, minutes, seconds] = timestamp.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/\.md$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
