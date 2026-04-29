import {
  relationshipTypes,
  transcriptGraphDraftSchema,
  type TranscriptGraphDraft,
} from "@/lib/story-graph-types";
import type { ParsedTranscript } from "@/lib/transcripts";

const MAX_TRANSCRIPT_CHARS = 120_000;

export type TranscriptGraphExtraction = {
  draft: TranscriptGraphDraft;
  debug: {
    provider: "openai";
    model: string;
    transcriptChars: number;
    promptTranscriptChars: number;
    truncated: boolean;
    durationMs: number;
    responseId: string | null;
    outputChars: number;
  };
};

export async function createTranscriptGraphDraft(
  transcript: ParsedTranscript
): Promise<TranscriptGraphExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === "sk-..." || apiKey.trim().length < 12) {
    throw new Error("OPENAI_API_KEY is required to extract graph data from transcripts.");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.5";
  const transcriptText = transcript.transcriptText.slice(0, MAX_TRANSCRIPT_CHARS);
  const truncated = transcript.transcriptText.length > MAX_TRANSCRIPT_CHARS;
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
                "You extract graph database data from actual-play transcript text.",
                "Return only valid JSON. No markdown fences.",
                "Use the schema described by the user. Keep ids stable, lowercase, and prefixed by the episode id where useful.",
                "Separate transcript evidence, table/show context, fictional story world, narrative theory objects, and D&D mechanics.",
                "Only include relationships whose endpoints exist in the JSON payload or the episode/source nodes.",
                "Use links with sourceLabel/sourceId/type/targetLabel/targetId for relationships.",
                `Use only these relationship type values: ${relationshipTypes.join(", ")}.`,
                "Prefer concise summaries over exhaustive paraphrase.",
                "Treat uncertain interpretations as confidence below 0.75 and mention them in extractionNotes.",
              ].join(" "),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildPrompt(transcript, transcriptText, truncated),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI extraction failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const outputText = extractResponseText(payload);
  const parsedJson = normalizeRawDraft(JSON.parse(extractJson(outputText)));
  const parsed = transcriptGraphDraftSchema.parse(parsedJson);

  return {
    draft: normalizeDraft(transcript, parsed, truncated),
    debug: {
      provider: "openai",
      model,
      transcriptChars: transcript.transcriptText.length,
      promptTranscriptChars: transcriptText.length,
      truncated,
      durationMs: Date.now() - startedAt,
      responseId: getResponseId(payload),
      outputChars: outputText.length,
    },
  };
}

function normalizeRawDraft(rawDraft: unknown) {
  if (!isRecord(rawDraft)) {
    return rawDraft;
  }

  const notes = Array.isArray(rawDraft.extractionNotes)
    ? rawDraft.extractionNotes.filter((note): note is string => typeof note === "string")
    : [];

  const normalizedLinks = Array.isArray(rawDraft.links)
    ? rawDraft.links.flatMap((link) => {
        if (!isRecord(link)) {
          notes.push("Dropped malformed link that was not an object.");
          return [];
        }

        const normalizedType = normalizeRelationshipType(link.type);
        if (!normalizedType) {
          notes.push(`Dropped link with unsupported relationship type: ${String(link.type)}`);
          return [];
        }

        return [
          {
            ...link,
            type: normalizedType,
          },
        ];
      })
    : [];

  return {
    ...rawDraft,
    links: normalizedLinks,
    extractionNotes: notes,
  };
}

function normalizeRelationshipType(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();

  const aliases: Record<string, (typeof relationshipTypes)[number]> = {
    APPEARS: "APPEARS_IN",
    APPEARED_IN: "APPEARS_IN",
    HAS_APPEARANCE: "APPEARS_IN",
    PARTICIPATES: "PARTICIPATES_IN",
    PARTICIPATED_IN: "PARTICIPATES_IN",
    LOCATION: "LOCATED_AT",
    SET_IN: "LOCATED_AT",
    TAKES_PLACE_AT: "LOCATED_AT",
    TAKES_PLACE_IN: "LOCATED_AT",
    MEMBER: "MEMBER_OF",
    BELONGS_TO: "MEMBER_OF",
    ALLY_OF: "ALLIED_WITH",
    ALLIES_WITH: "ALLIED_WITH",
    GAVE_QUEST: "GIVES_QUEST",
    QUEST_GIVER: "GIVES_QUEST",
    ACCEPTED_QUEST: "ACCEPTS_QUEST",
    ADVANCES: "ADVANCES_QUEST",
    INTRODUCES: "INTRODUCED_IN",
    INTRODUCED: "INTRODUCED_IN",
    UPDATED: "UPDATED_IN",
    RESOLVED: "RESOLVED_IN",
    MANIFESTS: "MANIFESTS_IN",
    REVEALED: "REVEALED_IN",
    REVEALS: "REVEALED_IN",
    PLAYED_BY: "PLAYS",
    CAUSED_BY: "CAUSES",
    ENABLED_BY: "ENABLES",
    COMPLICATED_BY: "COMPLICATES",
    RESOLVED_BY: "RESOLVES",
    FORESHADOWED_BY: "FORESHADOWS",
    KNOWS_ABOUT: "KNOWS",
    REVEALS_TO_CHARACTER: "REVEALS_TO",
    SEEKS_ITEM: "SEEKS",
    PROTECTS_CHARACTER: "PROTECTS",
    THREATENS_CHARACTER: "THREATENS",
    MOTIVATED_BY: "DRIVEN_BY",
    EXPLORES: "EXPLORES_THEME",
    THEME: "EXPLORES_THEME",
    STATE: "HAS_STATE",
    CHANGED_IN: "CHANGES_IN",
    OCCURRED_IN: "OCCURS_IN",
    AFFECTED: "AFFECTS",
    CONTAINS_PLACE: "CONTAINS",
    RESOURCE: "HAS_RESOURCE",
    OWNER_OF: "OWNS",
    CARRIES_ITEM: "CARRIES",
    CREATED_ITEM: "CREATED",
    ASSOCIATED_WITH: "BETWEEN",
    ESCORTS: "PROTECTS",
    GUARDS: "PROTECTS",
    INTENDED_FOR: "SEEKS",
    INVESTIGATES: "SEEKS",
    INVOLVES: "PARTICIPATES_IN",
    LAST_KNOWN_AT: "LOCATED_AT",
    LEADS: "CONTROLS",
    OCCURS_AT: "OCCURS_IN",
    POLYMORPHS: "CHANGES_IN",
    RUNS: "CONTROLS",
    RUNS_GAME_FOR: "PLAYS",
    SCOUTS: "SEEKS",
    SELLS: "HAS_RESOURCE",
    SUPPORTS: "ENABLES",
    TARGET: "SEEKS",
    THEMATIZES: "EXPLORES_THEME",
    TRADED_FOR: "SEEKS",
    TRANSFORMS: "CHANGES_IN",
    VISITS: "LOCATED_AT",
  };

  const candidate = aliases[normalized] ?? normalized;

  return relationshipTypes.includes(candidate as (typeof relationshipTypes)[number])
    ? (candidate as (typeof relationshipTypes)[number])
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildPrompt(transcript: ParsedTranscript, transcriptText: string, truncated: boolean) {
  return [
    `Transcript id: ${transcript.id}`,
    `Episode code: ${transcript.code ?? "unknown"}`,
    `Episode title: ${transcript.title}`,
    `Campaign: ${transcript.campaign ?? "unknown"}`,
    `Episode number: ${transcript.episodeNumber ?? "unknown"}`,
    `Source URL: ${transcript.sourceUrl ?? "unknown"}`,
    `Local path: ${transcript.localPath}`,
    `Transcript line count: ${transcript.lines.length}`,
    truncated
      ? "Note: the transcript text was truncated for this extraction pass. Include this limitation in extractionNotes."
      : "Note: the full parsed transcript text is included.",
    `Allowed node labels for links: TranscriptSource, Episode, Person, Character, CharacterState, Place, Faction, Item, Arc, Scene, Beat, Event, Quest, Conflict, Revelation, Motivation, Relationship, Theme, GameMechanic.`,
    `Allowed relationship types for links: ${relationshipTypes.join(", ")}.`,
    "Every link type must be one of the allowed relationship types exactly. Do not invent custom relationship names such as involves, occurs_at, target, documents, visits, runs, or associated_with.",
    "Prefer these common patterns: Episode HAS_EVENT Event, Episode HAS_BEAT Beat, Scene HAS_EVENT Event, Character APPEARS_IN Scene, Character PARTICIPATES_IN Event, Character LOCATED_AT Place, Character MEMBER_OF Faction, Scene OCCURS_IN Place, Quest INTRODUCED_IN Scene, Quest ADVANCES_QUEST Event, Conflict MANIFESTS_IN Scene, Revelation REVEALED_IN Scene, Motivation DRIVEN_BY Character, Relationship BETWEEN Character.",
    "Do not create separate transcript evidence nodes. Put transcript evidence directly on scenes, events, beats, and links with startSeconds/endSeconds plus concise summaries.",
    "",
    "Return this JSON object shape exactly:",
    `{
  "transcriptSource": {"id": string, "url": string|null, "localPath": string, "sourceName": string|null, "checksum": string|null},
  "episode": {"id": string, "campaign": string|null, "episodeNumber": number|null, "code": string|null, "title": string, "airedAt": string|null, "summary": string|null, "arcHint": string|null},
  "people": [{"id": string, "name": string, "role": string|null, "speakerLabels": string[]}],
  "characters": [{"id": string, "name": string, "aliases": string[], "characterType": string|null, "ancestry": string|null, "classRole": string|null, "level": number|null, "status": string|null, "summary": string|null, "dramaticFunction": string|null, "want": string|null, "need": string|null, "wound": string|null, "fearOrDoubt": string|null}],
  "characterStates": [{"id": string, "stateType": string|null, "label": string, "description": string|null, "startsAtSeconds": number|null, "endsAtSeconds": number|null, "severity": string|null, "certainty": string|null}],
  "places": [{"id": string, "name": string, "placeType": string|null, "description": string|null, "politicalControl": string|null, "dangerLevel": string|null, "firstMentionedAt": number|null}],
  "factions": [{"id": string, "name": string, "factionType": string|null, "description": string|null, "values": string[], "status": string|null}],
  "items": [{"id": string, "name": string, "itemType": string|null, "description": string|null, "status": string|null, "symbolicWeight": string|null}],
  "arcs": [{"id": string, "title": string, "arcType": string|null, "status": string|null, "centralQuestion": string|null, "theme": string|null, "summary": string|null}],
  "scenes": [{"id": string, "title": string, "sceneType": string|null, "episodeId": string, "startSeconds": number|null, "endSeconds": number|null, "locationName": string|null, "summary": string|null, "sceneGoal": string|null, "turningPoint": string|null, "outcome": string|null, "emotionalCharge": string|null}],
  "beats": [{"id": string, "beatType": string|null, "summary": string, "order": number|null, "storyLayer": string|null, "confidence": number|null}],
  "events": [{"id": string, "eventType": string|null, "summary": string, "episodeId": string, "startSeconds": number|null, "endSeconds": number|null, "chronologyIndex": number|null, "certainty": string|null, "consequence": string|null}],
  "quests": [{"id": string, "title": string, "questType": string|null, "status": string|null, "objective": string|null, "stakes": string|null, "reward": string|null, "moralPressure": string|null, "deadline": string|null, "knownObstacles": string|null}],
  "conflicts": [{"id": string, "conflictType": string|null, "summary": string, "status": string|null, "stakes": string|null, "asymmetry": string|null}],
  "revelations": [{"id": string, "summary": string, "knowledgeType": string|null, "knownTo": string[], "certainty": string|null, "impact": string|null}],
  "motivations": [{"id": string, "motivationType": string|null, "summary": string, "source": string|null, "status": string|null, "confidence": number|null}],
  "relationships": [{"id": string, "relationshipType": string|null, "summary": string, "status": string|null, "polarity": string|null, "intensity": number|null}],
  "themes": [{"id": string, "name": string, "description": string|null}],
  "gameMechanics": [{"id": string, "mechanicType": string|null, "name": string, "description": string|null, "system": string|null, "result": string|null}],
  "links": [{"sourceLabel": string, "sourceId": string, "type": string, "targetLabel": string, "targetId": string, "summary": string|null, "episodeId": string|null, "startSeconds": number|null, "endSeconds": number|null, "status": string|null, "confidence": number|null, "evidenceCount": number|null}],
  "extractionNotes": string[],
  "evidenceRefs": [{"transcriptLineId": string|null, "note": string|null}]
}`,
    "",
    "Transcript:",
    transcriptText,
  ].join("\n");
}

function extractResponseText(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  const output = (payload as { output?: Array<{ content?: Array<{ text?: string }> }> }).output;
  const text = output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter(Boolean)
    .join("\n");

  if (text) {
    return text;
  }

  throw new Error("OpenAI response did not include text output.");
}

function getResponseId(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "id" in payload &&
    typeof payload.id === "string"
  ) {
    return payload.id;
  }

  return null;
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

function normalizeDraft(
  transcript: ParsedTranscript,
  draft: TranscriptGraphDraft,
  truncated: boolean
): TranscriptGraphDraft {
  return {
    ...draft,
    transcriptSource: {
      ...draft.transcriptSource,
      id: draft.transcriptSource.id || `source-${transcript.id}`,
      url: draft.transcriptSource.url ?? transcript.sourceUrl,
      localPath: transcript.localPath,
      sourceName: draft.transcriptSource.sourceName ?? "Kryogenix CR Search",
    },
    episode: {
      ...draft.episode,
      id: transcript.id,
      code: draft.episode.code ?? transcript.code,
      campaign: draft.episode.campaign ?? transcript.campaign,
      episodeNumber: draft.episode.episodeNumber ?? transcript.episodeNumber,
      title: draft.episode.title || transcript.title,
    },
    extractionNotes: truncated
      ? [
          ...draft.extractionNotes,
          `Transcript was truncated to ${MAX_TRANSCRIPT_CHARS} characters for this extraction pass.`,
        ]
      : draft.extractionNotes,
  };
}
