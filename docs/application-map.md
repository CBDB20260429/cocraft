# Application Map

Cocraft is a Next.js application for turning actual-play transcript files into a reviewed story graph, persisting that graph in Neo4j, and using the graph to support exploratory story review and speculative future cards.

The application has seven major parts:

- Frontend workspace: the browser UI in `components/story-workspace.tsx` and `components/story-workspace.module.css`.
- Transcript catalog and parser: local file discovery and timestamped line parsing in `lib/transcripts.ts`.
- Transcript graph extraction: the OpenAI-backed draft generator in `lib/transcript-graph-agent.ts`.
- Story graph model: Zod schemas and allowed labels/relationship types in `lib/story-graph-types.ts`.
- Neo4j repository: persistence, load status, play graph, and future-context queries in `lib/story-graph-repository.ts`.
- API layer: Next route handlers in `app/api/**`.
- Play mode and future prediction: the timeline projection plus OpenAI future-card generation in `lib/future-prediction-agent.ts`.

## Theory Of Operation

The system is deliberately staged instead of fully automatic. Transcript text is read from disk, transformed into a structured draft by an LLM, shown to the user as editable JSON, and only then inserted into Neo4j. That review gate is the main safety mechanism: the graph database should contain approved story facts, not raw model output.

At runtime the home page renders `StoryWorkspace`. The workspace calls API routes for transcript metadata, draft extraction, graph insertion, graph visualization data, play-mode timeline data, and future predictions. The API routes keep browser code away from local filesystem access, Neo4j credentials, and OpenAI credentials.

Neo4j is the durable source of truth after insertion. The local transcript files remain the source material, the draft JSON is an intermediate review artifact, and the React Flow displays are read models derived from either the draft or Neo4j.

## Request Flow

1. `GET /api/transcripts` lists local Markdown transcripts and joins Neo4j load status.
2. `POST /api/transcripts/extract` parses one transcript and asks OpenAI for a `TranscriptGraphDraft`.
3. The browser displays the draft as a preview graph and editable JSON.
4. `POST /api/transcripts/insert` validates the edited draft and upserts nodes and relationships into Neo4j.
5. `GET /api/graph` returns a compact relationship graph for data-mode display.
6. `GET /api/graph/play` returns an ordered play timeline from loaded graph anchors.
7. `GET /api/graph/future` builds a focused graph context and asks OpenAI for speculative future cards.

## Documentation Set

- `docs/frontend-workspace.md`: browser UI state, modes, and visual projections.
- `docs/transcript-pipeline.md`: transcript file format, parsing, extraction, review, and insertion lifecycle.
- `docs/story-graph-model.md`: graph ontology, schemas, labels, and relationship constraints.
- `docs/neo4j-persistence.md`: driver setup, schema migration, load status, and upsert behavior.
- `docs/api-routes.md`: route-by-route API contract and responsibility split.
- `docs/ai-agents.md`: OpenAI extraction and future-prediction agents.
- `docs/play-mode-and-futures.md`: play timeline projection and future-card context building.
- `docs/operations.md`: configuration, local commands, and operational checks.
