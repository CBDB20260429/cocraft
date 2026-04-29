import { NextResponse } from "next/server";
import { z } from "zod";
import { createStoryStep } from "@/lib/story-agent";
import { saveStoryStep } from "@/lib/story-repository";

const requestSchema = z.object({
  action: z.string().min(1),
  sessionId: z.string().uuid().optional().nullable(),
  selectedNodeId: z.string().min(1).optional().nullable(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid story action payload." },
      { status: 400 }
    );
  }

  const storyStep = await createStoryStep(parsed.data);
  await saveStoryStep(storyStep, parsed.data.action).catch((error) => {
    console.warn("Story step generated but was not persisted.", error);
  });

  return NextResponse.json(storyStep);
}
