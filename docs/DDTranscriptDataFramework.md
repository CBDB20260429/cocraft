# D&D Transcript Data Framework for Co-Creation

## Purpose

This framework describes how CoCraft can structure a dataset of 25 full D&D session transcripts for the primary co-creation use case in the PRD.

The goal is not to turn the transcripts into fixed stories. The goal is to extract reusable co-creation intelligence: how scenes evolve, how players make choices, how a world state changes, how a facilitator responds, and what kinds of future possibilities emerge from prior events.

## Source Dataset

The source corpus is a set of 25 complete D&D session transcripts. Each transcript should be preserved as raw source material, then transformed into structured layers that support retrieval, state tracking, and future possibility generation.

Recommended top-level dataset units:

- `campaign`: optional grouping if the 25 sessions belong to one or more campaigns.
- `session`: one full D&D session transcript.
- `scene`: a coherent narrative unit within a session.
- `turn`: one speaker contribution or action beat.
- `event`: a meaningful narrative state change extracted from one or more turns.
- `state_snapshot`: the known story state at a given point.
- `possibility`: a plausible next direction implied by the current state and past patterns.

## Layered Data Model

### 1. Raw Transcript Layer

This layer keeps the original transcripts intact for traceability and future reprocessing.

Fields:

- `transcript_id`
- `session_id`
- `source_name`
- `source_type`
- `raw_text`
- `speaker_labels_original`
- `timestamp_format`
- `ingested_at`
- `rights_or_license_notes`

Why it matters:

- Enables auditability.
- Allows improved extraction later.
- Prevents losing nuance during early schema decisions.

### 2. Normalized Dialogue Layer

This layer turns each transcript into ordered speaker turns.

Fields:

- `turn_id`
- `session_id`
- `scene_id`
- `turn_index`
- `speaker_id`
- `speaker_role`: `dm`, `player`, `system`, `unknown`
- `character_id`
- `utterance_text`
- `utterance_type`: `dialogue`, `action`, `description`, `rules_discussion`, `table_talk`, `dice_roll`, `meta`
- `timestamp_start`
- `timestamp_end`
- `confidence`

Why it matters:

- Separates in-world action from table chatter.
- Lets the system learn the rhythm of co-creation.
- Supports retrieval of examples by speaker role, action type, or scene position.

### 3. Scene Layer

This layer groups turns into meaningful chunks of play.

Fields:

- `scene_id`
- `session_id`
- `scene_index`
- `scene_title`
- `scene_summary`
- `location_id`
- `participating_character_ids`
- `participating_npc_ids`
- `scene_type`: `exploration`, `combat`, `social`, `planning`, `travel`, `downtime`, `reveal`, `transition`
- `emotional_tone`: `tense`, `comic`, `mysterious`, `heroic`, `tragic`, `intimate`, `chaotic`, `reflective`
- `dramatic_function`: `setup`, `complication`, `choice`, `consequence`, `reveal`, `climax`, `resolution`
- `start_turn_id`
- `end_turn_id`

Why it matters:

- CoCraft needs scene-level memory, not only turn-level memory.
- Scene metadata helps the engine retrieve the right precedent for the current narrative moment.
- Dramatic function helps avoid aimless generation.

### 4. Event Layer

This is the most important layer for co-creation. Events capture what changed in the story.

Fields:

- `event_id`
- `session_id`
- `scene_id`
- `event_index`
- `event_type`: `choice`, `action`, `discovery`, `conflict`, `relationship_change`, `world_change`, `resource_change`, `quest_update`, `failure`, `success`, `reveal`, `consequence`
- `actor_ids`
- `target_ids`
- `location_id`
- `summary`
- `trigger_turn_ids`
- `outcome`
- `stakes`
- `emotional_shift`
- `state_changes`
- `unresolved_threads`
- `confidence`

Example:

```json
{
  "event_type": "choice",
  "actor_ids": ["player_03"],
  "summary": "The rogue chooses to spare the captured informant.",
  "stakes": "The party may gain unreliable information but risks betrayal.",
  "outcome": "The informant reveals a hidden route into the citadel.",
  "state_changes": [
    {
      "entity_id": "npc_informant",
      "attribute": "status",
      "old_value": "captured",
      "new_value": "released_under_watch"
    }
  ],
  "unresolved_threads": ["Can the informant be trusted?"]
}
```

Why it matters:

- Events become the bridge between transcript data and live generation.
- They support memory, continuity, and future possibility mapping.
- They let the system reason over consequences instead of only summarizing text.

### 5. Entity Layer

This layer captures persistent story objects.

Entity types:

- `character`
- `npc`
- `faction`
- `location`
- `item`
- `quest`
- `threat`
- `mystery`
- `relationship`
- `rule_or_constraint`

Shared fields:

- `entity_id`
- `entity_type`
- `canonical_name`
- `aliases`
- `description`
- `first_seen_session_id`
- `first_seen_scene_id`
- `status`
- `tags`

Character-specific fields:

- `player_id`
- `character_class`
- `goals`
- `fears`
- `bonds`
- `flaws`
- `current_intent`
- `relationship_ids`

Location-specific fields:

- `parent_location_id`
- `sensory_description`
- `known_features`
- `active_threats`
- `connected_location_ids`

Quest-specific fields:

- `quest_status`: `rumored`, `active`, `blocked`, `completed`, `failed`, `abandoned`
- `objective`
- `known_obstacles`
- `related_entity_ids`
- `open_questions`

Why it matters:

- Co-creation depends on remembering who and what exists.
- Entities give the state manager stable anchors.
- Entity relationships make callbacks and consequences possible.

### 6. State Snapshot Layer

This layer stores the narrative state at key points, especially scene starts and scene endings.

Fields:

- `snapshot_id`
- `session_id`
- `scene_id`
- `after_event_id`
- `summary`
- `active_characters`
- `active_location`
- `active_quests`
- `known_facts`
- `open_threads`
- `emotional_state`
- `tension_level`: 1-5
- `available_resources`
- `constraints`
- `recent_events`
- `possible_next_pressures`

Why it matters:

- The PRD calls for session memory and progression tracking.
- Snapshots provide compact context for generation.
- They reduce the need to pass full transcripts into the model.

### 7. Co-Creation Pattern Layer

This layer abstracts reusable patterns from the transcripts.

Pattern types:

- `player_choice_pattern`
- `dm_response_pattern`
- `consequence_pattern`
- `scene_transition_pattern`
- `tension_escalation_pattern`
- `emotional_resolution_pattern`
- `failure_recovery_pattern`
- `reveal_timing_pattern`

Fields:

- `pattern_id`
- `pattern_type`
- `source_event_ids`
- `source_scene_ids`
- `preconditions`
- `user_intent_signal`
- `narrative_move`
- `typical_outcomes`
- `risks`
- `example_turn_ids`

Example:

```json
{
  "pattern_type": "dm_response_pattern",
  "preconditions": [
    "Player makes an unexpected morally generous choice",
    "NPC has hidden information",
    "Scene tension is moderate or high"
  ],
  "narrative_move": "Reward the choice with partial truth while preserving uncertainty.",
  "typical_outcomes": [
    "NPC reveals useful but incomplete information",
    "Trust improves",
    "A future betrayal remains possible"
  ],
  "risks": [
    "Over-rewarding the choice can flatten tension",
    "Immediate betrayal can make player agency feel punished"
  ]
}
```

Why it matters:

- This is where the D&D data becomes useful for CoCraft rather than merely searchable.
- Patterns help the engine generate next steps that feel like collaborative storytelling.
- They preserve the human logic of tabletop play: offer, choice, response, consequence.

### 8. Future Possibility Layer

This layer supports the PRD's "future possibility mapping."

Fields:

- `possibility_id`
- `based_on_snapshot_id`
- `possibility_type`: `immediate_next_scene`, `complication`, `reveal`, `relationship_turn`, `quest_branch`, `failure_consequence`, `emotional_beat`
- `summary`
- `required_state`
- `supports_user_intent`
- `emotional_direction`
- `continuity_links`
- `risk_level`
- `novelty_level`
- `coherence_score`
- `example_source_patterns`

Example possibilities for a live CoCraft state:

- Low-risk continuation: follow the clue to the citadel through the hidden route.
- Character-driven branch: the spared informant asks for protection from their former faction.
- Complication: the hidden route is real, but the party arrives after another group has used it.
- Emotional beat: a party member challenges the decision to trust the informant.

Why it matters:

- The system should not predict a single future.
- It should generate a ranked set of plausible futures shaped by state, user intent, and emotional goals.
- Possibilities give the UI and engine meaningful options without forcing a fixed plot.

## Recommended Storage Shape

For an MVP, use a hybrid of relational tables, JSON fields, and embeddings.

### Relational Tables

Use relational tables for stable, queryable structure:

- `sessions`
- `turns`
- `scenes`
- `events`
- `entities`
- `state_snapshots`
- `patterns`
- `possibilities`

### JSON Columns

Use JSON for flexible narrative data:

- `state_changes`
- `known_facts`
- `open_threads`
- `preconditions`
- `typical_outcomes`
- `constraints`
- `continuity_links`

### Vector Indexes

Create embeddings for:

- scene summaries
- event summaries
- state snapshots
- co-creation patterns
- emotionally distinctive dialogue turns

This enables retrieval like:

- "Find scenes where a player made an unexpected compassionate choice."
- "Find examples of a tense reveal followed by a social conflict."
- "Find patterns for recovering from a failed plan without killing momentum."

## Processing Pipeline

### Step 1. Ingest

- Store raw transcripts.
- Assign session IDs.
- Preserve original speaker labels and timestamps if available.

### Step 2. Normalize

- Split transcript into turns.
- Identify speakers.
- Map players to characters where possible.
- Classify each turn as in-world, table-talk, action, dice roll, or rules discussion.

### Step 3. Segment

- Divide each session into scenes.
- Assign scene type, tone, dramatic function, and summary.

### Step 4. Extract

- Extract events from each scene.
- Identify entities and relationships.
- Record state changes and unresolved threads.

### Step 5. Snapshot

- Generate state snapshots at scene boundaries.
- Track active quests, emotional tone, tension, location, resources, and open threads.

### Step 6. Abstract

- Derive reusable co-creation patterns.
- Link each pattern to concrete examples from the transcripts.

### Step 7. Retrieve and Generate

At runtime, CoCraft should:

1. Read the current live story state.
2. Retrieve similar state snapshots, events, and patterns.
3. Generate several possible next moves.
4. Rank them by coherence, user intent, emotional alignment, and novelty.
5. Produce the next narrative response while updating state.

## MVP Annotation Priorities

With only 25 transcripts, do not over-annotate everything manually. Prioritize the fields that most directly improve co-creation.

Highest priority:

- Speaker role
- Scene boundaries
- Scene summaries
- Event summaries
- State changes
- Open threads
- Character and NPC entities
- Emotional tone
- Future possibilities

Medium priority:

- Detailed relationship graph
- Dice mechanics
- Quest status changes
- Resource tracking
- Pattern abstraction

Lower priority for prototype:

- Full rules fidelity
- Fine-grained combat state
- Exhaustive item tracking
- Exact timestamps unless useful for replay

## Example Runtime Object

This is the compact object the co-creation engine might use while generating.

```json
{
  "current_state": {
    "scene_summary": "The party has released a captured informant who claims to know a hidden route into the citadel.",
    "active_location": "ruined watchtower",
    "active_characters": ["Mira", "Orren", "Tav"],
    "open_threads": [
      "Can the informant be trusted?",
      "Who else knows about the hidden route?",
      "Will the citadel guards notice the delay?"
    ],
    "emotional_state": "tense but hopeful",
    "tension_level": 3,
    "constraints": [
      "Do not resolve the informant's loyalty immediately",
      "Maintain player agency",
      "Preserve the goal of entering the citadel"
    ]
  },
  "retrieved_patterns": [
    {
      "pattern_type": "dm_response_pattern",
      "narrative_move": "Reward compassion with partial truth while preserving uncertainty."
    },
    {
      "pattern_type": "scene_transition_pattern",
      "narrative_move": "Move from negotiation to travel with a visible sign of danger."
    }
  ],
  "candidate_futures": [
    {
      "summary": "The informant leads them to the route, but fresh tracks show someone arrived first.",
      "coherence_score": 0.91,
      "novelty_level": 0.62,
      "risk_level": 0.31
    },
    {
      "summary": "A party member privately confronts the rogue about trusting the informant.",
      "coherence_score": 0.86,
      "novelty_level": 0.48,
      "risk_level": 0.22
    }
  ]
}
```

## How This Supports the PRD

This framework maps directly to the PRD's co-creation requirements:

- Tracks narrative state through entities, events, and snapshots.
- Interprets user actions through turn and event classification.
- Generates possible next steps through pattern retrieval and possibility mapping.
- Maintains continuity through session history and compact state snapshots.
- Supports a learning loop by turning completed sessions into new patterns.

## Key Design Principle

Treat the 25 D&D transcripts as examples of collaborative narrative behavior, not as stories to imitate directly.

CoCraft should learn how people create together: when they introduce tension, how they reward choices, how they preserve uncertainty, and how they turn unexpected player actions into meaningful narrative momentum.
