# Neo4j Setup

## Environment

Create a local `.env` file from `.env.example` and set the real values:

```sh
cp .env.example .env
```

Required values:

- `NEO4J_URI`: Neo4j connection URI, for example `neo4j+s://...databases.neo4j.io`.
- `NEO4J_USERNAME`: Neo4j username.
- `NEO4J_PASSWORD`: Neo4j password.
- `NEO4J_DATABASE`: Neo4j database name, usually `neo4j`.
- `OPENAI_API_KEY`: OpenAI API key for model access.

Do not commit `.env`; it is ignored by git.

## Schema

Apply constraints and indexes:

```sh
npm run db:migrate
```

The current graph model uses the transcript ontology in
`docs/story-graph-schema-proposal.md`.

Core labels include:

- `(:TranscriptSource)`, `(:Episode)`, and `(:TranscriptSpan)` for source
  evidence and provenance. Raw transcript lines are parsed during extraction but
  are not persisted as graph nodes.
- `(:Person)`, `(:Character)`, `(:CharacterState)`, `(:Place)`,
  `(:Faction)`, and `(:Item)` for table participants and story-world entities.
- `(:Arc)`, `(:Scene)`, `(:Beat)`, `(:Event)`, `(:Quest)`, `(:Conflict)`,
  `(:Revelation)`, `(:Motivation)`, `(:Relationship)`, and `(:Theme)` for
  narrative structure.
- `(:GameMechanic)` for actual-play rules and mechanics.
- `(:TranscriptGraphLoad)` for tracking which transcript files have been loaded.
