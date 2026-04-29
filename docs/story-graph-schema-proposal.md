# Story Graph Schema Proposal

This proposal is based on a first-pass reading of the early transcript files in
`transcripts/`, especially episodes 1x01 through 1x04. Those transcripts are not
just story prose. They contain three overlapping layers:

- Raw media evidence: episode metadata, timestamps, speakers, utterances.
- Table/show context: player introductions, announcements, rules talk, jokes,
  absent players, and audience interaction.
- Fictional narrative: characters, places, factions, goals, conflicts, clues,
  revelations, scenes, and consequences.

For a graph database, those layers should be connected but not collapsed into one
node type. The schema below keeps transcript provenance at the source/span level
while making the fictional story queryable. Raw transcript lines are parsed
during extraction but are not persisted as graph nodes.

## Design Goals

1. Preserve provenance. Every interpreted story fact should be traceable back to
   one or more transcript spans.
2. Separate story world from table talk. A line from Matt may describe Kraghammer,
   explain a D&D rule, or answer a chat question; these need different treatment.
3. Model story as pressure and change, not just entities. Good story graphs need
   goals, obstacles, stakes, decisions, reversals, and unresolved questions.
4. Support uncertainty. The first extraction pass will be imperfect, so inferred
   facts should carry confidence and evidence.
5. Make the transcript-informed ontology the source of truth. The earlier generic
   graph model can be discarded rather than preserved as a compatibility layer.

## Core Transcript Layer

### `(:TranscriptSource)`

Represents the original source page or file.

Fields:

- `id`: Stable id, for example `cr1-001-source`.
- `url`: Source URL from the Markdown header.
- `localPath`: Local transcript path.
- `sourceName`: Human-readable source, for example `Kryogenix CR Search`.
- `ingestedAt`: Datetime.
- `checksum`: Optional file hash for re-ingestion safety.

Why it exists: extracted facts need provenance. If transcript text changes, this
lets us know what evidence an extraction came from.

### `(:Episode)`

Represents a streamed episode as a container for story segments and extracted
story graph data.

Fields:

- `id`: Stable id, for example `c1e001`.
- `campaign`: `Campaign 1`.
- `episodeNumber`: Numeric episode number.
- `code`: Human code, for example `1x01`.
- `title`: `Arrival at Kraghammer`.
- `airedAt`: Optional date if available later.
- `summary`: Optional generated episode-level summary.
- `arcHint`: Optional rough arc label, for example `Kraghammer / Underdark`.

Evidence: the first transcript starts with title `Arrival at Kraghammer` and
metadata `Campaign 1 Episode 1`.

### `(:TranscriptSpan)`

Represents a useful contiguous block of lines: intro, recap, scene, combat,
interrogation, Q&A, break, etc.

Fields:

- `id`: Stable id.
- `spanType`: `character_intro`, `recap`, `scene`, `combat`, `social`,
  `announcement`, `break`, `qna`.
- `startSeconds`, `endSeconds`: Numeric bounds.
- `title`: Short label.
- `summary`: Concise generated summary.
- `confidence`: Extraction confidence.

Why it exists: story events rarely fit a single line. For example, the Kraghammer
tavern scene starts with asking guards for lodging and becomes social positioning,
local color, Kima clues, Greyspine setup, and Grog's desire to fight.

Relationships:

- `(TranscriptSource)-[:HAS_EPISODE]->(Episode)`
- `(Episode)-[:HAS_SPAN]->(TranscriptSpan)`

## People, Performers, and Fictional Agents

### `(:Person)`

Real-world person at the table or production layer.

Fields:

- `id`: Stable id, for example `person-matt-mercer`.
- `name`: Real name.
- `role`: `DM`, `player`, `crew`, `guest`, `unknown`.
- `speakerLabels`: List of labels used in transcripts.

Examples from the transcripts: Matthew Mercer, Travis Willingham, Marisha Ray,
Taliesin Jaffe, Sam Riegel, Orion Acaba, Liam O'Brien, Laura Bailey, Ashley
Johnson, Zac.

### `(:Character)`

Fictional agent in the story world. This includes player characters, NPCs,
companions, monsters with identity, and deities if they function as agents.

Fields:

- `id`: Stable id, for example `char-grog-strongjaw`.
- `name`: Canonical name.
- `aliases`: List, for example `["Grog"]`.
- `characterType`: `player_character`, `npc`, `companion`, `monster`,
  `deity`, `group_agent`.
- `ancestry`: D&D ancestry/species if known.
- `classRole`: D&D class or social role, for example `barbarian`, `paladin`,
  `arcanist`, `barkeep`.
- `level`: Optional numeric level when stated.
- `status`: `active`, `absent`, `missing`, `dead`, `incapacitated`,
  `unknown`.
- `summary`: Short description.
- `dramaticFunction`: `protagonist`, `mentor`, `patron`, `threshold_guardian`,
  `antagonist`, `ally`, `trickster`, `witness`, etc.
- `want`: Current external desire.
- `need`: Inner developmental need.
- `wound`: Backstory wound or formative trauma.
- `fearOrDoubt`: Articulated internal obstacle.

Why these fields: storytelling theory distinguishes external plot want from
internal need. In the early transcripts, Keyleth's Aramente gives her a formal
quest, while "Is she even worthy?" names her inner question. Percy's vengeance
dream is not just biography; it is a wound, temptation, and long-term arc engine.

Examples:

- Grog: goliath barbarian, protagonist, saved by Pike, exiled by Kevdak.
- Keyleth: druid, heir-in-training, Aramente quest, worthiness doubt.
- Percy: noble survivor, vengeance wound, inventor of his first gun.
- Kima: missing paladin and initial rescue objective.
- Allura: patron who sends the party.
- Nostoc Greyspine: mine owner and transactional quest-giver.
- Clarota: outcast mind flayer, dangerous ally.

### `(:CharacterState)`

A time-bounded condition of a character.

Fields:

- `id`: Stable id.
- `stateType`: `physical`, `emotional`, `social`, `magical`, `political`,
  `knowledge`.
- `label`: Short label, for example `catatonic`.
- `description`: Detail.
- `startsAtSeconds`, `endsAtSeconds`: Optional.
- `severity`: Optional `low`, `medium`, `high`, `critical`.
- `certainty`: `observed`, `inferred`, `reported`.

Why it exists: Grog being reduced to catatonia by an intellect devourer is a
major story pressure. It should not be buried as a note on Grog forever; it is a
state with onset, stakes, and later resolution.

Relationships:

- `(Person)-[:PLAYS]->(Character)`
- `(Character)-[:HAS_STATE]->(CharacterState)`
- `(CharacterState)-[:EVIDENCED_BY]->(TranscriptSpan)`

## World Layer

### `(:Place)`

A story-world location at any scale.

Fields:

- `id`: Stable id.
- `name`: Canonical name.
- `placeType`: `continent`, `region`, `city`, `district`, `building`,
  `room`, `landmark`, `dungeon`, `cavern`.
- `description`: Sensory and functional description.
- `politicalControl`: Optional controlling faction.
- `dangerLevel`: Optional rough level.
- `firstMentionedAt`: Optional seconds/episode id.

Examples from the first transcripts: Emon, Tal'Dorei, Kraghammer, Iron Hearth
Tavern, Firebrook Inn, Greyspine mines, abandoned goblin city, duergar war camp,
Whitestone, Syngorn, Draconia.

### `(:Faction)`

A collective social force.

Fields:

- `id`: Stable id.
- `name`: Canonical name.
- `factionType`: `government`, `family`, `military`, `tribe`, `religion`,
  `guild`, `enemy_force`, `business`, `people`.
- `description`: What the group is and how it acts.
- `values`: Optional list.
- `status`: `active`, `defeated`, `hidden`, `unknown`.

Examples: Vox Machina, House Greyspine, the Carvers, Air Ashari, Briarwoods,
duergar, Draconian high council.

### `(:Item)`

A meaningful object, resource, weapon, or artifact.

Fields:

- `id`: Stable id.
- `name`: Canonical name.
- `itemType`: `weapon`, `artifact`, `resource`, `document`, `vehicle`,
  `currency`, `clue`, `magic_item`.
- `description`: What it is.
- `status`: `owned`, `lost`, `sought`, `destroyed`, `unknown`.
- `symbolicWeight`: Optional description of thematic meaning.

Examples: Allura's paperwork, Percy's first gun, magic carpet, mithral, creature
heads as bounty objects.

Relationships:

- `(Place)-[:CONTAINS]->(Place)`
- `(Character)-[:LOCATED_AT]->(Place)` with `episodeId`, `startSeconds`,
  `endSeconds`
- `(Faction)-[:CONTROLS]->(Place)`
- `(Character)-[:MEMBER_OF]->(Faction)`
- `(Character)-[:OWNS|CARRIES|SEEKS|CREATED]->(Item)`
- `(Place)-[:HAS_RESOURCE]->(Item)`

## Story Structure Layer

### `(:Arc)`

A large dramatic movement.

Fields:

- `id`: Stable id.
- `title`: Short name, for example `Kraghammer Search for Kima`.
- `arcType`: `main_plot`, `character_arc`, `relationship_arc`,
  `mystery_arc`, `faction_arc`.
- `status`: `setup`, `active`, `resolved`, `dormant`.
- `centralQuestion`: The question that creates narrative tension.
- `theme`: Optional thematic concern.
- `summary`: Current understanding.

Examples:

- Main plot: Will Vox Machina find Kima and stop the evil beneath Kraghammer?
- Keyleth arc: Can she become the kind of leader the Aramente requires?
- Percy arc: What will vengeance cost him?

### `(:Scene)`

A bounded unit of action in a place with a local dramatic purpose.

Fields:

- `id`: Stable id.
- `title`: `Arrival in Kraghammer`, `Iron Hearth Tavern`, `Grog Catatonic`,
  `Clarota Alliance`.
- `sceneType`: `recap`, `exploration`, `social`, `combat`, `aftermath`,
  `decision`, `revelation`, `rest`.
- `episodeId`: Owning episode.
- `startSeconds`, `endSeconds`: Transcript bounds.
- `locationName`: Denormalized display helper.
- `summary`: What happens.
- `sceneGoal`: What the protagonists are trying to do locally.
- `turningPoint`: How the scene changes the situation.
- `outcome`: `success`, `failure`, `mixed`, `interrupted`, `unknown`.
- `emotionalCharge`: `comic`, `tense`, `wonder`, `horror`, `triumphant`,
  `somber`, `mixed`.

Why it exists: scenes are the best bridge between transcript and story theory.
Each scene should have a desire, obstacle, and change. The tavern scene begins as
"find lodging" and turns into "gain local information and social footing."

### `(:Beat)`

A smaller dramatic action inside a scene.

Fields:

- `id`: Stable id.
- `beatType`: `offer`, `choice`, `reveal`, `complication`, `joke`,
  `attack`, `save`, `bargain`, `question`, `answer`, `rule_check`,
  `state_change`.
- `summary`: Short description.
- `order`: Integer within scene.
- `storyLayer`: `fiction`, `table`, `show`.
- `confidence`: Extraction confidence.

Examples:

- Vax buys a round for the tavern.
- Adra reveals Kima stayed at the Firebrook Inn.
- Matt recaps that Grog has been rendered brain-dead.
- The party remembers they have a duergar hostage.

### `(:Event)`

A consequential occurrence in the fiction.

Fields:

- `id`: Stable id.
- `eventType`: `arrival`, `conversation`, `combat`, `discovery`,
  `injury`, `death`, `deal`, `quest_given`, `quest_updated`, `travel`,
  `revelation`, `betrayal`, `rescue`, `escape`.
- `summary`: What occurred.
- `episodeId`, `startSeconds`, `endSeconds`: When it appears in the transcript.
- `chronologyIndex`: Story-world order if known.
- `certainty`: `shown`, `reported`, `recapped`, `inferred`.
- `consequence`: What changes because of it.

Why both `Scene` and `Event`: a scene is a dramatic container; events are atomic
facts that can be queried across scenes. "Kima went missing" is an event reported
in recap; "the party enters Kraghammer" is shown in scene.

### `(:Quest)`

A goal-bearing thread with stakes, source, obstacles, and resolution.

Fields:

- `id`: Stable id.
- `title`: `Find Lady Kima`.
- `questType`: `rescue`, `investigation`, `destroy_threat`, `bounty`,
  `pilgrimage`, `personal_growth`, `diplomacy`.
- `status`: `offered`, `accepted`, `active`, `blocked`, `completed`,
  `failed`, `abandoned`.
- `objective`: Concrete external goal.
- `stakes`: What happens if the goal fails.
- `reward`: Optional offered reward.
- `moralPressure`: Optional ethical tension.
- `deadline`: Optional.
- `knownObstacles`: List or short text.

Examples:

- Allura hires the party to find Kima.
- Nostoc Greyspine hires the party to destroy the source of mine abominations.
- Keyleth's Aramente is a personal-growth quest.

### `(:Conflict)`

A pressure relationship between opposing goals.

Fields:

- `id`: Stable id.
- `conflictType`: `combat`, `social`, `political`, `internal`, `mystery`,
  `environmental`, `moral`.
- `summary`: The pressure.
- `status`: `latent`, `active`, `resolved`, `escalated`.
- `stakes`: What is at risk.
- `asymmetry`: Optional note on power imbalance or hidden knowledge.

Examples:

- Vox Machina versus duergar war camp.
- Grog's incapacitation versus the party's need to keep moving.
- Kraghammer's guarded isolation versus outsiders needing access.
- Keyleth's self-doubt versus the Aramente's demands.

### `(:Revelation)`

A change in audience/player/character knowledge.

Fields:

- `id`: Stable id.
- `summary`: New information.
- `knowledgeType`: `clue`, `backstory`, `world_lore`, `threat_identity`,
  `location`, `relationship`, `rule`.
- `knownTo`: Optional list of character ids or `audience`, `players`.
- `certainty`: `confirmed`, `rumor`, `hypothesis`, `lie`, `unknown`.
- `impact`: How it redirects goals or stakes.

Examples:

- Kima stayed at the Firebrook Inn.
- Strange monstrosities are coming from the mines.
- A mind flayer is involved.
- Clarota is outcast from the oppressive mind flayer society.

Relationships:

- `(Arc)-[:HAS_SCENE]->(Scene)`
- `(Scene)-[:HAS_BEAT]->(Beat)`
- `(Scene)-[:HAS_EVENT]->(Event)`
- `(Quest)-[:INTRODUCED_IN|UPDATED_IN|RESOLVED_IN]->(Scene|Event)`
- `(Conflict)-[:MANIFESTS_IN]->(Scene|Event)`
- `(Revelation)-[:REVEALED_IN]->(Scene|Beat|TranscriptSpan)`
- `(Beat|Event|Scene|Quest|Conflict|Revelation)-[:EVIDENCED_BY]->(TranscriptSpan)`

## Character Arc and Relationship Layer

### `(:Motivation)`

An explicit or inferred driver for action.

Fields:

- `id`: Stable id.
- `motivationType`: `want`, `need`, `fear`, `belief`, `wound`, `vow`,
  `temptation`, `duty`.
- `summary`: The driver.
- `source`: `backstory`, `dialogue`, `action`, `inference`.
- `status`: `active`, `challenged`, `changed`, `resolved`.
- `confidence`: Extraction confidence.

Examples:

- Keyleth's worthiness doubt.
- Percy's vengeance offer.
- Scanlan's yearning for true love.
- Tiberius's desire to find lost artifacts.
- Grog's loyalty to Pike.

### `(:Relationship)`

Represents a meaningful tie between characters or factions.

Fields:

- `id`: Stable id.
- `relationshipType`: `family`, `friendship`, `patronage`, `rivalry`,
  `enmity`, `alliance`, `command`, `business`, `romantic_interest`,
  `rescuer_rescued`.
- `summary`: What the tie means.
- `status`: `stable`, `strained`, `new`, `broken`, `hidden`, `unknown`.
- `polarity`: `positive`, `negative`, `ambivalent`, `transactional`.
- `intensity`: Optional 1-5.

Why relationship as node: relationships change over time and may need evidence,
status, and beats attached. A simple edge is fine for static facts, but Grog and
Pike's bond or the party's risky alliance with Clarota are story objects.

### `(:Theme)`

A recurring abstract concern.

Fields:

- `id`: Stable id.
- `name`: `worthiness`, `vengeance`, `belonging`, `outsiderhood`,
  `trusting monsters`, `civilization versus underworld`.
- `description`: How the theme appears.

Relationships:

- `(Character)-[:DRIVEN_BY]->(Motivation)`
- `(Motivation)-[:EVIDENCED_BY]->(TranscriptSpan)`
- `(Character)-[:PARTICIPATES_IN]->(Relationship)`
- `(Relationship)-[:BETWEEN]->(Character|Faction)` if using a relationship node
  pattern
- `(Relationship)-[:CHANGES_IN]->(Scene|Event|Beat)`
- `(Arc|Scene|Quest|Conflict|Character)-[:EXPLORES_THEME]->(Theme)`

## D&D Mechanics Layer

This layer should exist because these are actual-play transcripts, but it should
not be confused with story causality.

### `(:GameMechanic)`

Fields:

- `id`: Stable id.
- `mechanicType`: `roll`, `spell`, `class_feature`, `condition`, `rule`,
  `edition_note`, `house_rule`.
- `name`: `Persuasion check`, `Polymorph`, `Glacial Blast`,
  `intelligence reduced to zero`, `5th edition conversion`.
- `description`: Mechanical detail.
- `system`: `D&D 5e`, `Pathfinder`, `house_rule`.
- `result`: Optional result text.

Examples:

- The campaign recently converted from Pathfinder to D&D 5e.
- Grog previously avoided combat via a persuasion check.
- Umber hulks were handled with Polymorph.
- An intellect devourer reduced Grog's intelligence to zero.

Relationships:

- `(GameMechanic)-[:OCCURS_IN]->(Beat|Event|Scene)`
- `(GameMechanic)-[:AFFECTS]->(Character|CharacterState)`
- `(GameMechanic)-[:EVIDENCED_BY]->(TranscriptSpan)`

## Recommended Relationship Types

High-value relationship types for this project:

- `HAS_EPISODE`, `HAS_SPAN`
- `EVIDENCED_BY`
- `PLAYS`
- `APPEARS_IN`, `PARTICIPATES_IN`
- `LOCATED_AT`, `TRAVELS_TO`
- `MEMBER_OF`, `CONTROLS`, `OPPOSES`, `ALLIED_WITH`
- `GIVES_QUEST`, `ACCEPTS_QUEST`, `BLOCKS_QUEST`, `ADVANCES_QUEST`
- `HAS_SCENE`, `HAS_BEAT`, `HAS_EVENT`
- `CAUSES`, `ENABLES`, `COMPLICATES`, `RESOLVES`, `FORESHADOWS`
- `KNOWS`, `REVEALS_TO`, `SEEKS`, `PROTECTS`, `THREATENS`
- `DRIVEN_BY`, `EXPLORES_THEME`

Where the relationship itself carries story context, add properties:

- `episodeId`
- `startSeconds`
- `endSeconds`
- `status`
- `confidence`
- `evidenceCount`
- `summary`

## Example Extraction From Early Transcripts

### Episode and source

```cypher
(:TranscriptSource {
  id: "source-crsearch-c1e001",
  url: "https://www.kryogenix.org/crsearch/html/cr1-1.html",
  localPath: "transcripts/1x01 Arrival at Kraghammer.md"
})
-[:HAS_EPISODE]->
(:Episode {
  id: "c1e001",
  code: "1x01",
  campaign: "Campaign 1",
  episodeNumber: 1,
  title: "Arrival at Kraghammer"
})
```

### Main quest setup

```cypher
(:Quest {
  id: "quest-find-kima",
  title: "Find Lady Kima",
  questType: "rescue",
  status: "active",
  objective: "Find Lady Kima of Vord beneath Kraghammer and bring her back safely.",
  stakes: "A dark evil is growing beneath Kraghammer, and Kima may be lost or dead.",
  reward: "Substantial reward from Allura."
})
```

Connected facts:

- `Allura` gives the quest.
- `Kima` is the missing target.
- `Kraghammer` and the `Greyspine mines` are likely search locations.
- The quest escalates when mine abominations, duergar, and mind flayers appear.

### Character arc seed

```cypher
(:Character {
  id: "char-keyleth",
  name: "Keyleth",
  characterType: "player_character",
  ancestry: "half-elf",
  classRole: "druid",
  dramaticFunction: "protagonist",
  want: "Complete the Aramente and prove herself as a future Ashari leader.",
  need: "Develop trust in her own judgment and leadership.",
  fearOrDoubt: "Is she even worthy?"
})
```

This should connect to:

- `(:Quest {title: "The Aramente"})`
- `(:Faction {name: "Air Ashari"})`
- `(:Theme {name: "worthiness"})`
- transcript spans containing her intro.

### Scene with turning point

```cypher
(:Scene {
  id: "c1e001-scene-iron-hearth",
  title: "Iron Hearth Tavern",
  sceneType: "social",
  episodeId: "c1e001",
  sceneGoal: "Find lodging and local information in Kraghammer.",
  turningPoint: "Adra reveals that a silver-armored halfling stayed at the Firebrook Inn.",
  outcome: "success",
  emotionalCharge: "comic"
})
```

This scene connects to Adra, the Iron Hearth Tavern, the Firebrook Inn clue, the
Carvers as local authority, and the Greyspine family as political/business power.

### State-changing event

```cypher
(:Event {
  id: "c1e003-event-grog-catatonic",
  eventType: "injury",
  summary: "An intellect devourer renders Grog catatonic by reducing his intelligence to zero.",
  certainty: "recapped",
  consequence: "The party must stop, diagnose him, and find a magical solution while still in danger."
})
```

This connects to:

- `Grog`
- `CharacterState: catatonic`
- `Conflict: survival while incapacitated`
- `GameMechanic: intelligence reduced to zero`
- transcript recap and follow-up medical examination lines.

## Constraints and Indexes

Suggested Neo4j constraints:

```cypher
create constraint transcript_source_id if not exists
for (s:TranscriptSource)
require s.id is unique;

create constraint episode_id if not exists
for (e:Episode)
require e.id is unique;

create constraint transcript_span_id if not exists
for (s:TranscriptSpan)
require s.id is unique;

create constraint person_id if not exists
for (p:Person)
require p.id is unique;

create constraint character_id if not exists
for (c:Character)
require c.id is unique;

create constraint place_id if not exists
for (p:Place)
require p.id is unique;

create constraint faction_id if not exists
for (f:Faction)
require f.id is unique;

create constraint item_id if not exists
for (i:Item)
require i.id is unique;

create constraint scene_id if not exists
for (s:Scene)
require s.id is unique;

create constraint event_id if not exists
for (e:Event)
require e.id is unique;

create constraint quest_id if not exists
for (q:Quest)
require q.id is unique;

create constraint arc_id if not exists
for (a:Arc)
require a.id is unique;
```

Suggested indexes:

```cypher
create index character_name if not exists
for (c:Character)
on (c.name);

create index place_name if not exists
for (p:Place)
on (p.name);

create index scene_episode_time if not exists
for (s:Scene)
on (s.episodeId, s.startSeconds);

create index quest_status if not exists
for (q:Quest)
on (q.status);
```

## Migration Note

The previous generic graph model can be deleted:

- `StorySession`
- `StoryNode`
- `NarrativeTurn`
- `StateSnapshot`
- generic `STORY_EDGE`

Those nodes are useful for an early interactive prototype, but they are too flat
for transcript analysis. This proposal treats the richer ontology as the primary
database model. Any UI graph should render directly from concrete story objects
such as `Character`, `Place`, `Quest`, `Conflict`, `Scene`, `Event`, and
`Revelation`, with provenance available through `TranscriptSpan` and
episode/source metadata.

## Extraction Order

Recommended phased extraction:

1. Parse all transcript files locally for prompt construction and metadata.
2. Store `TranscriptSource`, `Episode`, and extracted `TranscriptSpan` nodes.
3. Extract canonical entities: people, characters, places, factions, items.
4. Extract scenes, events, quests, conflicts, and revelations.
5. Attach evidence and confidence to interpreted nodes and relationships at the
   span/source level.
6. Render UI views directly from the typed graph nodes and relationships.

## Why This Shape Fits These Transcripts

The early episodes are driven by classic adventure-story structure:

- Inciting objective: Allura sends the party to find Kima.
- Threshold crossing: the party gains entry to Kraghammer.
- Local social world: guards, tavern, Adra, Carvers, Greyspines.
- Clues and escalation: Kima at Firebrook, mines, missing miners,
  monstrosities, skull-bored corpses, duergar, mind flayer.
- Complications: Grog's catatonia, dangerous terrain, hostage interrogation,
  risky alliance with Clarota.
- Character engines: Keyleth's worthiness, Percy's vengeance, Scanlan's longing,
  Grog/Pike loyalty, twins' outsider bond, Tiberius's artifact hunger.

A flat entity graph would capture names, but miss why the story moves. The
proposed schema makes narrative pressure first-class while preserving the raw
transcript evidence underneath it.
