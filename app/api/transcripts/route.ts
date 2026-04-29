import { NextResponse } from "next/server";
import { getTranscriptLoadStatuses } from "@/lib/story-graph-repository";
import { listTranscriptFiles } from "@/lib/transcripts";

export async function GET() {
  const transcripts = await listTranscriptFiles();
  const statuses = await getTranscriptLoadStatuses(transcripts);

  return NextResponse.json({
    transcripts: transcripts.map((transcript) => ({
      ...transcript,
      loadStatus: statuses.get(transcript.id),
    })),
  });
}
