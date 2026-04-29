import { randomUUID } from "node:crypto";
import { futurePredictionResponseSchema, type FuturePrediction } from "@/lib/future-prediction-types";
import { getFuturePredictionContext, type FuturePredictionContext } from "@/lib/story-graph-repository";

const MAX_CONTEXT_CHARS = 22_000;

export type FuturePredictionResult = {
  predictions: FuturePrediction[];
  debug: {
    provider: "openai";
    model: string;
    contextNodeCount: number;
    contextRelationshipCount: number;
    durationMs: number;
    responseId: string | null;
    outputChars: number;
  };
};

export async function createFuturePredictions(transcriptId: string): Promise<FuturePredictionResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === "sk-..." || apiKey.trim().length < 12) {
    throw new Error("OPENAI_API_KEY is required to generate future predictions.");
  }

  const context = await getFuturePredictionContext(transcriptId);
  const model = process.env.OPENAI_FUTURE_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.5";
  const startedAt = Date.now();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "You are a future-possibility agent for a co-created tabletop story graph.",
                "Return only valid JSON. No markdown fences.",
                "Create exactly 12 speculative future prediction cards grounded in the supplied graph context.",
                "Do not present predictions as canonical facts.",
                "Every prediction must cite existing graph node ids in involvedNodeIds and evidence.",
                "Favor unresolved quests, active conflicts, character motivations, foreshadowing, threats, resources, and relationship pressure.",
                "Balance the set: likely continuations, complications, character futures, quest futures, world/faction/place futures, one plausible twist, and one quiet emotional possibility.",
                "Make cards playable: each should imply a choice, risk, opportunity, or question for the players.",
                "Use concise, evocative language. Avoid spoilers beyond the provided context.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildPrompt(context),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI future prediction failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const outputText = extractResponseText(payload);
  const parsed = futurePredictionResponseSchema.parse(JSON.parse(extractJson(outputText)));

  return {
    predictions: normalizePredictions(parsed.predictions),
    debug: {
      provider: "openai",
      model,
      contextNodeCount: context.nodes.length,
      contextRelationshipCount: context.relationships.length,
      durationMs: Date.now() - startedAt,
      responseId: getResponseId(payload),
      outputChars: outputText.length,
    },
  };
}

function buildPrompt(context: FuturePredictionContext) {
  const compactContext = JSON.stringify(context, null, 2).slice(0, MAX_CONTEXT_CHARS);

  return [
    "Graph context:",
    compactContext,
    "",
    "Return JSON in this exact shape:",
    JSON.stringify(
      {
        predictions: [
          {
            id: "future-1",
            title: "Short card title",
            summary: "One sentence describing a possible future.",
            probability: "low | medium | high",
            horizon: "next scene | soon | later",
            tone: "danger | opportunity | mystery | character | quest",
            involvedNodeIds: ["existing-node-id"],
            evidence: [{ nodeId: "existing-node-id", reason: "Why this graph node supports the prediction." }],
            playerLevers: ["A concrete choice or action players could take."],
            risk: "What could go wrong, or null",
          },
        ],
      },
      null,
      2
    ),
  ].join("\n");
}

function normalizePredictions(predictions: FuturePrediction[]) {
  return predictions.slice(0, 12).map((prediction, index) => ({
    ...prediction,
    id: prediction.id.trim() || `future-${index + 1}-${randomUUID()}`,
    title: prediction.title.trim(),
    summary: prediction.summary.trim(),
    involvedNodeIds: uniqueStrings(prediction.involvedNodeIds).slice(0, 8),
    evidence: prediction.evidence.slice(0, 4),
    playerLevers: uniqueStrings(prediction.playerLevers).slice(0, 3),
    risk: prediction.risk?.trim() || null,
  }));
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    throw new Error("OpenAI response was empty.");
  }

  if ("output_text" in payload && typeof payload.output_text === "string") {
    return payload.output_text;
  }

  if (!("output" in payload) || !Array.isArray(payload.output)) {
    throw new Error("OpenAI response did not contain output text.");
  }

  const chunks = payload.output.flatMap((item) => {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) {
      return [];
    }

    return item.content.flatMap((content: unknown) => {
      if (!content || typeof content !== "object") {
        return [];
      }

      if ("text" in content && typeof content.text === "string") {
        return [content.text];
      }

      return [];
    });
  });

  const text = chunks.join("\n").trim();
  if (!text) {
    throw new Error("OpenAI response text was empty.");
  }

  return text;
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);

  if (fenced?.[1]) {
    return fenced[1];
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("OpenAI response did not contain a JSON object.");
  }

  return trimmed.slice(firstBrace, lastBrace + 1);
}

function getResponseId(payload: unknown) {
  if (payload && typeof payload === "object" && "id" in payload && typeof payload.id === "string") {
    return payload.id;
  }

  return null;
}
