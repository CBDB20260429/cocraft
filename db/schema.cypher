create constraint story_session_id if not exists
for (session:StorySession)
require session.id is unique;

create constraint story_node_id if not exists
for (node:StoryNode)
require node.id is unique;

create constraint narrative_turn_id if not exists
for (turn:NarrativeTurn)
require turn.id is unique;

create constraint state_snapshot_id if not exists
for (snapshot:StateSnapshot)
require snapshot.id is unique;

create constraint story_edge_id if not exists
for ()-[edge:STORY_EDGE]-()
require edge.id is unique;

create index story_node_kind if not exists
for (node:StoryNode)
on (node.kind);

create index story_edge_session_id if not exists
for ()-[edge:STORY_EDGE]-()
on (edge.sessionId);
