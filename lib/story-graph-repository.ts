import { randomUUID } from "node:crypto";
import { getDatabaseName, getDriver } from "@/lib/db";
import type { ParsedTranscript, TranscriptInfo } from "@/lib/transcripts";
import {
  graphLabels,
  type GraphLabel,
  type TranscriptGraphDraft,
  type TranscriptGraphLink,
} from "@/lib/story-graph-types";
import type { PlayLayerNode, PlayLayerSide, PlayModeGraph, PlayTimeAnchor } from "@/lib/play-mode-types";

export type TranscriptLoadStatus = {
  transcriptId: string;
  status: "not_loaded" | "loaded" | "failed";
  loadedAt: string | null;
  nodeCount: number;
  linkCount: number;
  error: string | null;
};

const labelSet = new Set<string>(graphLabels);

type NodeCollectionKey =
  | "transcriptSpans"
  | "people"
  | "characters"
  | "characterStates"
  | "places"
  | "factions"
  | "items"
  | "arcs"
  | "scenes"
  | "beats"
  | "events"
  | "quests"
  | "conflicts"
  | "revelations"
  | "motivations"
  | "relationships"
  | "themes"
  | "gameMechanics";

const collectionLabels: Array<{
  label: GraphLabel;
  key: NodeCollectionKey;
}> = [
  { label: "TranscriptSpan", key: "transcriptSpans" },
  { label: "Person", key: "people" },
  { label: "Character", key: "characters" },
  { label: "CharacterState", key: "characterStates" },
  { label: "Place", key: "places" },
  { label: "Faction", key: "factions" },
  { label: "Item", key: "items" },
  { label: "Arc", key: "arcs" },
  { label: "Scene", key: "scenes" },
  { label: "Beat", key: "beats" },
  { label: "Event", key: "events" },
  { label: "Quest", key: "quests" },
  { label: "Conflict", key: "conflicts" },
  { label: "Revelation", key: "revelations" },
  { label: "Motivation", key: "motivations" },
  { label: "Relationship", key: "relationships" },
  { label: "Theme", key: "themes" },
  { label: "GameMechanic", key: "gameMechanics" },
];

const playDetailLabels = [
  "Character",
  "CharacterState",
  "Place",
  "Faction",
  "Item",
  "Arc",
  "Quest",
  "Conflict",
  "Revelation",
  "Motivation",
  "Relationship",
  "Theme",
  "GameMechanic",
];

const aboveLayerLabels = new Set([
  "Character",
  "CharacterState",
  "Revelation",
  "Motivation",
  "Relationship",
  "Theme",
]);

export async function getTranscriptLoadStatuses(
  transcripts: TranscriptInfo[]
): Promise<Map<string, TranscriptLoadStatus>> {
  const statuses = new Map<string, TranscriptLoadStatus>();

  transcripts.forEach((transcript) => {
    statuses.set(transcript.id, {
      transcriptId: transcript.id,
      status: "not_loaded",
      loadedAt: null,
      nodeCount: 0,
      linkCount: 0,
      error: null,
    });
  });

  const driver = getDriver();
  if (!driver || transcripts.length === 0) {
    return statuses;
  }

  const session = driver.session({ database: getDatabaseName() });

  try {
    const result = await session.run(
      `
        match (load:TranscriptGraphLoad)
        where load.transcriptId in $ids
        return load
      `,
      { ids: transcripts.map((transcript) => transcript.id) }
    );

    for (const record of result.records) {
      const properties = record.get("load").properties;
      statuses.set(properties.transcriptId, {
        transcriptId: properties.transcriptId,
        status: properties.status ?? "not_loaded",
        loadedAt: properties.loadedAt?.toString() ?? null,
        nodeCount: toNumber(properties.nodeCount),
        linkCount: toNumber(properties.linkCount),
        error: properties.error ?? null,
      });
    }
  } finally {
    await session.close();
  }

  return statuses;
}

export async function getPlayModeGraph(transcriptId: string): Promise<PlayModeGraph | null> {
  const driver = getDriver();
  if (!driver) {
    return null;
  }

  const session = driver.session({ database: getDatabaseName() });

  try {
    const result = await session.run(
      `
        match (episode:Episode {id: $transcriptId})
        call {
          with episode
          match (episode)-[:CONTAINS]->(anchor:Scene)
          return anchor, labels(anchor) as anchorLabels,
            coalesce(anchor.startSeconds, anchor.endSeconds) as anchorTime,
            coalesce(anchor.startSeconds, anchor.endSeconds, 1000000000) as anchorOrder

          union

          with episode
          match (episode)-[:HAS_BEAT]->(anchor:Beat)
          return anchor, labels(anchor) as anchorLabels,
            null as anchorTime,
            coalesce(anchor.order, 1000000000) as anchorOrder

          union

          with episode
          match (episode)-[:HAS_EVENT]->(anchor:Event)
          return anchor, labels(anchor) as anchorLabels,
            coalesce(anchor.startSeconds, anchor.endSeconds) as anchorTime,
            coalesce(anchor.chronologyIndex, anchor.startSeconds, anchor.endSeconds, 1000000000) as anchorOrder
        }
        optional match (anchor)-[relationship]-(detail)
        where detail is null or any(label in labels(detail) where label in $detailLabels)
        return episode,
          anchor,
          anchorLabels,
          anchorTime,
          anchorOrder,
          collect(distinct {
            node: detail,
            labels: labels(detail),
            relationshipType: type(relationship)
          }) as details
        order by anchorOrder asc
        limit 80
      `,
      {
        transcriptId,
        detailLabels: playDetailLabels,
      }
    );

    if (result.records.length === 0) {
      const episodeResult = await session.run(
        `
          match (episode:Episode {id: $transcriptId})
          return episode
        `,
        { transcriptId }
      );

      if (episodeResult.records.length === 0) {
        return null;
      }

      const episodeProperties = episodeResult.records[0].get("episode").properties;

      return {
        transcriptId,
        episode: {
          id: String(episodeProperties.id ?? transcriptId),
          title: String(episodeProperties.title ?? "Untitled episode"),
          summary: nullableString(episodeProperties.summary),
        },
        anchors: [
          {
            id: String(episodeProperties.id ?? transcriptId),
            label: String(episodeProperties.title ?? "Episode"),
            kind: "episode",
            time: null,
            chronologyIndex: 0,
            summary: nullableString(episodeProperties.summary),
            layers: [],
          },
        ],
      };
    }

    const firstEpisode = result.records[0].get("episode").properties;

    return {
      transcriptId,
      episode: {
        id: String(firstEpisode.id ?? transcriptId),
        title: String(firstEpisode.title ?? "Untitled episode"),
        summary: nullableString(firstEpisode.summary),
      },
      anchors: result.records.map((record, index) => {
        const anchor = record.get("anchor");
        const anchorProperties = anchor.properties as Record<string, unknown>;
        const anchorLabels = record.get("anchorLabels") as string[];

        return {
          id: String(anchorProperties.id ?? anchor.identity),
          label: getNodeLabel(anchorProperties, anchorLabels[0] ?? "Moment"),
          kind: getAnchorKind(anchorLabels),
          time: nullableNumber(record.get("anchorTime")),
          chronologyIndex: index,
          summary: nullableString(anchorProperties.summary ?? anchorProperties.description),
          layers: readPlayLayers(record.get("details")),
        };
      }),
    };
  } finally {
    await session.close();
  }
}

export async function insertTranscriptGraph(
  transcript: ParsedTranscript,
  draft: TranscriptGraphDraft
) {
  const driver = getDriver();
  if (!driver) {
    throw new Error("Neo4j is not configured. Set NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD.");
  }

  const session = driver.session({ database: getDatabaseName() });
  const loadId = `load-${transcript.id}`;

  try {
    let insertedLinkCount = 0;
    const extractionNotes = [...draft.extractionNotes];

    await session.executeWrite(async (tx) => {
      await tx.run(
        `
          merge (load:TranscriptGraphLoad {id: $loadId})
          set load.transcriptId = $transcriptId,
              load.fileName = $fileName,
              load.localPath = $localPath,
              load.status = "loading",
              load.startedAt = datetime(),
              load.error = null
        `,
        {
          loadId,
          transcriptId: transcript.id,
          fileName: transcript.fileName,
          localPath: transcript.localPath,
        }
      );

      await upsertNodes(tx, "TranscriptSource", [
        {
          ...draft.transcriptSource,
          localPath: transcript.localPath,
          url: draft.transcriptSource.url ?? transcript.sourceUrl,
          sourceName: draft.transcriptSource.sourceName ?? "Kryogenix CR Search",
        },
      ]);
      await upsertNodes(tx, "Episode", [
        {
          ...draft.episode,
          id: transcript.id,
          code: draft.episode.code ?? transcript.code,
          campaign: draft.episode.campaign ?? transcript.campaign,
          episodeNumber: draft.episode.episodeNumber ?? transcript.episodeNumber,
          title: draft.episode.title || transcript.title,
          transcriptLineCount: transcript.lines.length,
        },
      ]);

      for (const collection of collectionLabels) {
        const nodes = draft[collection.key];
        if (Array.isArray(nodes) && nodes.length > 0) {
          await upsertNodes(tx, collection.label, nodes);
        }
      }

      insertedLinkCount += await upsertStructuralLinks(tx, transcript.id, draft);

      const safeLinks = draft.links.filter((link) => {
        const safe = isSafeLink(link);
        if (!safe) {
          extractionNotes.push(
            `Skipped link with unsupported endpoint label: ${link.sourceLabel}:${link.sourceId} -[${link.type}]-> ${link.targetLabel}:${link.targetId}`
          );
        }
        return safe;
      });

      for (const link of safeLinks) {
        const inserted = await upsertLink(tx, link);
        if (!inserted) {
          extractionNotes.push(
            `Skipped link with unmatched endpoint: ${link.sourceLabel}:${link.sourceId} -[${link.type}]-> ${link.targetLabel}:${link.targetId}`
          );
        }
        insertedLinkCount += inserted;
      }

      await tx.run(
        `
          match (load:TranscriptGraphLoad {id: $loadId})
          set load.status = "loaded",
              load.loadedAt = datetime(),
              load.nodeCount = $nodeCount,
              load.linkCount = $linkCount,
              load.extractionNotes = $extractionNotes
        `,
        {
          loadId,
          nodeCount: countDraftNodes(draft),
          linkCount: insertedLinkCount,
          extractionNotes,
        }
      );
    });

    return {
      transcriptId: transcript.id,
      status: "loaded" as const,
      nodeCount: countDraftNodes(draft),
      linkCount: insertedLinkCount,
    };
  } catch (error) {
    await markLoadFailed(loadId, transcript.id, error);
    throw error;
  } finally {
    await session.close();
  }
}

async function upsertNodes(
  tx: { run: (query: string, parameters?: Record<string, unknown>) => Promise<unknown> },
  label: GraphLabel,
  nodes: Array<Record<string, unknown>>
) {
  if (nodes.length === 0) {
    return;
  }

  await tx.run(
    `
      unwind $nodes as row
      merge (node:${label} {id: row.id})
      set node += row.props,
          node.updatedAt = datetime()
      set node.createdAt = coalesce(node.createdAt, datetime())
    `,
    {
      nodes: nodes.map((node) => ({
        id: node.id,
        props: cleanProperties(node),
      })),
    }
  );
}

async function upsertLink(
  tx: { run: (query: string, parameters?: Record<string, unknown>) => Promise<unknown> },
  link: TranscriptGraphLink
) {
  const result = await tx.run(
    `
      match (source:${link.sourceLabel} {id: $sourceId})
      match (target:${link.targetLabel} {id: $targetId})
      merge (source)-[relationship:${link.type}]->(target)
      set relationship += $props,
          relationship.updatedAt = datetime()
      set relationship.id = coalesce(relationship.id, $id),
          relationship.createdAt = coalesce(relationship.createdAt, datetime())
      return count(relationship) as relationshipCount
    `,
    {
      sourceId: link.sourceId,
      targetId: link.targetId,
      id: randomUUID(),
      props: cleanProperties({
        summary: link.summary,
        episodeId: link.episodeId,
        startSeconds: link.startSeconds,
        endSeconds: link.endSeconds,
        status: link.status,
        confidence: link.confidence,
        evidenceCount: link.evidenceCount,
      }),
    }
  );

  return readFirstCount(result, "relationshipCount");
}

async function upsertStructuralLinks(
  tx: { run: (query: string, parameters?: Record<string, unknown>) => Promise<unknown> },
  episodeId: string,
  draft: TranscriptGraphDraft
) {
  let linkCount = 0;

  linkCount += await upsertEpisodeToSourceLink(tx, draft.transcriptSource.id, episodeId);
  linkCount += await upsertEpisodeCollectionLinks(tx, episodeId, "HAS_SPAN", "TranscriptSpan", draft.transcriptSpans);
  linkCount += await upsertEpisodeCollectionLinks(tx, episodeId, "HAS_EVENT", "Event", draft.events);
  linkCount += await upsertEpisodeCollectionLinks(tx, episodeId, "HAS_BEAT", "Beat", draft.beats);
  linkCount += await upsertEpisodeCollectionLinks(tx, episodeId, "CONTAINS", "Scene", draft.scenes);

  return linkCount;
}

async function upsertEpisodeToSourceLink(
  tx: { run: (query: string, parameters?: Record<string, unknown>) => Promise<unknown> },
  sourceId: string,
  episodeId: string
) {
  const result = await tx.run(
    `
      match (source:TranscriptSource {id: $sourceId})
      match (episode:Episode {id: $episodeId})
      merge (source)-[relationship:HAS_EPISODE]->(episode)
      set relationship.updatedAt = datetime(),
          relationship.createdAt = coalesce(relationship.createdAt, datetime())
      return count(relationship) as relationshipCount
    `,
    {
      sourceId,
      episodeId,
    }
  );

  return readFirstCount(result, "relationshipCount");
}

async function upsertEpisodeCollectionLinks(
  tx: { run: (query: string, parameters?: Record<string, unknown>) => Promise<unknown> },
  episodeId: string,
  type: "HAS_SPAN" | "HAS_EVENT" | "HAS_BEAT" | "CONTAINS",
  targetLabel: "TranscriptSpan" | "Event" | "Beat" | "Scene",
  nodes: Array<{ id: string }>
) {
  if (nodes.length === 0) {
    return 0;
  }

  const result = await tx.run(
    `
      match (episode:Episode {id: $episodeId})
      unwind $targetIds as targetId
      match (target:${targetLabel} {id: targetId})
      merge (episode)-[relationship:${type}]->(target)
      set relationship.updatedAt = datetime(),
          relationship.createdAt = coalesce(relationship.createdAt, datetime())
      return count(relationship) as relationshipCount
    `,
    {
      episodeId,
      targetIds: nodes.map((node) => node.id),
    }
  );

  return readFirstCount(result, "relationshipCount");
}

function isSafeLink(link: TranscriptGraphLink) {
  return labelSet.has(link.sourceLabel) && labelSet.has(link.targetLabel);
}

function cleanProperties(properties: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  );
}

function countDraftNodes(draft: TranscriptGraphDraft) {
  return (
    2 +
    collectionLabels.reduce((count, collection) => {
      const nodes = draft[collection.key];
      return count + (Array.isArray(nodes) ? nodes.length : 0);
    }, 0)
  );
}

function readFirstCount(result: unknown, key: string) {
  if (
    !result ||
    typeof result !== "object" ||
    !("records" in result) ||
    !Array.isArray(result.records) ||
    result.records.length === 0
  ) {
    return 0;
  }

  const record = result.records[0];
  if (!record || typeof record !== "object" || !("get" in record) || typeof record.get !== "function") {
    return 0;
  }

  return toNumber(record.get(key));
}

function readPlayLayers(details: unknown): PlayLayerNode[] {
  if (!Array.isArray(details)) {
    return [];
  }

  const layers = details
    .map((detail) => {
      if (!detail || typeof detail !== "object" || !("node" in detail)) {
        return null;
      }

      const node = detail.node;
      if (!node || typeof node !== "object" || !("properties" in node)) {
        return null;
      }

      const labels = "labels" in detail && Array.isArray(detail.labels) ? detail.labels : [];
      const properties = node.properties as Record<string, unknown>;
      const kind = String(labels[0] ?? "Node");

      return {
        id: String(properties.id ?? getNodeIdentity(node)),
        label: getNodeLabel(properties, kind),
        kind: kind.toLowerCase(),
        side: getLayerSide(kind),
        detail: nullableString(properties.summary ?? properties.description ?? properties.status),
        relationshipType:
          "relationshipType" in detail ? nullableString(detail.relationshipType) : null,
      };
    })
    .filter((layer): layer is PlayLayerNode => Boolean(layer));

  return layers.slice(0, 8);
}

function getNodeLabel(properties: Record<string, unknown>, fallback: string) {
  const label = properties.name ?? properties.title ?? properties.label ?? properties.summary;

  if (typeof label === "string" && label.trim()) {
    return label;
  }

  return fallback;
}

function getAnchorKind(labels: string[]): PlayTimeAnchor["kind"] {
  if (labels.includes("Scene")) {
    return "scene";
  }

  if (labels.includes("Beat")) {
    return "beat";
  }

  if (labels.includes("Event")) {
    return "event";
  }

  return "episode";
}

function getLayerSide(label: string): PlayLayerSide {
  return aboveLayerLabels.has(label) ? "above" : "below";
}

function getNodeIdentity(node: unknown) {
  if (node && typeof node === "object" && "identity" in node) {
    return node.identity;
  }

  return randomUUID();
}

function nullableString(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return null;
}

function nullableNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber();
  }

  return null;
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toNumber" in value &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber();
  }

  return 0;
}

async function markLoadFailed(loadId: string, transcriptId: string, error: unknown) {
  const driver = getDriver();
  if (!driver) {
    return;
  }

  const session = driver.session({ database: getDatabaseName() });

  try {
    await session.run(
      `
        merge (load:TranscriptGraphLoad {id: $loadId})
        set load.transcriptId = $transcriptId,
            load.status = "failed",
            load.error = $error,
            load.failedAt = datetime()
      `,
      {
        loadId,
        transcriptId,
        error: error instanceof Error ? error.message : "Unknown graph insertion error.",
      }
    );
  } finally {
    await session.close();
  }
}
