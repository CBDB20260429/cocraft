# Play Mode And Futures

Play mode is the application view for reading the loaded story as a timeline and asking for grounded future possibilities.

## Play Timeline

The server-side play graph is built by `getPlayModeGraph` in `lib/story-graph-repository.ts` and exposed by `GET /api/graph/play`.

The query starts from loaded `TranscriptGraphLoad` records, finds matching `Episode` nodes, then collects time anchors:

- `Scene` nodes via `Episode CONTAINS Scene`.
- `Beat` nodes via `Episode HAS_BEAT Beat`.
- `Event` nodes via `Episode HAS_EVENT Event`.

Anchors are ordered by episode number and then by available time/order fields. Each anchor also collects nearby detail nodes such as characters, places, factions, items, quests, conflicts, revelations, motivations, relationships, themes, and game mechanics.

## Timeline Theory Of Operation

The persisted graph is too dense to show directly in play mode. The timeline reduces it to a readable story progression:

- Episodes are containers.
- Scenes, beats, and events are moments.
- Nearby story objects become small layers around moments.

Layer placement is semantic. Character, character-state, revelation, motivation, relationship, and theme details are placed on the "above" side. Places, factions, items, arcs, quests, conflicts, and mechanics are placed on the "below" side.

The browser then converts this play graph into React Flow nodes and edges using `buildNeo4jTimeline` and `buildPlayFlow`.

## Fallback Timeline

If no persisted play graph is available, play mode can use the current draft's scenes and events. If neither Neo4j data nor a draft exists, it shows a small placeholder progression. This keeps the mode visually stable while the operator is still building the graph.

## Future Context

Future-card generation begins in `getFuturePredictionContext`.

For a focused transcript, the repository:

1. Finds the selected `Episode`.
2. Collects recent scene, beat, and event anchors.
3. Pulls neighboring prediction-relevant nodes.
4. Adds pressure nodes and relationships involving open statuses or pressure relationship types.
5. Deduplicates and caps nodes and relationships.
6. Computes a simple weight for each node.

If the selected transcript cannot be found as an episode, the repository falls back to a whole-graph context based on recent anchors and pressure relationships.

## Pressure Signals

Pressure relationships include:

- `FORESHADOWS`
- `ENABLES`
- `COMPLICATES`
- `THREATENS`
- `SEEKS`
- `DRIVEN_BY`
- `BLOCKS_QUEST`
- `ADVANCES_QUEST`
- `OPPOSES`
- `REVEALED_IN`
- `REVEALS_TO`

Open statuses include values such as `open`, `active`, `unresolved`, `ongoing`, and `unknown`.

## Future Cards

`GET /api/graph/future?transcriptId=...` calls `createFuturePredictions`. The returned cards include:

- `title`
- `summary`
- `probability`
- `horizon`
- `tone`
- `involvedNodeIds`
- `evidence`
- `playerLevers`
- `risk`

The UI displays the cards in the right pane. The selected card expands to reveal evidence and a player lever. These cards are suggestions for play, not persisted canon.
