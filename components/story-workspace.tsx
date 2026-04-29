"use client";

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  Check,
  Database,
  Play,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import type { FuturePrediction } from "@/lib/future-prediction-types";
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
  role: "episode" | "moment";
  parentEpisodeId: string | null;
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

type FuturePredictionResponse = {
  predictions: FuturePrediction[];
  debug?: {
    provider: string;
    model: string;
    contextNodeCount: number;
    contextRelationshipCount: number;
    durationMs: number;
    responseId: string | null;
    outputChars: number;
  };
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
  const [isLoadingFuturePredictions, setIsLoadingFuturePredictions] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playGraphError, setPlayGraphError] = useState<string | null>(null);
  const [futurePredictionError, setFuturePredictionError] = useState<string | null>(null);
  const [futurePredictions, setFuturePredictions] = useState<FuturePrediction[]>([]);
  const [selectedFuturePredictionId, setSelectedFuturePredictionId] = useState<string | null>(null);
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
  const graphOverview = useMemo(
    () => buildGraphOverview(dataModeGraph, selectedTranscript, Boolean(parsedDraft)),
    [dataModeGraph, parsedDraft, selectedTranscript]
  );
  const constellationGraph = useMemo(
    () => buildConstellationGraph(dataModeGraph, selectedNodeId),
    [dataModeGraph, selectedNodeId]
  );
  const nodeTypes = useMemo(() => ({ storyDot: StoryDotNode }), []);
  const playTimeline = useMemo(
    () => buildPlayTimeline(playGraph, parsedDraft, selectedTranscript),
    [playGraph, parsedDraft, selectedTranscript]
  );
  const playFlow = useMemo(() => buildPlayFlow(playTimeline), [playTimeline]);
  const selectedPreviewNode = useMemo(
    () => dataModeGraph.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [dataModeGraph.nodes, selectedNodeId]
  );
  const selectedFuturePrediction = useMemo(
    () =>
      futurePredictions.find((prediction) => prediction.id === selectedFuturePredictionId) ??
      futurePredictions[0] ??
      null,
    [futurePredictions, selectedFuturePredictionId]
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
    if (!isPlayMode) {
      return;
    }

    let ignore = false;

    async function loadPlayGraph() {
      setIsLoadingPlayGraph(true);
      setPlayGraphError(null);

      try {
        const response = await fetch("/api/graph/play");
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
  }, [isPlayMode]);

  const loadFuturePredictions = useCallback(async () => {
    if (!selectedTranscript || !isPlayMode) {
      return;
    }

    setIsLoadingFuturePredictions(true);
    setFuturePredictionError(null);
    addActivity(
      "info",
      `Generating future cards for ${selectedTranscript.code ?? selectedTranscript.title}.`
    );

    try {
      const response = await fetch(`/api/graph/future?transcriptId=${selectedTranscript.id}`);
      const payload = (await response.json()) as FuturePredictionResponse | ApiErrorPayload;

      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error ? payload.error : "Could not generate futures."
        );
      }

      const futurePayload = payload as FuturePredictionResponse;
      setFuturePredictions(futurePayload.predictions);
      setSelectedFuturePredictionId(futurePayload.predictions[0]?.id ?? null);

      if (futurePayload.debug) {
        addActivity(
          "success",
          `Generated ${futurePayload.predictions.length} future cards from ${futurePayload.debug.contextNodeCount} graph nodes and ${futurePayload.debug.contextRelationshipCount} relationships.`
        );
      } else {
        addActivity("success", `Generated ${futurePayload.predictions.length} future cards.`);
      }
    } catch (caught) {
      const errorMessage =
        caught instanceof Error ? caught.message : "Could not generate future predictions.";
      setFuturePredictions([]);
      setSelectedFuturePredictionId(null);
      setFuturePredictionError(errorMessage);
      addActivity("error", errorMessage);
    } finally {
      setIsLoadingFuturePredictions(false);
    }
  }, [addActivity, isPlayMode, selectedTranscript]);

  useEffect(() => {
    if (!isPlayMode || !selectedTranscript) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadFuturePredictions();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [isPlayMode, loadFuturePredictions, selectedTranscript]);

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

            return getFirstVisibleGraphNode(graph)?.id ?? null;
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
      setSelectedNodeId(
        getFirstVisibleGraphNode(buildPreview(payload.draft))?.id ?? payload.draft.episode.id
      );
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
          <div className={styles.playPaneGrid}>
          <section className={styles.pastPane} aria-label="The story so far">
            <div className={styles.playPaneHeader}>
              <p>The story so far</p>
              {isLoadingPlayGraph ? <span>loading graph</span> : null}
            </div>
            <div className={styles.pastGraph} aria-label="Story progression over time">
              <ReactFlow
                nodes={playFlow.nodes}
                edges={playFlow.edges}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                fitView
                minZoom={0.05}
                maxZoom={1.4}
              >
                <Background />
                <Controls />
              </ReactFlow>
              {playGraphError ? <p className={styles.playGraphNotice}>{playGraphError}</p> : null}
            </div>
          </section>
          <aside className={styles.futurePane} aria-label="What's next?">
            <div className={styles.playPaneHeader}>
              <p>What&apos;s next?</p>
              <button
                className={styles.iconButton}
                onClick={loadFuturePredictions}
                disabled={!selectedTranscript || isLoadingFuturePredictions}
                title="Regenerate future cards"
                aria-label="Regenerate future cards"
              >
                <RefreshCw size={16} aria-hidden="true" />
              </button>
            </div>
            <div className={styles.futureCards}>
              <svg className={styles.futureBranchMap} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {futureBranchLayouts.map((branch, index) => (
                  <path key={`${branch.path}-${index}`} d={branch.path} />
                ))}
              </svg>
              {isLoadingFuturePredictions ? (
                <div className={styles.futureNotice}>
                  <Sparkles size={18} aria-hidden="true" />
                  <p>Reading the graph pressure and drafting futures.</p>
                </div>
              ) : futurePredictionError ? (
                <div className={styles.futureNotice}>
                  <p>{futurePredictionError}</p>
                </div>
              ) : futurePredictions.length === 0 ? (
                <div className={styles.futureNotice}>
                  <p>Switch to a loaded transcript to generate future cards.</p>
                </div>
              ) : (
                futurePredictions.map((prediction, index) => {
                  const isSelected = prediction.id === selectedFuturePrediction?.id;
                  const branch = futureBranchLayouts[
                    index % futureBranchLayouts.length
                  ];

                  return (
                    <button
                      key={prediction.id}
                      className={`${styles.futureCard} ${styles[prediction.tone]} ${
                        isSelected ? styles.selectedFutureCard : ""
                      }`}
                      style={{
                        left: `${branch.x}%`,
                        top: `${branch.y}%`,
                      }}
                      onClick={() => setSelectedFuturePredictionId(prediction.id)}
                    >
                      <span className={styles.futureCardMeta}>
                        <span>{prediction.probability}</span>
                        <span>{prediction.horizon}</span>
                      </span>
                      <strong>{prediction.title}</strong>
                      <p>{prediction.summary}</p>
                      {isSelected ? (
                        <div className={styles.futureCardDetail}>
                          {prediction.evidence.length > 0 ? (
                            <div className={styles.futureEvidenceList}>
                              {prediction.evidence.slice(0, 2).map((evidence) => (
                                <span key={`${prediction.id}-${evidence.nodeId}`}>
                                  {evidence.reason}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {prediction.playerLevers[0] ? (
                            <span>{prediction.playerLevers[0]}</span>
                          ) : null}
                        </div>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </aside>
          </div>
          {renderActivityLog(activityLogs, () => setActivityLogs([]))}
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
            nodes={constellationGraph.nodes}
            edges={constellationGraph.edges}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
            fitViewOptions={{ padding: 0.16 }}
            minZoom={0.25}
            maxZoom={2.2}
            defaultEdgeOptions={{
              type: "straight",
              selectable: false,
              focusable: false,
            }}
          >
            <Controls />
          </ReactFlow>
        </div>

        {message ? <p className={styles.success}>{message}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>

      <aside className={styles.reviewPanel} aria-label="Graph details">
        <div className={styles.panelSection}>
          <div className={styles.sectionTitle}>
            <Database size={18} aria-hidden="true" />
            <h2>Graph</h2>
          </div>
          <div className={styles.graphOverviewCard}>
            <strong>{graphOverview.title}</strong>
            <p>{graphOverview.detail}</p>
            <dl className={styles.graphStats}>
              {graphOverview.stats.map((stat) => (
                <div key={stat.label}>
                  <dt>{stat.label}</dt>
                  <dd>{stat.value}</dd>
                </div>
              ))}
            </dl>
            {graphOverview.kinds.length > 0 ? (
              <div className={styles.kindList}>
                {graphOverview.kinds.map((kind) => (
                  <span key={kind.label}>
                    {kind.label} <strong>{kind.value}</strong>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.panelSection}>
          <h2>Selected Node</h2>
          <div className={styles.nodeCard}>
            <strong>{selectedPreviewNode?.data.label ?? "No graph node selected"}</strong>
            <span>{selectedPreviewNode?.data.kind ?? "graph"}</span>
            <p>{selectedPreviewNode?.data.detail ?? "Select a graph node to inspect its details."}</p>
          </div>
        </div>
      </aside>

      {renderActivityLog(activityLogs, () => setActivityLogs([]))}
        </div>
      )}
    </main>
  );

}

function renderActivityLog(activityLogs: ActivityLog[], clearActivityLogs: () => void) {
  return (
    <section className={styles.activityPanel} aria-label="Activity and debug log">
      <div className={styles.activityHeader}>
        <h2>Activity Log</h2>
        <button
          className={styles.clearLogButton}
          onClick={clearActivityLogs}
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
  );
}

const futureBranchLayouts = [
  { path: "M 3 50 C 18 42, 26 25, 42 18 C 56 13, 66 12, 78 12", x: 78, y: 12 },
  { path: "M 3 50 C 18 45, 33 36, 46 30 C 58 25, 69 22, 82 19", x: 82, y: 19 },
  { path: "M 3 50 C 22 48, 34 45, 50 45 C 64 45, 73 42, 82 37", x: 82, y: 37 },
  { path: "M 3 50 C 20 54, 34 56, 49 57 C 63 58, 72 55, 82 52", x: 82, y: 52 },
  { path: "M 3 50 C 18 59, 29 70, 43 76 C 58 82, 70 78, 82 72", x: 82, y: 72 },
  { path: "M 3 50 C 16 64, 25 82, 39 88 C 52 94, 66 91, 78 88", x: 78, y: 88 },
  { path: "M 24 36 C 40 31, 49 19, 61 14", x: 61, y: 14 },
  { path: "M 31 49 C 49 40, 57 35, 72 31", x: 72, y: 31 },
  { path: "M 31 54 C 46 60, 58 65, 72 63", x: 72, y: 63 },
  { path: "M 24 64 C 39 74, 51 83, 62 86", x: 62, y: 86 },
  { path: "M 45 30 C 58 34, 65 41, 76 45", x: 76, y: 45 },
  { path: "M 45 75 C 58 70, 67 76, 82 82", x: 82, y: 82 },
];

function StoryDotNode({ data, selected }: NodeProps<Node<PreviewNodeData>>) {
  return (
    <div
      className={`${styles.storyDotNode} ${selected ? styles.selectedDot : ""}`}
      title={`${data.label}${data.detail ? `: ${data.detail}` : ""}`}
      aria-label={`${data.kind}: ${data.label}`}
    >
      <Handle className={styles.dotHandle} type="target" position={Position.Top} />
      <Handle className={styles.dotHandle} type="source" position={Position.Bottom} />
      <span aria-hidden="true" />
    </div>
  );
}

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
      role: "moment",
      parentEpisodeId: null,
      layers: [],
    })),
  };
}

function buildNeo4jTimeline(playGraph: PlayModeGraph): { nodes: PlayTimelineNode[] } {
  const orderedAnchors = playGraph.anchors
    .slice()
    .sort((left, right) => left.chronologyIndex - right.chronologyIndex);
  const episodeGroups = new Map<
    string,
    {
      id: string;
      code: string | null;
      title: string | null;
      anchors: typeof orderedAnchors;
    }
  >();

  for (const anchor of orderedAnchors) {
    const group = episodeGroups.get(anchor.episodeId);

    if (group) {
      group.anchors.push(anchor);
    } else {
      episodeGroups.set(anchor.episodeId, {
        id: anchor.episodeId,
        code: anchor.episodeCode,
        title: anchor.episodeTitle,
        anchors: [anchor],
      });
    }
  }

  const nodes: PlayTimelineNode[] = [];

  Array.from(episodeGroups.values()).forEach((episode, episodeIndex) => {
    const episodeX = 140 + episodeIndex * 420;

    nodes.push({
      id: `episode-${episode.id}`,
      label: truncateLabel(
        [episode.code, episode.title].filter(Boolean).join(": ") || `Episode ${episodeIndex + 1}`
      ),
      detail: `${episode.anchors.length} moments`,
      kind: "episode",
      x: episodeX,
      y: 280,
      role: "episode",
      parentEpisodeId: null,
      layers: [],
    });

    episode.anchors.forEach((anchor, anchorIndex) => {
      const lane = anchorIndex % 2 === 0 ? -1 : 1;
      const row = Math.floor(anchorIndex / 2);
      const x = episodeX + lane * 112;
      const y = 420 + row * 92;

      nodes.push({
        id: anchor.id,
        label: truncateLabel(anchor.label),
        detail: anchor.summary ?? "",
        kind: anchor.kind,
        x,
        y,
        role: "moment",
        parentEpisodeId: `episode-${episode.id}`,
        layers: positionPlayLayers(anchor.layers, x, y),
      });
    });
  });

  return { nodes };
}

function positionPlayLayers(
  layers: PlayLayerNode[],
  anchorX: number,
  anchorY = 280
): PlayTimelineLayer[] {
  const above = layers.filter((layer) => layer.side === "above").slice(0, 2);
  const below = layers.filter((layer) => layer.side === "below").slice(0, 2);

  return [
    ...above.map((layer, index) => ({
      ...layer,
      x: anchorX - 168,
      y: anchorY + index * 58,
    })),
    ...below.map((layer, index) => ({
      ...layer,
      x: anchorX + 168,
      y: anchorY + index * 58,
    })),
  ];
}

function buildPlayFlow(timeline: { nodes: PlayTimelineNode[] }): {
  nodes: Node<PreviewNodeData>[];
  edges: Edge[];
} {
  const episodeNodes = timeline.nodes.filter((node) => node.role === "episode");
  const firstAnchorX = episodeNodes[0]?.x ?? timeline.nodes[0]?.x ?? 120;
  const lastAnchorX = episodeNodes.at(-1)?.x ?? timeline.nodes.at(-1)?.x ?? 900;
  const axisStartX = Math.max(0, firstAnchorX - 120);
  const axisEndX = lastAnchorX + 160;

  const flowNodes: Node<PreviewNodeData>[] = [
    {
      id: "time-axis-start",
      position: { x: axisStartX, y: 342 },
      data: { label: "earlier", kind: "time", detail: "" },
      className: styles.timeMarkerNode,
      selectable: false,
      draggable: false,
    },
    {
      id: "time-axis-end",
      position: { x: axisEndX, y: 342 },
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

  episodeNodes.forEach((node, index) => {
    if (index < episodeNodes.length - 1) {
      edges.push({
        id: `${node.id}-${episodeNodes[index + 1].id}`,
        source: node.id,
        target: episodeNodes[index + 1].id,
        className: styles.playTimelineEdge,
        selectable: false,
      });
    }
  });

  timeline.nodes.forEach((node) => {
    flowNodes.push({
      id: node.id,
      position: { x: node.x - 82, y: node.y + 34 },
      data: {
        label: node.label,
        kind: node.kind,
        detail: node.detail,
      },
      className:
        node.role === "episode"
          ? `${styles.playAnchorNode} ${styles.playEpisodeNode}`
          : styles.playAnchorNode,
      selectable: false,
      draggable: false,
    });

    if (node.parentEpisodeId) {
      edges.push({
        id: `${node.parentEpisodeId}-${node.id}`,
        source: node.parentEpisodeId,
        target: node.id,
        className: styles.playEpisodeStackEdge,
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

function buildConstellationGraph(
  graph: DataGraph,
  selectedNodeId: string | null
): DataGraph {
  const visibleNodes = graph.nodes.filter((node) => node.data.kind.toLowerCase() !== "episode");
  const indexedNodes = new Map(visibleNodes.map((node) => [node.id, node]));
  const adjacency = new Map<string, Set<string>>();

  for (const node of visibleNodes) {
    adjacency.set(node.id, new Set());
  }

  for (const edge of graph.edges) {
    if (!indexedNodes.has(edge.source) || !indexedNodes.has(edge.target)) {
      continue;
    }

    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const components = getConnectedComponents(visibleNodes, adjacency);
  const arrangedNodes = new Map<string, Node<PreviewNodeData>>();
  const centers = getComponentCenters(components.length);

  components.forEach((component, componentIndex) => {
    const center = centers[componentIndex] ?? {
      x: 220 + (componentIndex % 4) * 360,
      y: 180 + Math.floor(componentIndex / 4) * 300,
    };
    const hub = component
      .slice()
      .sort((left, right) => {
        const degreeDelta = (adjacency.get(right.id)?.size ?? 0) - (adjacency.get(left.id)?.size ?? 0);
        return degreeDelta || stableHash(left.id) - stableHash(right.id);
      })[0];
    const orderedNodes = component
      .slice()
      .sort((left, right) => getNodeRadius(left, hub, adjacency) - getNodeRadius(right, hub, adjacency));

    orderedNodes.forEach((node, index) => {
      const radius = getNodeRadius(node, hub, adjacency);
      const angle = getNodeAngle(node.id, index, orderedNodes.length, componentIndex);
      const jitter = (stableHash(`${node.id}-jitter`) % 22) - 11;
      const position =
        node.id === hub.id
          ? center
          : {
              x: center.x + Math.cos(angle) * radius + jitter,
              y: center.y + Math.sin(angle) * radius + jitter * 0.45,
            };

      arrangedNodes.set(node.id, {
        ...node,
        type: "storyDot",
        position,
        draggable: false,
        className: node.id === selectedNodeId ? styles.selectedDot : undefined,
        style: {
          "--node-color": getKindColor(node.data.kind),
        } as CSSProperties,
      });
    });
  });

  return {
    nodes: Array.from(arrangedNodes.values()),
    edges: graph.edges
      .filter((edge) => arrangedNodes.has(edge.source) && arrangedNodes.has(edge.target))
      .map((edge) => ({
        ...edge,
        label: undefined,
        type: "straight",
        animated: false,
        selectable: false,
        focusable: false,
        style: {
          stroke: "rgba(159, 211, 229, 0.34)",
          strokeWidth: 8,
        },
      })),
  };
}

function buildGraphOverview(
  graph: DataGraph,
  selectedTranscript: TranscriptListItem | null,
  isDraftGraph: boolean
) {
  const episodeNode =
    graph.nodes.find((node) => node.data.kind.toLowerCase() === "episode") ?? null;
  const visibleNodes = graph.nodes.filter((node) => node.data.kind.toLowerCase() !== "episode");
  const kindCounts = new Map<string, number>();

  for (const node of visibleNodes) {
    const kind = node.data.kind.toLowerCase();
    kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);
  }

  const kinds = Array.from(kindCounts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));
  const loadedStatus = selectedTranscript?.loadStatus.status.replace("_", " ") ?? "not loaded";

  return {
    title:
      episodeNode?.data.label ??
      selectedTranscript?.title ??
      (isDraftGraph ? "Draft graph" : "No graph selected"),
    detail:
      episodeNode?.data.detail ||
      (selectedTranscript
        ? `${selectedTranscript.fileName} is ${loadedStatus}.`
        : "Select an episode to load graph details."),
    stats: [
      { label: "Nodes", value: graph.nodes.length },
      { label: "Shown", value: visibleNodes.length },
      { label: "Links", value: graph.edges.length },
      { label: "Mode", value: isDraftGraph ? "Draft" : "Loaded" },
    ],
    kinds,
  };
}

function getFirstVisibleGraphNode(graph: DataGraph) {
  return (
    graph.nodes.find((node) => node.data.kind.toLowerCase() !== "episode") ??
    graph.nodes[0] ??
    null
  );
}

function getConnectedComponents(
  nodes: Node<PreviewNodeData>[],
  adjacency: Map<string, Set<string>>
) {
  const remaining = new Set(nodes.map((node) => node.id));
  const components: Node<PreviewNodeData>[][] = [];

  while (remaining.size > 0) {
    const startId = remaining.values().next().value as string;
    const queue = [startId];
    const component: Node<PreviewNodeData>[] = [];
    remaining.delete(startId);

    while (queue.length > 0) {
      const nodeId = queue.shift() as string;
      const node = nodes.find((candidate) => candidate.id === nodeId);
      if (node) {
        component.push(node);
      }

      for (const neighborId of adjacency.get(nodeId) ?? []) {
        if (remaining.has(neighborId)) {
          remaining.delete(neighborId);
          queue.push(neighborId);
        }
      }
    }

    components.push(component);
  }

  return components.sort((left, right) => right.length - left.length);
}

function getComponentCenters(count: number) {
  const baseCenters = [
    { x: 260, y: 210 },
    { x: 650, y: 620 },
    { x: -30, y: 560 },
    { x: 960, y: 300 },
    { x: 710, y: 30 },
    { x: 160, y: 860 },
    { x: 1070, y: 620 },
    { x: 420, y: -90 },
  ];

  if (count <= baseCenters.length) {
    return baseCenters;
  }

  return [
    ...baseCenters,
    ...Array.from({ length: count - baseCenters.length }, (_, index) => ({
      x: 180 + (index % 5) * 260,
      y: 1020 + Math.floor(index / 5) * 240,
    })),
  ];
}

function getNodeRadius(
  node: Node<PreviewNodeData>,
  hub: Node<PreviewNodeData>,
  adjacency: Map<string, Set<string>>
) {
  if (node.id === hub.id) {
    return 0;
  }

  const degree = adjacency.get(node.id)?.size ?? 0;
  if (degree > 3) {
    return 58 + (stableHash(node.id) % 24);
  }

  if (degree > 1) {
    return 96 + (stableHash(node.id) % 42);
  }

  return 145 + (stableHash(node.id) % 74);
}

function getNodeAngle(nodeId: string, index: number, total: number, componentIndex: number) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  return index * goldenAngle + (stableHash(nodeId) % 100) / 100 + componentIndex * 0.72 + total * 0.03;
}

function getKindColor(kind: string) {
  const colors: Record<string, string> = {
    episode: "#ff8b95",
    character: "#ff83ac",
    person: "#ff9d8c",
    place: "#00b894",
    quest: "#00bcd4",
    conflict: "#e260c1",
    scene: "#bfefff",
    event: "#55c7e8",
    revelation: "#f1e77c",
    faction: "#9fa087",
    theme: "#a4a9ff",
    item: "#10bfa4",
    arc: "#f28cc7",
    motivation: "#a8e3ff",
    relationship: "#9c9b7b",
    gamemechanic: "#00a8e0",
  };

  return colors[kind.toLowerCase()] ?? "#9fa087";
}

function stableHash(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
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
