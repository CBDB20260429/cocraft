# Cocraft

Cocraft is a browser-based storytelling graph pipeline for transcript ingestion,
manual review, and Neo4j persistence. The stack is:

- Next.js + TypeScript on Node.js
- React Flow for graph display and node selection
- Neo4j for application and graph persistence
- OpenAI API for transcript-to-graph extraction

## Setup

Install dependencies:

```sh
npm install
```

Create local environment variables:

```sh
cp .env.example .env
```

Required values:

- `NEO4J_URI`
- `NEO4J_USERNAME`
- `NEO4J_PASSWORD`
- `OPENAI_API_KEY`

Optional values:

- `OPENAI_MODEL`, defaults to `gpt-5.5`
- `NEO4J_DATABASE`, defaults to `neo4j`

Apply the Neo4j schema constraints:

```sh
npm run db:migrate
```

Run the app:

```sh
npm run dev
```

Then open http://localhost:3000.

## Transcript Pipeline

The home page lists Markdown files from `transcripts/` and shows whether each
episode has been loaded into the graph. The workflow is intentionally paused at
the review step:

1. Select a transcript.
2. Click `Load Draft` to send the transcript through the OpenAI extraction pass.
3. Review or edit the generated graph JSON.
4. Click `Insert Approved` to write the typed graph data into Neo4j.
