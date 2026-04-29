# Story Graph Model

The story graph model is defined in `lib/story-graph-types.ts`. It uses Zod schemas for draft validation and exported constants for the allowed graph labels and relationship types.

## Theory Of Operation

The graph separates several layers that are often blended in transcript prose:

- Source layer: transcript source and episode container.
- Table layer: real people at the table.
- Fiction layer: characters, places, factions, items, quests, conflicts, revelations, motivations, relationships, themes, and mechanics.
- Time layer: scenes, beats, and events.
- Edge layer: typed links that express participation, pressure, causality, knowledge, location, ownership, and story change.

The draft schema is intentionally richer than the data-mode visualization. Neo4j stores many typed objects even if the current UI only displays a subset.

## Node Labels

Allowed labels:

- `TranscriptSource`
- `Episode`
- `Person`
- `Character`
- `CharacterState`
- `Place`
- `Faction`
- `Item`
- `Arc`
- `Scene`
- `Beat`
- `Event`
- `Quest`
- `Conflict`
- `Revelation`
- `Motivation`
- `Relationship`
- `Theme`
- `GameMechanic`

Each node type requires an `id`. Most types also require a human-readable field such as `name`, `title`, `label`, or `summary`.

## Relationship Types

Allowed relationship types are constrained by `relationshipTypes`. The set includes:

- Containment and source structure: `HAS_EPISODE`, `HAS_BEAT`, `HAS_EVENT`, `CONTAINS`.
- Performance and appearance: `PLAYS`, `APPEARS_IN`, `PARTICIPATES_IN`.
- World state: `LOCATED_AT`, `TRAVELS_TO`, `MEMBER_OF`, `CONTROLS`, `HAS_RESOURCE`, `OWNS`, `CARRIES`, `CREATED`.
- Quest and conflict pressure: `GIVES_QUEST`, `ACCEPTS_QUEST`, `BLOCKS_QUEST`, `ADVANCES_QUEST`, `OPPOSES`, `ALLIED_WITH`.
- Narrative change: `INTRODUCED_IN`, `UPDATED_IN`, `RESOLVED_IN`, `MANIFESTS_IN`, `REVEALED_IN`, `CHANGES_IN`, `OCCURS_IN`, `AFFECTS`.
- Causality and possibility: `CAUSES`, `ENABLES`, `COMPLICATES`, `RESOLVES`, `FORESHADOWS`.
- Knowledge, desire, and theme: `KNOWS`, `REVEALS_TO`, `SEEKS`, `PROTECTS`, `THREATENS`, `DRIVEN_BY`, `EXPLORES_THEME`, `HAS_STATE`, `BETWEEN`.

Draft links must use these relationship types exactly after normalization. Unsupported relationship names are dropped during extraction normalization or skipped during insertion.

## Draft Contract

`TranscriptGraphDraft` has these top-level fields:

- One `transcriptSource`.
- One `episode`.
- Collections for every graph label except source and episode.
- `links`, each with source label/id, type, target label/id, and optional evidence metadata.
- `extractionNotes`, for limitations and dropped or uncertain interpretations.
- `evidenceRefs`, currently retained in the draft contract even though transcript evidence is mostly stored directly on scenes, events, beats, and links.

## Identity Strategy

The app expects stable string ids. The extraction prompt asks for lowercase ids, prefixed by episode id where useful. During insertion, the episode id is forced to the selected transcript id, and the transcript source is normalized with the local transcript path and source URL.

Because Neo4j upserts by label and `id`, changing an id creates a new graph entity. Editing ids in the review textarea should be treated as a schema-level operation, not just a label cleanup.

## Evidence Strategy

Raw transcript lines are parsed but not persisted as graph nodes. Evidence lives on interpreted objects as:

- `startSeconds` and `endSeconds`.
- `summary`, `consequence`, `outcome`, or equivalent descriptive fields.
- Link-level `confidence`, `status`, and `evidenceCount`.
- `extractionNotes` for uncertain or lossy interpretation.
