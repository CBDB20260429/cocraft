# Cocraft

Cocraft is a browser-based storytelling harness for co-creation. The MVP stack is:

- Next.js + TypeScript on Node.js
- React Flow for graph display and node selection
- Neo4j for application and graph persistence
- OpenAI Agents SDK for narrative orchestration

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
