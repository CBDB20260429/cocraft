import { NextResponse } from "next/server";
import { getPlayModeGraph } from "@/lib/story-graph-repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const transcriptId = url.searchParams.get("transcriptId");

  if (!transcriptId) {
    return NextResponse.json({ error: "Missing transcriptId." }, { status: 400 });
  }

  try {
    const graph = await getPlayModeGraph(transcriptId);

    if (!graph) {
      return NextResponse.json(
        { error: "No loaded graph found for this transcript." },
        { status: 404 }
      );
    }

    return NextResponse.json({ graph });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load play graph." },
      { status: 500 }
    );
  }
}
