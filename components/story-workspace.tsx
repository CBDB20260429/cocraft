"use client";

import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import {
  Check,
  Database,
  Play,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlayLayerNode, PlayModeGraph } from "@/lib/play-mode-types";
import type { TranscriptGraphDraft } from "@/lib/story-graph-types";
import { Switch } from "@/components/ui/switch";
import styles from "./story-workspace.module.css";

type LoadStatus = {
  transcriptId: string;
  status: "not_loaded" | "loaded" | "failed";
  loadedAt: string | null;
  nodeCount: number;
  linkCount: number;
  error: string | null;
};

type TranscriptListItem = {
  id: string;
  fileName: string;
  localPath: string;
  title: string;
  sourceUrl: string | null;
  campaign: string | null;
  episodeNumber: number | null;
  code: string | null;
  lineCount: number;
  sizeBytes: number;
  loadStatus: LoadStatus;
};

type PreviewNodeData = {
  label: string;
  kind: string;
  detail: string;
};

type DataGraph = {
  nodes: Node<PreviewNodeData>[];
  edges: Edge[];
};

type PlayTimelineNode = {
  id: string;
  label: string;
  detail: string;
  x: number;
  y: number;
  kind: string;
  layers: PlayTimelineLayer[];
};

type PlayTimelineLayer = PlayLayerNode & {
  x: number;
  y: number;
};

type ActivityLog = {
  id: string;
  level: "info" | "success" | "error";
  message: string;
  timestamp: string;
};

type DisplayMode = "data" | "play";

type ExtractionResponse = {
  requestId?: string;
  transcript: {
    id: string;
    fileName: string;
    title: string;
    code: string | null;
    lineCount: number;
  };
  draft: TranscriptGraphDraft;
  debug?: {
    provider: string;
    model: string;
    transcriptChars: number;
    promptTranscriptChars: number;
    truncated: boolean;
    durationMs: number;
    responseId: string | null;
    outputChars: number;
  };
};

type ApiErrorPayload = {
  error?: string;
  requestId?: string;
  durationMs?: number;
  issues?: unknown;
};

const previewGroups: Array<{
  key: keyof TranscriptGraphDraft;
  label: string;
  kind: string;
  x: number;
}> = [
  { key: "characters", label: "Character", kind: "character", x: 260 },
  { key: "places", label: "Place", kind: "place", x: 500 },
  { key: "quests", label: "Quest", kind: "quest", x: 740 },
  { key: "conflicts", label: "Conflict", kind: "conflict", x: 980 },
  { key: "scenes", label: "Scene", kind: "scene", x: 1220 },
  { key: "revelations", label: "Revelation", kind: "revelation", x: 1460 },
];

export function StoryWorkspace() {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("data");
  const [transcripts, setTranscripts] = useState<TranscriptListItem[]>([]);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TranscriptGraphDraft | null>(null);
  const [draftText, setDraftText] = useState("");
  const [dataGraph, setDataGraph] = useState<DataGraph>({ nodes: [], edges: [] });
  const [playGraph, setPlayGraph] = useState<PlayModeGraph | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDataGraph, setIsLoadingDataGraph] = useState(false);
  const [isLoadingPlayGraph, setIsLoadingPlayGraph] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playGraphError, setPlayGraphError] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  const addActivity = useCallback((level: ActivityLog["level"], activityMessage: string) => {
    setActivityLogs((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        level,
        message: activityMessage,
        timestamp: new Date().toLocaleTimeString(),
      },
      ...current,
    ].slice(0, 80));
  }, []);

  const refreshTranscripts = useCallback(async () => {
    setIsLoadingList(true);
    setError(null);
    addActivity("info", "Refreshing transcript folder and graph load statuses.");

    try {
      const response = await fetch("/api/transcripts");
      if (!response.ok) {
        throw new Error("Could not load transcripts.");
      }

      const payload = (await response.json()) as { transcripts: TranscriptListItem[] };
      setTranscripts(payload.transcripts);
      setSelectedTranscriptId((current) => current ?? payload.transcripts[0]?.id ?? null);
      addActivity("success", `Loaded ${payload.transcripts.length} transcript records.`);
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : "Could not load transcripts.";
      setError(errorMessage);
      addActivity("error", errorMessage);
    } finally {
      setIsLoadingList(false);
    }
  }, [addActivity]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refreshTranscripts();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [refreshTranscripts]);

  const selectedTranscript = useMemo(
    () => transcripts.find((transcript) => transcript.id === selectedTranscriptId) ?? null,
    [selectedTranscriptId, transcripts]
  );

  const parsedDraft = useMemo(() => {
    if (!draftText.trim()) {
      return draft;
    }

    try {
      return JSON.parse(draftText) as TranscriptGraphDraft;
    } catch {
      return draft;
    }
  }, [draft, draftText]);

  const preview = useMemo(() => buildPreview(parsedDraft), [parsedDraft]);
  const dataModeGraph = parsedDraft ? preview : dataGraph;
  const playTimeline = useMemo(
    () => buildPlayTimeline(playGraph, parsedDraft, selectedTranscript),
    [playGraph, parsedDraft, selectedTranscript]
  );
  const playFlow = useMemo(() => buildPlayFlow(playTimeline), [playTimeline]);
  const selectedPreviewNode = useMemo(
    () => dataModeGraph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [dataModeGraph.nodes, selectedNodeId]
  );
  const isPlayMode = displayMode === "play";
  const displayModeControl = (
    <label className={styles.modeToggle}>
      <span className={!isPlayMode ? styles.activeModeLabel : ""}>Data</span>
      <Switch
        checked={isPlayMode}
        onCheckedChange={(checked) => setDisplayMode(checked ? "play" : "data")}
        aria-label="Switch display mode"
      />
      <span className={isPlayMode ? styles.activeModeLabel : ""}>Play</span>
    </label>
  );

  useEffect(() => {
    if (!isPlayMode || !selectedTranscript) {
      return;
    }

    let ignore = false;
    const transcript = selectedTranscript;

    async function loadPlayGraph() {
      setIsLoadingPlayGraph(true);
      setPlayGraphError(null);

      try {
        const response = await fetch(`/api/graph/play?transcriptId=${transcript.id}`);
        const payload = (await response.json()) as { graph?: PlayModeGraph; error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Could not load play graph.");
        }

        if (!ignore) {
          setPlayGraph(payload.graph ?? null);
        }
      } catch (caught) {
        if (!ignore) {
          setPlayGraph(null);
          setPlayGraphError(
            caught instanceof Error ? caught.message : "Could not load play graph."
          );
        }
      } finally {
        if (!ignore) {
          setIsLoadingPlayGraph(false);
        }
      }
    }

    void loadPlayGraph();

    return () => {
      ignore = true;
    };
  }, [isPlayMode, selectedTranscript]);

  useEffect(() => {
    if (isPlayMode || !selectedTranscript || draftText.trim()) {
      return;
    }

    let ignore = false;
    const transcript = selectedTranscript;

    async function loadDataGraph() {
      setIsLoadingDataGraph(true);
      setError(null);

      try {
        const response = await fetch(`/api/graph?transcriptId=${transcript.id}`);
        const payload = (await response.json()) as DataGraph | ApiErrorPayload;

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error ? payload.error : "Could not load graph."
          );
        }

        if (!ignore) {
          const graph = payload as DataGraph;
          setDataGraph(graph);
          setSelectedNodeId((current) => {
            if (current && graph.nodes.some((node) => node.id === current)) {
              return current;
            }

            return graph.nodes[0]?.id ?? null;
          });
        }
      } catch (caught) {
        if (!ignore) {
          setDataGraph({ nodes: [], edges: [] });
          setSelectedNodeId(null);
          setError(caught instanceof Error ? caught.message : "Could not load graph.");
        }
      } finally {
        if (!ignore) {
          setIsLoadingDataGraph(false);
        }
      }
    }

    void loadDataGraph();

    return () => {
      ignore = true;
    };
  }, [draftText, isPlayMode, selectedTranscript]);

  async function extractDraft() {
    if (!selectedTranscript || isExtracting) {
      return;
    }

    setIsExtracting(true);
    setDraft(null);
    setDraftText("");
    setSelectedNodeId(null);
    setMessage(null);
    setError(null);
    addActivity(
      "info",
      `Starting OpenAI graph extraction for ${selectedTranscript.code ?? selectedTranscript.title}.`
    );

    try {
      const endpoint = "/api/transcripts/extract";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptId: selectedTranscript.id }),
      });

      const responseText = await response.text();
      const payload = parseJsonResponse(responseText) as ExtractionResponse | ApiErrorPayload | null;

      if (!response.ok) {
        const apiError = payload as ApiErrorPayload | null;
        const requestId = apiError?.requestId ? ` Request ${apiError.requestId}.` : "";
        const responseDetail =
          apiError?.error ??
          responseText.slice(0, 500) ??
          response.statusText ??
          "Transcript extraction failed.";

        throw new Error(
          `Transcript extraction failed (${response.status} ${response.statusText}).${requestId} ${responseDetail}`
        );
      }

      if (!payload || !("draft" in payload)) {
        throw new Error(
          `Transcript extraction returned an unexpected response from ${endpoint}: ${responseText.slice(
            0,
            500
          )}`
        );
      }

      const extraction = payload as ExtractionResponse;
      if (extraction.requestId) {
        addActivity("info", `Extraction request id: ${extraction.requestId}.`);
      }

      if (extraction.debug) {
        addActivity(
          "info",
          `LLM call completed: ${extraction.debug.provider}/${extraction.debug.model}, ${formatNumber(
            extraction.debug.promptTranscriptChars
          )}/${formatNumber(extraction.debug.transcriptChars)} transcript chars, ${
            extraction.debug.truncated ? "truncated" : "full text"
          }, ${formatDuration(extraction.debug.durationMs)}, response ${
            extraction.debug.responseId ?? "unknown"
          }.`
        );
        addActivity(
          "info",
          `LLM output received: ${formatNumber(extraction.debug.outputChars)} characters.`
        );
      }

      setDraft(payload.draft);
      setDraftText(JSON.stringify(payload.draft, null, 2));
      setSelectedNodeId(payload.draft.episode.id);
      setMessage("Draft graph is ready for review.");
      addActivity(
        "success",
        `Draft ready: ${countPreviewObjects(payload.draft)} typed objects and ${payload.draft.links.length} links.`
      );
    } catch (caught) {
      const errorMessage = formatExtractionError(caught);
      setError(errorMessage);
      addActivity("error", errorMessage);
    } finally {
      setIsExtracting(false);
    }
  }

  async function insertDraft() {
    if (!selectedTranscript || !draftText.trim() || isInserting) {
      return;
    }

    let reviewDraft: TranscriptGraphDraft;
    try {
      reviewDraft = JSON.parse(draftText) as TranscriptGraphDraft;
    } catch {
      setError("The review JSON is not valid.");
      addActivity("error", "Insert blocked because the review JSON is not valid.");
      return;
    }

    setIsInserting(true);
    setMessage(null);
    setError(null);
    addActivity(
      "info",
      `Inserting approved graph for ${selectedTranscript.code ?? selectedTranscript.title}.`
    );

    try {
      const response = await fetch("/api/transcripts/insert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcriptId: selectedTranscript.id,
          draft: reviewDraft,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Transcript graph insertion failed.");
      }

      setMessage(
        `Loaded ${selectedTranscript.code ?? selectedTranscript.title}: ${payload.nodeCount} nodes, ${payload.linkCount} links.`
      );
      setPlayGraph(null);
      addActivity(
        "success",
        `Inserted graph: ${payload.nodeCount} nodes and ${payload.linkCount} links.`
      );
      await refreshTranscripts();
    } catch (caught) {
      const errorMessage =
        caught instanceof Error ? caught.message : "Transcript graph insertion failed.";
      setError(errorMessage);
      addActivity("error", errorMessage);
    } finally {
      setIsInserting(false);
    }
  }

  return (
    <main className={styles.appShell} data-display-mode={displayMode}>
      <header className={styles.appHeader}>
        <div className={styles.titleRow}>
          <h1>Cocraft</h1>
          {displayModeControl}
        </div>
      </header>

      {isPlayMode ? (
        <section className={styles.playModePage} aria-label="Play mode">
          <section className={styles.pastPane} aria-label="The past">
            <div className={styles.playPaneHeader}>
              <p>The Past</p>
              <span>
                {isLoadingPlayGraph
                  ? "loading graph"
                  : playGraph
                    ? "Neo4j timeline"
                    : `${playTimeline.nodes.length} moments`}
              </span>
            </div>
            <div className={styles.pastGraph} aria-label="Story progression over time">
              <ReactFlow
                nodes={playFlow.nodes}
                edges={playFlow.edges}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                fitView
                minZoom={0.35}
                maxZoom={1.4}
              >
                <Background />
                <Controls />
              </ReactFlow>
              {playGraphError ? <p className={styles.playGraphNotice}>{playGraphError}</p> : null}
            </div>
          </section>
          <aside className={styles.futurePane} aria-label="Future possibilities">
            <div className={styles.playPaneHeader}>
              <p>Future Possibilities</p>
            </div>
            <div className={styles.futureSketch} aria-hidden="true">
              <svg viewBox="0 0 420 560">
                {futurePlaceholderPaths.map((path, index) => (
                  <path key={index} d={path} />
                ))}
              </svg>
            </div>
          </aside>
        </section>
      ) : (
        <div className={`${styles.shell} ${styles.dataMode}`}>
          <aside className={styles.transcriptPanel} aria-label="Transcript folder">
            <div className={styles.panelHeader}>
              <div>
                <p>Transcript graph loading pipeline</p>
              </div>
              <button className={styles.iconButton} onClick={refreshTranscripts} disabled={isLoadingList}>
                <RefreshCw size={18} aria-hidden="true" />
              </button>
            </div>

        <div className={styles.statusStrip}>
          <span>{transcripts.length} transcripts</span>
          <span>{transcripts.filter((item) => item.loadStatus.status === "loaded").length} loaded</span>
        </div>

        <div className={styles.transcriptList}>
          {transcripts.map((transcript) => (
            <button
              key={transcript.id}
              className={`${styles.transcriptItem} ${
                transcript.id === selectedTranscriptId ? styles.activeTranscript : ""
              }`}
              onClick={() => {
                setSelectedTranscriptId(transcript.id);
                setDraft(null);
                setDraftText("");
                setDataGraph({ nodes: [], edges: [] });
                setSelectedNodeId(null);
                setMessage(null);
                setError(null);
              }}
            >
              <span className={styles.transcriptCode}>{transcript.code}</span>
              <strong>{transcript.title}</strong>
              <span>{transcript.lineCount.toLocaleString()} lines</span>
              <span
                className={statusClass(transcript.loadStatus.status)}
                aria-label={transcript.loadStatus.status === "loaded" ? "Loaded" : "Not loaded"}
                title={transcript.loadStatus.status === "loaded" ? "Loaded" : "Not loaded"}
              >
                {transcript.loadStatus.status === "loaded" ? (
                  <Check size={14} strokeWidth={3} aria-hidden="true" />
                ) : (
                  "?"
                )}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <section className={styles.graphPane} aria-label="Graph review">
        <div className={styles.graphHeader}>
          <div>
            <h2>{selectedTranscript?.title ?? "Select a transcript"}</h2>
            <p>
              {selectedTranscript
                ? isLoadingDataGraph && !draftText.trim()
                  ? `${selectedTranscript.fileName} · loading graph`
                  : `${selectedTranscript.fileName} · ${selectedTranscript.lineCount.toLocaleString()} transcript lines · ${dataModeGraph.nodes.length} graph nodes`
                : "Load a transcript draft, review it, then insert it into Neo4j."}
            </p>
          </div>
          <div className={styles.pipelineActions}>
            <button onClick={extractDraft} disabled={!selectedTranscript || isExtracting || isInserting}>
              <Play size={18} aria-hidden="true" />
              <span>{isExtracting ? "Extracting" : "Load Draft"}</span>
            </button>
            <button
              className={styles.primaryButton}
              onClick={insertDraft}
              disabled={!draftText.trim() || isExtracting || isInserting}
            >
              <Upload size={18} aria-hidden="true" />
              <span>{isInserting ? "Inserting" : "Insert Approved"}</span>
            </button>
          </div>
        </div>

        <div className={styles.graphCanvas}>
          <ReactFlow
            nodes={dataModeGraph.nodes.map((node) => ({
              ...node,
              className: `${styles.storyNode} ${styles[node.data.kind] ?? ""} ${
                node.id === selectedNodeId ? styles.selected : ""
              }`,
            }))}
            edges={dataModeGraph.edges}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        {message ? <p className={styles.success}>{message}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>

      <aside className={styles.reviewPanel} aria-label="Manual graph review">
        <div className={styles.panelSection}>
          <div className={styles.sectionTitle}>
            <Database size={18} aria-hidden="true" />
            <h2>Review</h2>
          </div>
          <div className={styles.nodeCard}>
            <strong>{selectedPreviewNode?.data.label ?? "No graph node selected"}</strong>
            <span>{selectedPreviewNode?.data.kind ?? "draft"}</span>
            <p>{selectedPreviewNode?.data.detail ?? "Load a draft and select nodes to inspect them."}</p>
          </div>
        </div>

        <div className={styles.panelSection}>
          <h2>Draft JSON</h2>
          <textarea
            className={styles.jsonEditor}
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            placeholder="The OpenAI graph draft will appear here for manual review before insertion."
            spellCheck={false}
          />
        </div>
      </aside>

      <section className={styles.activityPanel} aria-label="Activity and debug log">
        <div className={styles.activityHeader}>
          <h2>Activity Log</h2>
          <button
            className={styles.clearLogButton}
            onClick={() => setActivityLogs([])}
            disabled={activityLogs.length === 0}
          >
            Clear
          </button>
        </div>
        <div className={styles.activityList}>
          {activityLogs.length === 0 ? (
            <p>No activity yet.</p>
          ) : (
            activityLogs.map((log) => (
              <div key={log.id} className={`${styles.activityItem} ${logLevelClass(log.level)}`}>
                <time>{log.timestamp}</time>
                <span>{log.level}</span>
                <p>{log.message}</p>
              </div>
            ))
          )}
        </div>
      </section>
        </div>
      )}
    </main>
  );

}

const futurePlaceholderPaths = [
  "M 32 280 C 96 238, 132 166, 210 144 C 276 126, 322 86, 392 54",
  "M 32 280 C 96 270, 138 248, 196 250 C 274 254, 320 226, 390 202",
  "M 32 280 C 96 318, 128 382, 198 404 C 270 426, 320 482, 392 516",
  "M 118 214 C 174 206, 216 184, 266 132",
  "M 154 252 C 208 282, 256 306, 342 300",
  "M 132 342 C 190 322, 230 350, 286 392",
  "M 226 144 C 282 166, 316 176, 384 156",
  "M 220 404 C 276 386, 326 394, 392 424",
];

function buildPlayTimeline(
  playGraph: PlayModeGraph | null,
  draft: TranscriptGraphDraft | null,
  selectedTranscript: TranscriptListItem | null
): { nodes: PlayTimelineNode[] } {
  if (playGraph && playGraph.anchors.length > 0) {
    return buildNeo4jTimeline(playGraph);
  }

  const draftMoments = draft
    ? [
        ...draft.scenes.map((scene) => ({
          id: scene.id,
          label: scene.title,
          detail: scene.summary ?? scene.outcome ?? "Scene",
          order: scene.startSeconds ?? Number.MAX_SAFE_INTEGER,
          kind: "scene",
        })),
        ...draft.events.map((event) => ({
          id: event.id,
          label: event.summary,
          detail: event.consequence ?? "Event",
          order: event.chronologyIndex ?? event.startSeconds ?? Number.MAX_SAFE_INTEGER,
          kind: "event",
        })),
      ]
    : [];

  const moments =
    draftMoments.length > 0
      ? draftMoments
      : [
          {
            id: selectedTranscript?.id ?? "opening",
            label: selectedTranscript?.title ?? "Opening scene",
            detail: "Story begins.",
            order: 0,
            kind: "episode",
          },
          {
            id: "rising-action",
            label: "Rising action",
            detail: "The story gathers pressure.",
            order: 1,
            kind: "beat",
          },
          {
            id: "current-moment",
            label: "Current moment",
            detail: "The table arrives at now.",
            order: 2,
            kind: "now",
          },
        ];

  const orderedMoments = moments
    .sort((left, right) => left.order - right.order)
    .slice(0, 8);
  const lastIndex = Math.max(orderedMoments.length - 1, 1);

  return {
    nodes: orderedMoments.map((moment, index) => ({
      id: moment.id,
      label: truncateLabel(moment.label),
      detail: moment.detail,
      kind: moment.kind,
      x: 92 + (index / lastIndex) * 812,
      y: index % 2 === 0 ? 190 : 370,
      layers: [],
    })),
  };
}

function buildNeo4jTimeline(playGraph: PlayModeGraph): { nodes: PlayTimelineNode[] } {
  const orderedAnchors = playGraph.anchors
    .slice()
    .sort((left, right) => {
      const leftOrder = left.time ?? Number.MAX_SAFE_INTEGER + left.chronologyIndex;
      const rightOrder = right.time ?? Number.MAX_SAFE_INTEGER + right.chronologyIndex;

      return leftOrder - rightOrder;
    })
    .slice(0, 10);
  const lastIndex = Math.max(orderedAnchors.length - 1, 1);

  return {
    nodes: orderedAnchors.map((anchor, index) => {
      const x = 92 + (index / lastIndex) * 812;
      const y = 280;

      return {
        id: anchor.id,
        label: truncateLabel(anchor.label),
        detail: anchor.summary ?? "",
        kind: anchor.kind,
        x,
        y,
        layers: positionPlayLayers(anchor.layers, x),
      };
    }),
  };
}

function positionPlayLayers(layers: PlayLayerNode[], anchorX: number): PlayTimelineLayer[] {
  const above = layers.filter((layer) => layer.side === "above").slice(0, 6);
  const below = layers.filter((layer) => layer.side === "below").slice(0, 6);

  return [
    ...above.map((layer, index) => ({
      ...layer,
      x: anchorX + [-86, 86, -38, 38, -118, 118][index],
      y: [146, 146, 62, 62, -22, -22][index],
    })),
    ...below.map((layer, index) => ({
      ...layer,
      x: anchorX + [-86, 86, -38, 38, -118, 118][index],
      y: [410, 410, 494, 494, 578, 578][index],
    })),
  ];
}

function buildPlayFlow(timeline: { nodes: PlayTimelineNode[] }): {
  nodes: Node<PreviewNodeData>[];
  edges: Edge[];
} {
  const flowNodes: Node<PreviewNodeData>[] = [
    {
      id: "time-axis-start",
      position: { x: 28, y: 342 },
      data: { label: "earlier", kind: "time", detail: "" },
      className: styles.timeMarkerNode,
      selectable: false,
      draggable: false,
    },
    {
      id: "time-axis-end",
      position: { x: 960, y: 342 },
      data: { label: "now", kind: "time", detail: "" },
      className: styles.timeMarkerNode,
      selectable: false,
      draggable: false,
    },
  ];

  const edges: Edge[] = [
    {
      id: "time-axis",
      source: "time-axis-start",
      target: "time-axis-end",
      className: styles.playTimeAxis,
      markerEnd: { type: MarkerType.ArrowClosed },
      selectable: false,
    },
  ];

  timeline.nodes.forEach((node, index) => {
    flowNodes.push({
      id: node.id,
      position: { x: node.x - 82, y: 314 },
      data: {
        label: node.label,
        kind: node.kind,
        detail: node.detail,
      },
      className: styles.playAnchorNode,
      selectable: false,
      draggable: false,
    });

    if (index < timeline.nodes.length - 1) {
      edges.push({
        id: `${node.id}-${timeline.nodes[index + 1].id}`,
        source: node.id,
        target: timeline.nodes[index + 1].id,
        className: styles.playTimelineEdge,
        selectable: false,
      });
    }

    node.layers.forEach((layer) => {
      const layerId = `${node.id}-${layer.id}`;

      flowNodes.push({
        id: layerId,
        position: { x: layer.x - 72, y: layer.y - 28 },
        data: {
          label: layer.label,
          kind: layer.kind,
          detail: layer.detail ?? "",
        },
        className: `${styles.playLayerNode} ${styles[layer.side]}`,
        selectable: false,
        draggable: false,
      });

      edges.push({
        id: `${node.id}-${layer.id}-connector`,
        source: node.id,
        target: layerId,
        className: styles.playLayerEdge,
        selectable: false,
      });
    });
  });

  return { nodes: flowNodes, edges };
}

function buildPreview(draft: TranscriptGraphDraft | null): {
  nodes: Node<PreviewNodeData>[];
  edges: Edge[];
} {
  if (!draft) {
    return { nodes: [], edges: [] };
  }

  const nodes: Node<PreviewNodeData>[] = [
    {
      id: draft.episode.id,
      position: { x: 20, y: 180 },
      data: {
        label: draft.episode.title,
        kind: "episode",
        detail: draft.episode.summary ?? "Episode container for extracted graph data.",
      },
    },
  ];

  for (const group of previewGroups) {
    const values = draft[group.key] as Array<{
      id: string;
      name?: string;
      title?: string;
      summary?: string;
    }>;
    if (!Array.isArray(values)) {
      continue;
    }

    values.slice(0, 7).forEach((value, index) => {
      nodes.push({
        id: value.id,
        position: { x: group.x, y: 30 + index * 120 },
        data: {
          label: value.name ?? value.title ?? group.label,
          kind: group.kind,
          detail: value.summary ?? group.label,
        },
      });
    });
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = draft.links
    .filter((link) => nodeIds.has(link.sourceId) && nodeIds.has(link.targetId))
    .slice(0, 80)
    .map((link, index) => ({
      id: `${link.sourceId}-${link.type}-${link.targetId}-${index}`,
      source: link.sourceId,
      target: link.targetId,
      label: link.type.replaceAll("_", " ").toLowerCase(),
    }));

  return { nodes, edges };
}

function statusClass(status: LoadStatus["status"]) {
  if (status === "loaded") {
    return styles.loadedStatus;
  }

  if (status === "failed") {
    return styles.failedStatus;
  }

  return styles.pendingStatus;
}

function countPreviewObjects(draft: TranscriptGraphDraft) {
  return (
    2 +
    draft.transcriptSpans.length +
    draft.people.length +
    draft.characters.length +
    draft.characterStates.length +
    draft.places.length +
    draft.factions.length +
    draft.items.length +
    draft.arcs.length +
    draft.scenes.length +
    draft.beats.length +
    draft.events.length +
    draft.quests.length +
    draft.conflicts.length +
    draft.revelations.length +
    draft.motivations.length +
    draft.relationships.length +
    draft.themes.length +
    draft.gameMechanics.length
  );
}

function logLevelClass(level: ActivityLog["level"]) {
  if (level === "success") {
    return styles.logSuccess;
  }

  if (level === "error") {
    return styles.logError;
  }

  return styles.logInfo;
}

function parseJsonResponse(responseText: string) {
  if (!responseText.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return null;
  }
}

function formatExtractionError(caught: unknown) {
  if (caught instanceof TypeError && caught.message === "Failed to fetch") {
    return [
      "Network failure while calling /api/transcripts/extract.",
      "The browser did not receive an HTTP response, so check the Network tab and the Next terminal for a matching [transcripts/extract:*] request log.",
    ].join(" ");
  }

  if (caught instanceof Error) {
    return caught.message;
  }

  return "Transcript extraction failed.";
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

function truncateLabel(value: string) {
  return value.length > 54 ? `${value.slice(0, 51)}...` : value;
}
