import { NextResponse } from "next/server";
import { z } from "zod";
import { createTranscriptGraphDraft } from "@/lib/transcript-graph-agent";
import { parseTranscriptById } from "@/lib/transcripts";

const requestSchema = z.object({
  transcriptId: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transcript extraction payload." }, { status: 400 });
  }

  try {
    const transcript = await parseTranscriptById(parsed.data.transcriptId);
    const extraction = await createTranscriptGraphDraft(transcript);

    return NextResponse.json({
      transcript: {
        id: transcript.id,
        fileName: transcript.fileName,
        title: transcript.title,
        code: transcript.code,
        lineCount: transcript.lines.length,
      },
      draft: extraction.draft,
      debug: extraction.debug,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcript extraction failed." },
      { status: 500 }
    );
  }
}
