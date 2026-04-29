match (n)
where n:StorySession
   or n:StoryNode
   or n:NarrativeTurn
   or n:StateSnapshot
   or n:TranscriptLine
   or n:TranscriptSpan
detach delete n;

drop constraint transcript_line_id if exists;
drop constraint transcript_span_id if exists;

drop index transcript_line_episode_time if exists;

drop index transcript_line_speaker if exists;

create constraint transcript_source_id if not exists
for (source:TranscriptSource)
require source.id is unique;

create constraint episode_id if not exists
for (episode:Episode)
require episode.id is unique;

create constraint person_id if not exists
for (person:Person)
require person.id is unique;

create constraint character_id if not exists
for (character:Character)
require character.id is unique;

create constraint character_state_id if not exists
for (state:CharacterState)
require state.id is unique;

create constraint place_id if not exists
for (place:Place)
require place.id is unique;

create constraint faction_id if not exists
for (faction:Faction)
require faction.id is unique;

create constraint item_id if not exists
for (item:Item)
require item.id is unique;

create constraint arc_id if not exists
for (arc:Arc)
require arc.id is unique;

create constraint scene_id if not exists
for (scene:Scene)
require scene.id is unique;

create constraint beat_id if not exists
for (beat:Beat)
require beat.id is unique;

create constraint event_id if not exists
for (event:Event)
require event.id is unique;

create constraint quest_id if not exists
for (quest:Quest)
require quest.id is unique;

create constraint conflict_id if not exists
for (conflict:Conflict)
require conflict.id is unique;

create constraint revelation_id if not exists
for (revelation:Revelation)
require revelation.id is unique;

create constraint motivation_id if not exists
for (motivation:Motivation)
require motivation.id is unique;

create constraint relationship_id if not exists
for (relationship:Relationship)
require relationship.id is unique;

create constraint theme_id if not exists
for (theme:Theme)
require theme.id is unique;

create constraint game_mechanic_id if not exists
for (mechanic:GameMechanic)
require mechanic.id is unique;

create constraint graph_load_id if not exists
for (load:TranscriptGraphLoad)
require load.id is unique;

create index episode_code if not exists
for (episode:Episode)
on (episode.code);

create index character_name if not exists
for (character:Character)
on (character.name);

create index place_name if not exists
for (place:Place)
on (place.name);

create index scene_episode_time if not exists
for (scene:Scene)
on (scene.episodeId, scene.startSeconds);

create index quest_status if not exists
for (quest:Quest)
on (quest.status);

create index graph_load_status if not exists
for (load:TranscriptGraphLoad)
on (load.status);
