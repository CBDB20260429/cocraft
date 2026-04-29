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

The current graph model uses:

- `(:StorySession)` for a co-creation session.
- `(:StoryNode)` for history, current-state, and possible-future nodes.
- `(:NarrativeTurn)` for user action plus generated narrative output.
- `(:StateSnapshot)` for the full generated graph payload.
- `[:HAS_NODE]`, `[:HAS_TURN]`, `[:HAS_SNAPSHOT]`, and `[:STORY_EDGE]` relationships.
