"use client";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { GitBranch, Send, Sparkles } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import styles from "./story-workspace.module.css";

type StoryNodeData = {
  label: string;
  kind: "history" | "current" | "future";
  detail: string;
};

type StoryResponse = {
  sessionId: string;
  narrative: string;
  nodes: Array<{
    id: string;
    label: string;
    kind: StoryNodeData["kind"];
    detail: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
  }>;
};

const initialNodes: Node<StoryNodeData>[] = [
  {
    id: "opening",
    position: { x: 0, y: 120 },
    data: {
      label: "Opening image",
      kind: "history",
      detail: "A quiet threshold where the first decision will bend the story.",
    },
    type: "default",
  },
  {
    id: "now",
    position: { x: 300, y: 120 },
    data: {
      label: "Current scene",
      kind: "current",
      detail: "The user and system are ready to co-create the next beat.",
    },
    type: "default",
  },
  {
    id: "future-a",
    position: { x: 620, y: 40 },
    data: {
      label: "Possible future",
      kind: "future",
      detail: "A branch formed by curiosity, pressure, or a new constraint.",
    },
    type: "default",
  },
  {
    id: "future-b",
    position: { x: 620, y: 210 },
    data: {
      label: "Hidden cost",
      kind: "future",
      detail: "A second path that asks what the story is willing to risk.",
    },
    type: "default",
  },
];

const initialEdges: Edge[] = [
  { id: "opening-now", source: "opening", target: "now", label: "continues" },
  { id: "now-future-a", source: "now", target: "future-a", label: "could become" },
  { id: "now-future-b", source: "now", target: "future-b", label: "could reveal" },
];

const kindClass: Record<StoryNodeData["kind"], string> = {
  history: styles.history,
  current: styles.current,
  future: styles.future,
};

export function StoryWorkspace() {
  const [nodes, setNodes] = useState<Node<StoryNodeData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string>("now");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [narrative, setNarrative] = useState(
    "Choose a node, add an action, and let the harness produce the next story movement."
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

  const nodeTypes = useMemo(() => ({}), []);

  const onNodeClick = useCallback((_: unknown, node: Node<StoryNodeData>) => {
    setSelectedNodeId(node.id);
  }, []);

  async function submitAction() {
    if (!action.trim() || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          sessionId,
          selectedNodeId,
        }),
      });

      if (!response.ok) {
        throw new Error("Story generation failed.");
      }

      const payload = (await response.json()) as StoryResponse;
      setSessionId(payload.sessionId);
      setNarrative(payload.narrative);
      setNodes(
        payload.nodes.map((node, index) => ({
          id: node.id,
          position: { x: 40 + index * 260, y: index % 2 === 0 ? 85 : 235 },
          data: {
            label: node.label,
            kind: node.kind,
            detail: node.detail,
          },
        }))
      );
      setEdges(payload.edges);
      setSelectedNodeId(payload.nodes.at(-1)?.id ?? selectedNodeId);
      setAction("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Story generation failed.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className={styles.shell}>
      <section className={styles.graphPane} aria-label="Story graph">
        <div className={styles.graphHeader}>
          <div>
            <h1>Cocraft</h1>
            <p>Story state, narrative branches, and possible futures.</p>
          </div>
          <div className={styles.sessionBadge}>
            <GitBranch size={16} aria-hidden="true" />
            <span>{sessionId ? sessionId.slice(0, 8) : "new session"}</span>
          </div>
        </div>

        <div className={styles.graphCanvas}>
          <ReactFlow
            nodes={nodes.map((node) => ({
              ...node,
              className: `${styles.storyNode} ${kindClass[node.data.kind]} ${
                node.id === selectedNodeId ? styles.selected : ""
              }`,
            }))}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            fitView
          >
            <Background />
            <MiniMap pannable zoomable />
            <Controls />
          </ReactFlow>
        </div>
      </section>

      <aside className={styles.sidePanel} aria-label="Narrative controls">
        <div className={styles.panelSection}>
          <div className={styles.sectionTitle}>
            <Sparkles size={18} aria-hidden="true" />
            <h2>Selected Node</h2>
          </div>
          <div className={styles.nodeCard}>
            <strong>{selectedNode?.data.label ?? "No node selected"}</strong>
            <span>{selectedNode?.data.kind ?? "unknown"}</span>
            <p>{selectedNode?.data.detail ?? "Select a graph node to inspect its context."}</p>
          </div>
        </div>

        <div className={styles.panelSection}>
          <h2>Narrative</h2>
          <p className={styles.narrative}>{narrative}</p>
        </div>

        <div className={styles.composer}>
          <label htmlFor="story-action">Action</label>
          <textarea
            id="story-action"
            value={action}
            onChange={(event) => setAction(event.target.value)}
            placeholder="What does the user try, choose, reveal, or forbid?"
            rows={6}
          />
          {error ? <p className={styles.error}>{error}</p> : null}
          <button onClick={submitAction} disabled={isLoading || !action.trim()}>
            <Send size={18} aria-hidden="true" />
            <span>{isLoading ? "Generating" : "Continue"}</span>
          </button>
        </div>
      </aside>
    </main>
  );
}
