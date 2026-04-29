# Neo4j Persistence

Neo4j access is centralized in `lib/db.ts` and `lib/story-graph-repository.ts`.

## Configuration

`getDriver` reads:

- `NEO4J_URI`
- `NEO4J_USERNAME`
- `NEO4J_PASSWORD`

If any required value is missing or still looks like an example placeholder, the app treats Neo4j as unconfigured and returns empty graph data where possible. `getDatabaseName` reads `NEO4J_DATABASE` and defaults to `neo4j`.

## Schema Migration

The schema lives in `db/schema.cypher` and is applied by:

```sh
npm run db:migrate
```

The migration script reads semicolon-separated Cypher statements and runs them against the configured database. The schema creates uniqueness constraints for every story node label and `TranscriptGraphLoad`, plus indexes for common lookup fields such as episode code, character name, place name, scene episode/time, quest status, and graph load status.

The first statements remove legacy prototype labels and old transcript evidence constraints. That cleanup is intentional for the current schema lineage.

## Theory Of Operation

Neo4j is the durable graph state after review. The repository layer does three jobs:

- Tracks load status per transcript.
- Upserts approved draft nodes and links.
- Reads graph projections for UI modes and prediction context.

Writes happen inside a transaction. A `TranscriptGraphLoad` node is marked `loading` before graph writes begin and `loaded` after successful insertion. If insertion fails, the load is marked `failed` with an error.

## Load Status

`getTranscriptLoadStatuses` starts with a default `not_loaded` status for every local transcript, then overlays any matching `TranscriptGraphLoad` nodes found in Neo4j.

Each status includes:

- `transcriptId`
- `status`
- `loadedAt`
- `nodeCount`
- `linkCount`
- `error`

This lets the transcript list remain useful even when Neo4j is not configured or an episode has not been loaded.

## Insert Behavior

`insertTranscriptGraph` performs these steps:

1. Create or update `TranscriptGraphLoad` as `loading`.
2. Upsert `TranscriptSource`.
3. Upsert `Episode`, forcing identity and metadata from the selected transcript.
4. Upsert every supported node collection in the draft.
5. Create structural links:
   - `TranscriptSource HAS_EPISODE Episode`
   - `Episode HAS_EVENT Event`
   - `Episode HAS_BEAT Beat`
   - `Episode CONTAINS Scene`
   - inferred `Scene HAS_EVENT Event` links when event timing overlaps scene timing.
6. Filter and upsert draft links with supported labels and matched endpoints.
7. Mark load as `loaded` with final node/link counts and extraction notes.

Node upserts merge on `(Label {id})` and set all clean properties from the draft. Relationship upserts merge by endpoint and relationship type, then set supplied relationship metadata.

## Skipped Links

Links can be skipped for two reasons:

- The source or target label is not in the allowed graph label set.
- The endpoint node cannot be found in Neo4j during insertion.

Both cases append notes to the load's `extractionNotes`. This keeps insertion robust while preserving enough information for later debugging.
