# Frontend Workspace

The frontend workspace is implemented by `StoryWorkspace` in `components/story-workspace.tsx`. The page entry point, `app/page.tsx`, simply renders this component.

## Responsibilities

The workspace is the operator console for the graph pipeline. It lists transcripts, lets the user select one, starts extraction, presents the model draft for review, inserts approved drafts, shows graph data from Neo4j, and switches into play mode for timeline and future-card exploration.

The UI has two display modes:

- Data mode: transcript list, graph preview/canvas, draft JSON editor, selected-node review, and activity log.
- Play mode: story-so-far timeline on the left and "what's next" future cards on the right.

## Theory Of Operation

The workspace treats the browser as an orchestration surface, not as the source of truth. It owns UI state and calls server routes for privileged work:

- `/api/transcripts` for transcript catalog and load statuses.
- `/api/transcripts/extract` for OpenAI extraction.
- `/api/transcripts/insert` for validated Neo4j insertion.
- `/api/graph` for data-mode graph reads.
- `/api/graph/play` for play-mode timeline reads.
- `/api/graph/future` for future-card generation.

Draft review is optimistic and local. After extraction, the draft object is stored both as parsed state and formatted text. The textarea contents are parsed on each render when possible; a valid edit updates the preview graph before insertion. Invalid JSON does not replace the last valid parsed draft, and insertion is blocked with an error.

## State Model

Important state groups:

- Transcript state: `transcripts`, `selectedTranscriptId`, and loading flags.
- Draft state: `draft`, `draftText`, `isExtracting`, and `isInserting`.
- Data graph state: `dataGraph`, `selectedNodeId`, and `isLoadingDataGraph`.
- Play state: `displayMode`, `playGraph`, `isLoadingPlayGraph`, and `playGraphError`.
- Future state: `futurePredictions`, `selectedFuturePredictionId`, and future loading/error flags.
- Operator feedback: `message`, `error`, and `activityLogs`.

The activity log is intentionally user-facing debug context. It records refreshes, extraction request ids, model/debug metadata, insertion counts, and failures.

## Data-Mode Graph Projection

Data mode can show two kinds of graph:

- Draft preview graph: built in the browser from the current `TranscriptGraphDraft`.
- Persisted graph: fetched from `/api/graph?transcriptId=...`.

The draft preview includes the episode plus a capped set of visible story objects from characters, places, quests, conflicts, scenes, and revelations. Edges are generated from draft links whose endpoints are present in the preview.

The persisted graph uses the server response directly, then passes it through `buildConstellationGraph`. This layout removes the episode node from the visible constellation, groups connected components, selects a stable hub per component, and positions related nodes around that hub using deterministic hashing. The result is not a force simulation; it is a stable visual read model.

## Play-Mode Projection

When the user switches to play mode, the workspace loads `/api/graph/play`. If Neo4j has loaded anchors, `buildNeo4jTimeline` groups moments by episode and places scenes, beats, and events around episode nodes. Detail layers are displayed near each moment.

If no persisted play graph exists, the component falls back to the current draft's scenes and events. If there is no draft either, it renders a simple placeholder progression.

Future cards are loaded when play mode has a selected transcript. The selected card expands to show a small amount of evidence and the first player lever.

## Failure Behavior

The UI favors visible failures over silent degradation:

- Transcript refresh failures appear in the main error area and activity log.
- Extraction failures include HTTP status, request id when available, and response detail.
- Insert is blocked when the JSON editor contains invalid JSON.
- Play graph and future-card failures are shown in their own panes.
