import { NextResponse } from "next/server";
import { z } from "zod";
import { insertTranscriptGraph } from "@/lib/story-graph-repository";
import { transcriptGraphDraftSchema } from "@/lib/story-graph-types";
import { parseTranscriptById } from "@/lib/transcripts";

const requestSchema = z.object({
  transcriptId: z.string().min(1),
  draft: transcriptGraphDraftSchema,
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid transcript insert payload." }, { status: 400 });
  }

  try {
    const transcript = await parseTranscriptById(parsed.data.transcriptId);
    const result = await insertTranscriptGraph(transcript, parsed.data.draft);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcript graph insertion failed." },
      { status: 500 }
    );
  }
}
