import { NextResponse } from "next/server";
import { getPlayModeGraph } from "@/lib/story-graph-repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const transcriptId = url.searchParams.get("transcriptId");

  try {
    const graph = await getPlayModeGraph(transcriptId ?? undefined);

    if (!graph) {
      return NextResponse.json(
        { error: "No loaded story graph found." },
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
