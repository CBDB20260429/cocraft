import { Agent, run } from "@openai/agents";
import { z } from "zod";
import { randomUUID } from "crypto";

const storyGraphSchema = z.object({
  narrative: z.string(),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      kind: z.enum(["history", "current", "future"]),
      detail: z.string(),
    })
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      label: z.string().optional(),
    })
  ),
});

export type StoryStep = z.infer<typeof storyGraphSchema> & {
  sessionId: string;
};

type StoryInput = {
  action: string;
  sessionId?: string | null;
  selectedNodeId?: string | null;
};

const storyAgent = new Agent({
  name: "Cocraft narrative engine",
  model: process.env.OPENAI_MODEL ?? "gpt-5.5",
  instructions: [
    "You are the narrative engine for Cocraft, a co-creation storytelling harness.",
    "Continue the story in response to the user's action.",
    "Return concise JSON with narrative, nodes, and edges.",
    "Nodes must include established history, current state, and possible futures.",
    "Keep labels short. Details should be vivid but operational for graph inspection.",
  ].join(" "),
});

export async function createStoryStep(input: StoryInput): Promise<StoryStep> {
  const sessionId = input.sessionId ?? randomUUID();

  if (!hasOpenAiKey()) {
    return createFallbackStep(input, sessionId);
  }

  const result = await run(
    storyAgent,
    [
      `Session: ${sessionId}`,
      `Selected node: ${input.selectedNodeId ?? "none"}`,
      `User action: ${input.action}`,
      "Respond only as JSON matching this TypeScript shape:",
      "{ narrative: string; nodes: { id: string; label: string; kind: 'history' | 'current' | 'future'; detail: string }[]; edges: { id: string; source: string; target: string; label?: string }[] }",
    ].join("\n")
  );

  const rawOutput = String(result.finalOutput ?? "");
  const json = extractJson(rawOutput);
  const parsed = storyGraphSchema.parse(JSON.parse(json));

  return {
    sessionId,
    ...parsed,
  };
}

function hasOpenAiKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  return Boolean(apiKey && apiKey !== "sk-..." && apiKey.trim().length > 8);
}

function createFallbackStep(input: StoryInput, sessionId: string): StoryStep {
  const suffix = Date.now().toString(36);
  const currentId = `current-${suffix}`;
  const futureId = `future-${suffix}`;

  return {
    sessionId,
    narrative: `The story absorbs the action: "${input.action}". A new pressure enters the scene, turning the selected thread into a sharper choice.`,
    nodes: [
      {
        id: "history",
        label: "Established thread",
        kind: "history",
        detail: "Prior events remain available as constraints and texture.",
      },
      {
        id: currentId,
        label: "Changed scene",
        kind: "current",
        detail: `The selected node ${input.selectedNodeId ?? "none"} now carries the user's latest action.`,
      },
      {
        id: futureId,
        label: "Next possibility",
        kind: "future",
        detail: "The next turn can deepen the consequence, redirect the goal, or reveal a hidden relationship.",
      },
    ],
    edges: [
      { id: `history-${currentId}`, source: "history", target: currentId, label: "shapes" },
      { id: `${currentId}-${futureId}`, source: currentId, target: futureId, label: "opens" },
    ],
  };
}

function extractJson(output: string) {
  const fenced = output.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced?.[1]) {
    return fenced[1];
  }

  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return output.slice(start, end + 1);
  }

  return output;
}
