import { NextResponse } from "next/server";
import { createFuturePredictions } from "@/lib/future-prediction-agent";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const transcriptId = url.searchParams.get("transcriptId");

  if (!transcriptId) {
    return NextResponse.json({ error: "Missing transcriptId." }, { status: 400 });
  }

  try {
    const result = await createFuturePredictions(transcriptId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not generate futures." },
      { status: 500 }
    );
  }
}
