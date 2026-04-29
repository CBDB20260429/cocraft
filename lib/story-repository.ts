import { randomUUID } from "crypto";
import { getDatabaseName, getDriver } from "@/lib/db";
import type { StoryStep } from "@/lib/story-agent";

export async function saveStoryStep(step: StoryStep, action: string) {
  const driver = getDriver();
  if (!driver) {
    return;
  }

  const session = driver.session({ database: getDatabaseName() });

  try {
    await session.executeWrite(async (tx) => {
      await tx.run(
        `
          merge (s:StorySession {id: $sessionId})
          on create set s.createdAt = datetime()
          set s.updatedAt = datetime()
        `,
        { sessionId: step.sessionId }
      );

      await tx.run(
        `
          match (s:StorySession {id: $sessionId})
          create (t:NarrativeTurn {
            id: $turnId,
            userAction: $action,
            narrative: $narrative,
            createdAt: datetime()
          })
          create (s)-[:HAS_TURN]->(t)
        `,
        {
          sessionId: step.sessionId,
          turnId: randomUUID(),
          action,
          narrative: step.narrative,
        }
      );

      for (const node of step.nodes) {
        await tx.run(
          `
            match (s:StorySession {id: $sessionId})
            merge (n:StoryNode {id: $nodeId})
            on create set n.createdAt = datetime()
            set
              n.label = $label,
              n.kind = $kind,
              n.detail = $detail,
              n.updatedAt = datetime()
            merge (s)-[:HAS_NODE]->(n)
          `,
          {
            sessionId: step.sessionId,
            nodeId: node.id,
            label: node.label,
            kind: node.kind,
            detail: node.detail,
          }
        );
      }

      for (const edge of step.edges) {
        await tx.run(
          `
            match (source:StoryNode {id: $sourceId})
            match (target:StoryNode {id: $targetId})
            merge (source)-[r:STORY_EDGE {id: $edgeId}]->(target)
            on create set r.createdAt = datetime()
            set
              r.sessionId = $sessionId,
              r.label = $label,
              r.updatedAt = datetime()
          `,
          {
            sessionId: step.sessionId,
            edgeId: edge.id,
            sourceId: edge.source,
            targetId: edge.target,
            label: edge.label ?? null,
          }
        );
      }

      await tx.run(
        `
          match (s:StorySession {id: $sessionId})
          create (snapshot:StateSnapshot {
            id: $snapshotId,
            payload: $payload,
            createdAt: datetime()
          })
          create (s)-[:HAS_SNAPSHOT]->(snapshot)
        `,
        {
          sessionId: step.sessionId,
          snapshotId: randomUUID(),
          payload: JSON.stringify(step),
        }
      );
    });
  } finally {
    await session.close();
  }
}
