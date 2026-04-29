import { NextResponse } from "next/server";
import type { Node, Relationship } from "neo4j-driver";
import { getDatabaseName, getDriver } from "@/lib/db";

type GraphNodeProperties = {
  id?: string;
  name?: string;
  title?: string;
  summary?: string | null;
  description?: string | null;
};

type GraphRow = {
  node: Node<number, GraphNodeProperties>;
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
];

export async function GET() {
  const driver = getDriver();

  if (!driver) {
    return NextResponse.json({ nodes: [], edges: [] });
  }

  const session = driver.session({ database: getDatabaseName() });

  try {
    const result = await session.run<GraphRow>(
      `
        match (node)
        where any(label in labels(node) where label in $labels)
        optional match (node)-[relationship]->(target)
        where any(label in labels(target) where label in $labels)
        return node, relationship, target
        limit 250
      `,
      { labels: visibleLabels }
    );

    const nodeMap = new Map<number, Node<number, GraphNodeProperties>>();
    const edges = [];

    for (const record of result.records) {
      const node = record.get("node");
      const relationship = record.get("relationship");
      const target = record.get("target");

      nodeMap.set(node.identity, node);

      if (target) {
        nodeMap.set(target.identity, target);
      }

      if (relationship && target) {
        edges.push({
          id: relationship.properties.id
            ? String(relationship.properties.id)
            : String(relationship.identity),
          source: node.properties.id ?? String(node.identity),
          target: target.properties.id ?? String(target.identity),
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
        label: node.properties.name ?? node.properties.title ?? "Untitled",
        kind: node.labels[0]?.toLowerCase() ?? "node",
        detail: node.properties.summary ?? node.properties.description ?? "",
      },
    }));

    return NextResponse.json({ nodes, edges });
  } finally {
    await session.close();
  }
}
