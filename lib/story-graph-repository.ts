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

export type FuturePredictionContextNode = {
  id: string;
  labels: string[];
  label: string;
  summary: string | null;
  status: string | null;
  kind: string;
  time: number | null;
  order: number | null;
  weight: number;
};

export type FuturePredictionContextRelationship = {
  type: string;
  sourceId: string;
  sourceLabel: string;
  targetId: string;
  targetLabel: string;
  summary: string | null;
  status: string | null;
  confidence: number | null;
};

export type FuturePredictionContext = {
  episode: {
    id: string;
    title: string;
    summary: string | null;
  };
  nodes: FuturePredictionContextNode[];
  relationships: FuturePredictionContextRelationship[];
};

const labelSet = new Set<string>(graphLabels);

type NodeCollectionKey =
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

export async function getPlayModeGraph(transcriptId?: string): Promise<PlayModeGraph | null> {
  const driver = getDriver();
  if (!driver) {
    return null;
  }

  const session = driver.session({ database: getDatabaseName() });

  try {
    const result = await session.run(
      `
        match (load:TranscriptGraphLoad {status: "loaded"})
        match (episode:Episode {id: load.transcriptId})
        where $transcriptId is null or episode.id = $transcriptId
        with episode, coalesce(episode.episodeNumber, 1000000000) as episodeOrder
        call {
          with episode, episodeOrder
          match (episode)-[:CONTAINS]->(anchor:Scene)
          return episodeOrder as episodeSort, anchor, labels(anchor) as anchorLabels,
            coalesce(anchor.startSeconds, anchor.endSeconds) as anchorTime,
            coalesce(anchor.startSeconds, anchor.endSeconds, 1000000000) as anchorOrder

          union

          with episode, episodeOrder
          match (episode)-[:HAS_BEAT]->(anchor:Beat)
          return episodeOrder as episodeSort, anchor, labels(anchor) as anchorLabels,
            null as anchorTime,
            coalesce(anchor.order, 1000000000) as anchorOrder

          union

          with episode, episodeOrder
          match (episode)-[:HAS_EVENT]->(anchor:Event)
          return episodeOrder as episodeSort, anchor, labels(anchor) as anchorLabels,
            coalesce(anchor.startSeconds, anchor.endSeconds) as anchorTime,
            coalesce(anchor.chronologyIndex, anchor.startSeconds, anchor.endSeconds, 1000000000) as anchorOrder
        }
        optional match (anchor)-[relationship]-(detail)
        where detail is null or any(label in labels(detail) where label in $detailLabels)
        return episode,
          episodeSort,
          anchor,
          anchorLabels,
          anchorTime,
          anchorOrder,
          collect(distinct {
            node: detail,
            labels: labels(detail),
            relationshipType: type(relationship)
          }) as details
        order by episodeSort asc, anchorOrder asc
      `,
      {
        transcriptId: transcriptId ?? null,
        detailLabels: playDetailLabels,
      }
    );

    if (result.records.length === 0) {
      if (!transcriptId) {
        return null;
      }

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
        transcriptId: transcriptId ?? "story-so-far",
        episode: {
          id: String(episodeProperties.id ?? transcriptId ?? "story-so-far"),
          title: String(episodeProperties.title ?? "Untitled episode"),
          summary: nullableString(episodeProperties.summary),
        },
        anchors: [
          {
            id: String(episodeProperties.id ?? transcriptId),
            label: String(episodeProperties.title ?? "Episode"),
            kind: "episode",
            episodeId: String(episodeProperties.id ?? transcriptId),
            episodeCode: nullableString(episodeProperties.code),
            episodeTitle: nullableString(episodeProperties.title),
            time: null,
            chronologyIndex: 0,
            summary: nullableString(episodeProperties.summary),
            layers: [],
          },
        ],
      };
    }

    const sortedRecords = result.records.slice().sort((left, right) => {
      const leftEpisode = nullableNumber(left.get("episodeSort")) ?? Number.MAX_SAFE_INTEGER;
      const rightEpisode = nullableNumber(right.get("episodeSort")) ?? Number.MAX_SAFE_INTEGER;
      const leftAnchor = nullableNumber(left.get("anchorOrder")) ?? Number.MAX_SAFE_INTEGER;
      const rightAnchor = nullableNumber(right.get("anchorOrder")) ?? Number.MAX_SAFE_INTEGER;

      return leftEpisode - rightEpisode || leftAnchor - rightAnchor;
    });
    const firstEpisode = sortedRecords[0].get("episode").properties;
    const loadedEpisodeCount = new Set(
      sortedRecords.map((record) => String(record.get("episode").properties.id))
    ).size;

    return {
      transcriptId: transcriptId ?? "story-so-far",
      episode: {
        id: transcriptId ? String(firstEpisode.id ?? transcriptId) : "story-so-far",
        title: transcriptId
          ? String(firstEpisode.title ?? "Untitled episode")
          : `Story so far (${loadedEpisodeCount} loaded ${
              loadedEpisodeCount === 1 ? "episode" : "episodes"
            })`,
        summary: transcriptId ? nullableString(firstEpisode.summary) : null,
      },
      anchors: sortedRecords.map((record, index) => {
        const anchor = record.get("anchor");
        const anchorProperties = anchor.properties as Record<string, unknown>;
        const anchorLabels = record.get("anchorLabels") as string[];
        const episodeProperties = record.get("episode").properties as Record<string, unknown>;

        return {
          id: String(anchorProperties.id ?? anchor.identity),
          label: getNodeLabel(anchorProperties, anchorLabels[0] ?? "Moment"),
          kind: getAnchorKind(anchorLabels),
          episodeId: String(episodeProperties.id ?? transcriptId ?? "episode"),
          episodeCode: nullableString(episodeProperties.code),
          episodeTitle: nullableString(episodeProperties.title),
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

export async function getFuturePredictionContext(
  transcriptId: string
): Promise<FuturePredictionContext> {
  const driver = getDriver();
  if (!driver) {
    throw new Error("Neo4j is not configured. Set NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD.");
  }

  const session = driver.session({ database: getDatabaseName() });

  try {
    const result = await session.run(
      `
        match (episode:Episode {id: $transcriptId})
        optional match (episode)-[:CONTAINS|HAS_BEAT|HAS_EVENT]->(anchor)
        with episode, anchor
        order by coalesce(anchor.chronologyIndex, anchor.startSeconds, anchor.endSeconds, anchor.order, 1000000000) desc
        with episode, collect(anchor)[0..24] as recentAnchors
        call {
          with episode, recentAnchors
          unwind recentAnchors as seed
          with seed where seed is not null
          optional match (seed)-[relationship]-(node)
          where any(label in labels(node) where label in $predictionLabels)
          return collect(distinct node) as anchorNodes,
            collect(distinct {
              relationship: relationship,
              source: startNode(relationship),
              target: endNode(relationship)
            }) as anchorRelationships
        }
        call {
          with episode
          match (episode)-[]-(near)-[relationship]-(node)
          where any(label in labels(near) where label in $predictionLabels)
            and any(label in labels(node) where label in $predictionLabels)
            and (
              type(relationship) in $pressureRelationships
              or coalesce(node.status, near.status, "") in $openStatuses
            )
          return collect(distinct node)[0..80] as pressureNodes,
            collect(distinct {
              relationship: relationship,
              source: startNode(relationship),
              target: endNode(relationship)
            })[0..140] as pressureRelationships
        }
        with episode,
          [node in recentAnchors where node is not null] + anchorNodes + pressureNodes as rawNodes,
          anchorRelationships + pressureRelationships as rawRelationships
        unwind rawNodes as node
        with episode, collect(distinct node)[0..120] as nodes, rawRelationships
        return episode,
          nodes,
          [relationship in rawRelationships where relationship.relationship is not null][0..180] as relationships
      `,
      {
        transcriptId,
        predictionLabels: playDetailLabels,
        pressureRelationships: [
          "FORESHADOWS",
          "ENABLES",
          "COMPLICATES",
          "THREATENS",
          "SEEKS",
          "DRIVEN_BY",
          "BLOCKS_QUEST",
          "ADVANCES_QUEST",
          "OPPOSES",
          "REVEALED_IN",
          "REVEALS_TO",
        ],
        openStatuses: ["open", "active", "unresolved", "ongoing", "unknown"],
      }
    );

    if (result.records.length === 0) {
      return await getWholeGraphFuturePredictionContext(session, transcriptId);
    }

    const record = result.records[0];
    const episode = record.get("episode");
    const episodeProperties = episode.properties as Record<string, unknown>;
    const rawNodes = readDistinctNodes(record.get("nodes"));
    const rawRelationships = readDistinctRelationships(record.get("relationships"));
    const contextNodes = rawNodes.map(readContextNode).sort((left, right) => right.weight - left.weight);
    const nodeIds = new Set(contextNodes.map((node) => node.id));
    const contextRelationships = rawRelationships
      .map(readContextRelationship)
      .filter((relationship) => nodeIds.has(relationship.sourceId) && nodeIds.has(relationship.targetId));

    return {
      episode: {
        id: String(episodeProperties.id ?? transcriptId),
        title: String(episodeProperties.title ?? "Untitled episode"),
        summary: nullableString(episodeProperties.summary),
      },
      nodes: contextNodes,
      relationships: contextRelationships,
    };
  } finally {
    await session.close();
  }
}

async function getWholeGraphFuturePredictionContext(
  session: { run: (query: string, parameters?: Record<string, unknown>) => Promise<{ records: Array<{ get: (key: string) => unknown }> }> },
  focusTranscriptId: string
): Promise<FuturePredictionContext> {
  const result = await session.run(
    `
      optional match (anchor)
      where any(label in labels(anchor) where label in ["Scene", "Beat", "Event"])
      with anchor
      order by coalesce(anchor.chronologyIndex, anchor.startSeconds, anchor.endSeconds, anchor.order, 1000000000) desc
      limit 36
      with [node in collect(anchor) where node is not null] as recentAnchors
      call {
        with recentAnchors
        unwind recentAnchors as seed
        optional match (seed)-[relationship]-(node)
        where any(label in labels(node) where label in $predictionLabels)
        return collect(distinct node) as anchorNodes,
          collect(distinct {
            relationship: relationship,
            source: startNode(relationship),
            target: endNode(relationship)
          }) as anchorRelationships
      }
      call {
        match (near)-[relationship]-(node)
        where any(label in labels(near) where label in $predictionLabels)
          and any(label in labels(node) where label in $predictionLabels)
          and (
            type(relationship) in $pressureRelationships
            or coalesce(node.status, near.status, "") in $openStatuses
          )
        return collect(distinct node)[0..120] as pressureNodes,
          collect(distinct {
            relationship: relationship,
            source: startNode(relationship),
            target: endNode(relationship)
          })[0..220] as pressureRelationships
      }
      with [node in recentAnchors where node is not null] + anchorNodes + pressureNodes as rawNodes,
        anchorRelationships + pressureRelationships as rawRelationships
      unwind rawNodes as node
      with collect(distinct node)[0..160] as nodes, rawRelationships
      return nodes,
        [relationship in rawRelationships where relationship.relationship is not null][0..240] as relationships
    `,
    {
      predictionLabels: playDetailLabels,
      pressureRelationships: [
        "FORESHADOWS",
        "ENABLES",
        "COMPLICATES",
        "THREATENS",
        "SEEKS",
        "DRIVEN_BY",
        "BLOCKS_QUEST",
        "ADVANCES_QUEST",
        "OPPOSES",
        "REVEALED_IN",
        "REVEALS_TO",
      ],
      openStatuses: ["open", "active", "unresolved", "ongoing", "unknown"],
    }
  );

  const record = result.records[0];
  const rawNodes = record ? readDistinctNodes(record.get("nodes")) : [];
  const rawRelationships = record ? readDistinctRelationships(record.get("relationships")) : [];
  const contextNodes = rawNodes.map(readContextNode).sort((left, right) => right.weight - left.weight);
  const nodeIds = new Set(contextNodes.map((node) => node.id));
  const contextRelationships = rawRelationships
    .map(readContextRelationship)
    .filter((relationship) => nodeIds.has(relationship.sourceId) && nodeIds.has(relationship.targetId));

  return {
    episode: {
      id: focusTranscriptId,
      title: "Whole story graph",
      summary: "Future predictions are based on the full loaded graph because the selected transcript was not found as a focused episode.",
    },
    nodes: contextNodes,
    relationships: contextRelationships,
  };
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
  linkCount += await upsertEpisodeCollectionLinks(tx, episodeId, "HAS_EVENT", "Event", draft.events);
  linkCount += await upsertEpisodeCollectionLinks(tx, episodeId, "HAS_BEAT", "Beat", draft.beats);
  linkCount += await upsertEpisodeCollectionLinks(tx, episodeId, "CONTAINS", "Scene", draft.scenes);
  linkCount += await upsertSceneEventLinks(tx, episodeId);

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
  type: "HAS_EVENT" | "HAS_BEAT" | "CONTAINS",
  targetLabel: "Event" | "Beat" | "Scene",
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

async function upsertSceneEventLinks(
  tx: { run: (query: string, parameters?: Record<string, unknown>) => Promise<unknown> },
  episodeId: string
) {
  const result = await tx.run(
    `
      match (scene:Scene {episodeId: $episodeId})
      match (event:Event {episodeId: $episodeId})
      where scene.startSeconds is not null
        and scene.endSeconds is not null
        and (
          (event.startSeconds is not null and event.startSeconds >= scene.startSeconds and event.startSeconds <= scene.endSeconds)
          or (event.endSeconds is not null and event.endSeconds >= scene.startSeconds and event.endSeconds <= scene.endSeconds)
          or (
            event.startSeconds is not null
            and event.endSeconds is not null
            and event.startSeconds <= scene.startSeconds
            and event.endSeconds >= scene.endSeconds
          )
        )
      merge (scene)-[relationship:HAS_EVENT]->(event)
      set relationship.updatedAt = datetime(),
          relationship.createdAt = coalesce(relationship.createdAt, datetime()),
          relationship.inferredFromTiming = true
      return count(relationship) as relationshipCount
    `,
    { episodeId }
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

function readDistinctNodes(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value.filter((node) => {
    if (!node || typeof node !== "object" || !("properties" in node) || !("labels" in node)) {
      return false;
    }

    const properties = node.properties as Record<string, unknown>;
    const id = String(properties.id ?? getNodeIdentity(node));

    if (seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

function readDistinctRelationships(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value.filter((entry) => {
    if (!entry || typeof entry !== "object" || !("relationship" in entry)) {
      return false;
    }

    const relationship = entry.relationship;
    if (!relationship || typeof relationship !== "object" || !("type" in relationship)) {
      return false;
    }

    const id =
      "identity" in relationship
        ? String(relationship.identity)
        : `${String(relationship.type)}-${seen.size}`;

    if (seen.has(id)) {
      return false;
    }

    seen.add(id);
    return true;
  });
}

function readContextNode(node: unknown): FuturePredictionContextNode {
  const labels = node && typeof node === "object" && "labels" in node && Array.isArray(node.labels)
    ? node.labels.map(String)
    : [];
  const properties =
    node && typeof node === "object" && "properties" in node
      ? (node.properties as Record<string, unknown>)
      : {};
  const kind = labels[0] ?? "Node";
  const status = nullableString(properties.status ?? properties.certainty);
  const time = nullableNumber(properties.startSeconds ?? properties.endSeconds);
  const order = nullableNumber(properties.chronologyIndex ?? properties.order);

  return {
    id: String(properties.id ?? getNodeIdentity(node)),
    labels,
    label: getNodeLabel(properties, kind),
    summary: nullableString(
      properties.summary ??
        properties.description ??
        properties.objective ??
        properties.stakes ??
        properties.consequence ??
        properties.impact
    ),
    status,
    kind: kind.toLowerCase(),
    time,
    order,
    weight: scoreContextNode(kind, properties, status, time, order),
  };
}

function readContextRelationship(entry: unknown): FuturePredictionContextRelationship {
  const record = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
  const relationship =
    record.relationship && typeof record.relationship === "object"
      ? (record.relationship as Record<string, unknown>)
      : {};
  const properties =
    "properties" in relationship && relationship.properties && typeof relationship.properties === "object"
      ? (relationship.properties as Record<string, unknown>)
      : {};
  const source = record.source;
  const target = record.target;
  const sourceProperties =
    source && typeof source === "object" && "properties" in source
      ? (source.properties as Record<string, unknown>)
      : {};
  const targetProperties =
    target && typeof target === "object" && "properties" in target
      ? (target.properties as Record<string, unknown>)
      : {};
  const sourceLabels =
    source && typeof source === "object" && "labels" in source && Array.isArray(source.labels)
      ? source.labels.map(String)
      : [];
  const targetLabels =
    target && typeof target === "object" && "labels" in target && Array.isArray(target.labels)
      ? target.labels.map(String)
      : [];

  return {
    type: "type" in relationship ? String(relationship.type) : "RELATED_TO",
    sourceId: String(sourceProperties.id ?? getNodeIdentity(source)),
    sourceLabel: getNodeLabel(sourceProperties, sourceLabels[0] ?? "Node"),
    targetId: String(targetProperties.id ?? getNodeIdentity(target)),
    targetLabel: getNodeLabel(targetProperties, targetLabels[0] ?? "Node"),
    summary: nullableString(properties.summary),
    status: nullableString(properties.status),
    confidence: nullableNumber(properties.confidence),
  };
}

function scoreContextNode(
  kind: string,
  properties: Record<string, unknown>,
  status: string | null,
  time: number | null,
  order: number | null
) {
  let score = 0;

  if (["Quest", "Conflict", "Motivation", "Revelation", "Relationship"].includes(kind)) {
    score += 4;
  }

  if (["Character", "CharacterState", "Faction", "Place", "Item"].includes(kind)) {
    score += 2;
  }

  if (status && ["open", "active", "unresolved", "ongoing", "unknown"].includes(status.toLowerCase())) {
    score += 4;
  }

  if (properties.stakes || properties.moralPressure || properties.knownObstacles) {
    score += 2;
  }

  if (typeof time === "number") {
    score += Math.max(0, 3 - time / 10_000);
  }

  if (typeof order === "number") {
    score += Math.max(0, 3 - order / 20);
  }

  return score;
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

  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Number(value);
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
