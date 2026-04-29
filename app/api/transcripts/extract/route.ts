import { NextResponse } from "next/server";
import { z } from "zod";
import { createTranscriptGraphDraft } from "@/lib/transcript-graph-agent";
import { parseTranscriptById } from "@/lib/transcripts";

const requestSchema = z.object({
  transcriptId: z.string().min(1),
});

export const maxDuration = 300;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  console.info(`[transcripts/extract:${requestId}] extraction request received.`);

  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      console.warn(`[transcripts/extract:${requestId}] invalid extraction payload.`, {
        issues: parsed.error.issues,
      });

      return NextResponse.json(
        {
          error: "Invalid transcript extraction payload.",
          requestId,
          issues: parsed.error.issues,
        },
        { status: 400 }
      );
    }

    console.info(
      `[transcripts/extract:${requestId}] parsing transcript ${parsed.data.transcriptId}.`
    );
    const transcript = await parseTranscriptById(parsed.data.transcriptId);
    console.info(
      `[transcripts/extract:${requestId}] starting LLM extraction for ${transcript.code ?? transcript.id}.`
    );
    const extraction = await createTranscriptGraphDraft(transcript);
    console.info(
      `[transcripts/extract:${requestId}] extraction completed in ${Date.now() - startedAt}ms.`,
      {
        model: extraction.debug.model,
        responseId: extraction.debug.responseId,
        outputChars: extraction.debug.outputChars,
      }
    );

    return NextResponse.json({
      requestId,
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
    console.error(`[transcripts/extract:${requestId}] extraction failed.`, error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Transcript extraction failed.",
        requestId,
        durationMs: Date.now() - startedAt,
      },
      { status: 500 }
    );
  }
}
