import { z } from "zod";

const optionalNumber = z.number().nullable().optional();
const optionalString = z.string().nullable().optional();
const stringList = z.array(z.string()).default([]);

const evidenceRefSchema = z.object({
  transcriptLineId: optionalString,
  note: optionalString,
});

const graphNodeBaseSchema = z.object({
  id: z.string().min(1),
});

export const relationshipTypes = [
  "HAS_EPISODE",
  "HAS_BEAT",
  "HAS_EVENT",
  "PLAYS",
  "APPEARS_IN",
  "PARTICIPATES_IN",
  "LOCATED_AT",
  "TRAVELS_TO",
  "MEMBER_OF",
  "CONTROLS",
  "OPPOSES",
  "ALLIED_WITH",
  "GIVES_QUEST",
  "ACCEPTS_QUEST",
  "BLOCKS_QUEST",
  "ADVANCES_QUEST",
  "INTRODUCED_IN",
  "UPDATED_IN",
  "RESOLVED_IN",
  "MANIFESTS_IN",
  "REVEALED_IN",
  "CAUSES",
  "ENABLES",
  "COMPLICATES",
  "RESOLVES",
  "FORESHADOWS",
  "KNOWS",
  "REVEALS_TO",
  "SEEKS",
  "PROTECTS",
  "THREATENS",
  "DRIVEN_BY",
  "EXPLORES_THEME",
  "HAS_STATE",
  "BETWEEN",
  "CHANGES_IN",
  "OCCURS_IN",
  "AFFECTS",
  "CONTAINS",
  "HAS_RESOURCE",
  "OWNS",
  "CARRIES",
  "CREATED",
] as const;

export const transcriptGraphDraftSchema = z.object({
  transcriptSource: graphNodeBaseSchema.extend({
    url: optionalString,
    localPath: z.string(),
    sourceName: optionalString,
    checksum: optionalString,
  }),
  episode: graphNodeBaseSchema.extend({
    campaign: optionalString,
    episodeNumber: optionalNumber,
    code: optionalString,
    title: z.string(),
    airedAt: optionalString,
    summary: optionalString,
    arcHint: optionalString,
  }),
  people: z.array(
    graphNodeBaseSchema.extend({
      name: z.string(),
      role: optionalString,
      speakerLabels: stringList,
    })
  ),
  characters: z.array(
    graphNodeBaseSchema.extend({
      name: z.string(),
      aliases: stringList,
      characterType: optionalString,
      ancestry: optionalString,
      classRole: optionalString,
      level: optionalNumber,
      status: optionalString,
      summary: optionalString,
      dramaticFunction: optionalString,
      want: optionalString,
      need: optionalString,
      wound: optionalString,
      fearOrDoubt: optionalString,
    })
  ),
  characterStates: z.array(
    graphNodeBaseSchema.extend({
      stateType: optionalString,
      label: z.string(),
      description: optionalString,
      startsAtSeconds: optionalNumber,
      endsAtSeconds: optionalNumber,
      severity: optionalString,
      certainty: optionalString,
    })
  ),
  places: z.array(
    graphNodeBaseSchema.extend({
      name: z.string(),
      placeType: optionalString,
      description: optionalString,
      politicalControl: optionalString,
      dangerLevel: optionalString,
      firstMentionedAt: optionalNumber,
    })
  ),
  factions: z.array(
    graphNodeBaseSchema.extend({
      name: z.string(),
      factionType: optionalString,
      description: optionalString,
      values: stringList,
      status: optionalString,
    })
  ),
  items: z.array(
    graphNodeBaseSchema.extend({
      name: z.string(),
      itemType: optionalString,
      description: optionalString,
      status: optionalString,
      symbolicWeight: optionalString,
    })
  ),
  arcs: z.array(
    graphNodeBaseSchema.extend({
      title: z.string(),
      arcType: optionalString,
      status: optionalString,
      centralQuestion: optionalString,
      theme: optionalString,
      summary: optionalString,
    })
  ),
  scenes: z.array(
    graphNodeBaseSchema.extend({
      title: z.string(),
      sceneType: optionalString,
      episodeId: z.string(),
      startSeconds: optionalNumber,
      endSeconds: optionalNumber,
      locationName: optionalString,
      summary: optionalString,
      sceneGoal: optionalString,
      turningPoint: optionalString,
      outcome: optionalString,
      emotionalCharge: optionalString,
    })
  ),
  beats: z.array(
    graphNodeBaseSchema.extend({
      beatType: optionalString,
      summary: z.string(),
      order: optionalNumber,
      storyLayer: optionalString,
      confidence: optionalNumber,
    })
  ),
  events: z.array(
    graphNodeBaseSchema.extend({
      eventType: optionalString,
      summary: z.string(),
      episodeId: z.string(),
      startSeconds: optionalNumber,
      endSeconds: optionalNumber,
      chronologyIndex: optionalNumber,
      certainty: optionalString,
      consequence: optionalString,
    })
  ),
  quests: z.array(
    graphNodeBaseSchema.extend({
      title: z.string(),
      questType: optionalString,
      status: optionalString,
      objective: optionalString,
      stakes: optionalString,
      reward: optionalString,
      moralPressure: optionalString,
      deadline: optionalString,
      knownObstacles: optionalString,
    })
  ),
  conflicts: z.array(
    graphNodeBaseSchema.extend({
      conflictType: optionalString,
      summary: z.string(),
      status: optionalString,
      stakes: optionalString,
      asymmetry: optionalString,
    })
  ),
  revelations: z.array(
    graphNodeBaseSchema.extend({
      summary: z.string(),
      knowledgeType: optionalString,
      knownTo: stringList,
      certainty: optionalString,
      impact: optionalString,
    })
  ),
  motivations: z.array(
    graphNodeBaseSchema.extend({
      motivationType: optionalString,
      summary: z.string(),
      source: optionalString,
      status: optionalString,
      confidence: optionalNumber,
    })
  ),
  relationships: z.array(
    graphNodeBaseSchema.extend({
      relationshipType: optionalString,
      summary: z.string(),
      status: optionalString,
      polarity: optionalString,
      intensity: optionalNumber,
    })
  ),
  themes: z.array(
    graphNodeBaseSchema.extend({
      name: z.string(),
      description: optionalString,
    })
  ),
  gameMechanics: z.array(
    graphNodeBaseSchema.extend({
      mechanicType: optionalString,
      name: z.string(),
      description: optionalString,
      system: optionalString,
      result: optionalString,
    })
  ),
  links: z.array(
    z.object({
      sourceLabel: z.string(),
      sourceId: z.string(),
      type: z.enum(relationshipTypes),
      targetLabel: z.string(),
      targetId: z.string(),
      summary: optionalString,
      episodeId: optionalString,
      startSeconds: optionalNumber,
      endSeconds: optionalNumber,
      status: optionalString,
      confidence: optionalNumber,
      evidenceCount: optionalNumber,
    })
  ),
  extractionNotes: z.array(z.string()).default([]),
  evidenceRefs: z.array(evidenceRefSchema).default([]),
});

export type TranscriptGraphDraft = z.infer<typeof transcriptGraphDraftSchema>;
export type TranscriptGraphLink = TranscriptGraphDraft["links"][number];

export const graphLabels = [
  "TranscriptSource",
  "Episode",
  "Person",
  "Character",
  "CharacterState",
  "Place",
  "Faction",
  "Item",
  "Arc",
  "Scene",
  "Beat",
  "Event",
  "Quest",
  "Conflict",
  "Revelation",
  "Motivation",
  "Relationship",
  "Theme",
  "GameMechanic",
] as const;

export type GraphLabel = (typeof graphLabels)[number];
