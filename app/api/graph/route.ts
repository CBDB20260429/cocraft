import { NextResponse } from "next/server";
import type { Node, Relationship } from "neo4j-driver";
import { getDatabaseName, getDriver } from "@/lib/db";

type GraphNodeProperties = {
  id?: string;
  name?: string;
  title?: string;
  label?: string;
  summary?: string | null;
  description?: string | null;
  objective?: string | null;
  status?: string | null;
};

type GraphRow = {
  source: Node<number, GraphNodeProperties>;
  target: Node<number, GraphNodeProperties> | null;
  relationship: Relationship<number, Record<string, unknown>> | null;
};

const visibleLabels = [
  "Episode",
  "Character",
  "Place",
  "Quest",
  "Conflict",
  "Scene",
  "Event",
  "Revelation",
  "Faction",
  "Theme",
  "TranscriptSpan",
  "Person",
  "Item",
  "Arc",
  "Motivation",
  "Relationship",
  "GameMechanic",
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const transcriptId = url.searchParams.get("transcriptId");
  const driver = getDriver();

  if (!driver) {
    return NextResponse.json({ nodes: [], edges: [] });
  }

  const session = driver.session({ database: getDatabaseName() });

  try {
    const result = transcriptId
      ? await session.run<GraphRow>(
          `
            match (episode:Episode {id: $transcriptId})
            call {
              with episode
              match (episode)-[relationship]-(target)
              where any(label in labels(target) where label in $labels)
              return relationship

              union

              with episode
              match (episode)-[]-(middle)-[relationship]-(target)
              where any(label in labels(middle) where label in $labels)
                and any(label in labels(target) where label in $labels)
              return relationship
            }
            with distinct relationship
            return startNode(relationship) as source, relationship, endNode(relationship) as target
            limit 300
          `,
          { labels: visibleLabels, transcriptId }
        )
      : await session.run<GraphRow>(
          `
            match (source)-[relationship]->(target)
            where any(label in labels(source) where label in $labels)
              and any(label in labels(target) where label in $labels)
            return source, relationship, target
            limit 250
          `,
          { labels: visibleLabels }
        );

    const nodeMap = new Map<string, Node<number, GraphNodeProperties>>();
    const edgeMap = new Map<string, { id: string; source: string; target: string; label: string }>();

    for (const record of result.records) {
      const source = record.get("source");
      const relationship = record.get("relationship");
      const target = record.get("target");

      nodeMap.set(getNodeId(source), source);

      if (target) {
        nodeMap.set(getNodeId(target), target);
      }

      if (relationship && target) {
        const edgeId = relationship.properties.id
          ? String(relationship.properties.id)
          : String(relationship.identity);

        edgeMap.set(edgeId, {
          id: edgeId,
          source: getNodeId(source),
          target: getNodeId(target),
          label: relationship.type.replaceAll("_", " ").toLowerCase(),
        });
      }
    }

    const nodes = Array.from(nodeMap.values()).map((node, index) => ({
      id: node.properties.id ?? String(node.identity),
      position: {
        x: 80 + (index % 5) * 240,
        y: 80 + Math.floor(index / 5) * 150,
      },
      data: {
        label:
          node.properties.name ??
          node.properties.title ??
          node.properties.label ??
          node.properties.summary ??
          "Untitled",
        kind: node.labels[0]?.toLowerCase() ?? "node",
        detail:
          node.properties.summary ??
          node.properties.description ??
          node.properties.objective ??
          node.properties.status ??
          "",
      },
    }));

    return NextResponse.json({ nodes, edges: Array.from(edgeMap.values()) });
  } finally {
    await session.close();
  }
}

function getNodeId(node: Node<number, GraphNodeProperties>) {
  return node.properties.id ?? String(node.identity);
}
