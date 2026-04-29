"use client";

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileText,
  Play,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type ActivityLog = {
  id: string;
  level: "info" | "success" | "error";
  message: string;
  timestamp: string;
};

type DisplayMode = "data" | "play";

type ExtractionResponse = {
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const selectedPreviewNode = useMemo(
    () => preview.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [preview.nodes, selectedNodeId]
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
      const response = await fetch("/api/transcripts/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcriptId: selectedTranscript.id }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Transcript extraction failed.");
      }

      const extraction = payload as ExtractionResponse;
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
      const errorMessage =
        caught instanceof Error ? caught.message : "Transcript extraction failed.";
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
          <div className={styles.playModeCenter}>play</div>
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
                setSelectedNodeId(null);
                setMessage(null);
                setError(null);
              }}
            >
              <span className={styles.transcriptCode}>{transcript.code}</span>
              <strong>{transcript.title}</strong>
              <span>{transcript.lineCount.toLocaleString()} lines</span>
              <span className={statusClass(transcript.loadStatus.status)}>
                {transcript.loadStatus.status === "loaded" ? (
                  <CheckCircle2 size={14} aria-hidden="true" />
                ) : transcript.loadStatus.status === "failed" ? (
                  <AlertTriangle size={14} aria-hidden="true" />
                ) : (
                  <FileText size={14} aria-hidden="true" />
                )}
                {transcript.loadStatus.status.replace("_", " ")}
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
                ? `${selectedTranscript.fileName} · ${selectedTranscript.lineCount.toLocaleString()} transcript lines`
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
            nodes={preview.nodes.map((node) => ({
              ...node,
              className: `${styles.storyNode} ${styles[node.data.kind] ?? ""} ${
                node.id === selectedNodeId ? styles.selected : ""
              }`,
            }))}
            edges={preview.edges}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
          >
            <Background />
            <MiniMap pannable zoomable />
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

function formatNumber(value: number) {
  return value.toLocaleString();
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}
