# Operations

This document covers local setup, commands, configuration, and basic operational checks.

## Required Environment

Create `.env` from `.env.example` and provide:

- `NEO4J_URI`
- `NEO4J_USERNAME`
- `NEO4J_PASSWORD`
- `OPENAI_API_KEY`

Optional values:

- `NEO4J_DATABASE`, defaults to `neo4j`.
- `OPENAI_MODEL`, defaults to `gpt-5.5`.
- `OPENAI_FUTURE_MODEL`, defaults to `OPENAI_MODEL` and then `gpt-5.5`.

## Local Commands

Install dependencies:

```sh
npm install
```

Apply Neo4j constraints and indexes:

```sh
npm run db:migrate
```

Run the development server:

```sh
npm run dev
```

Check code quality:

```sh
npm run lint
npm run typecheck
```

Build the app:

```sh
npm run build
```

## Theory Of Operation

The app has two external dependencies: Neo4j and OpenAI. Neo4j is optional for browsing local transcript files but required for load status, insertion, persisted graph display, play mode, and future prediction context. OpenAI is required for draft extraction and future-card generation.

Local transcript files are read from `transcripts/` relative to the process working directory. The app should be started from the repository root so `process.cwd()` resolves correctly.

## Healthy Local Flow

1. `npm run db:migrate` prints `Neo4j schema is up to date.`
2. `npm run dev` starts Next.js.
3. The home page lists transcript files.
4. Selecting a transcript shows file metadata.
5. `Load Draft` produces draft JSON and activity log debug entries.
6. `Insert Approved` writes nodes and links and refreshes transcript load status.
7. Data mode shows a persisted graph for loaded transcripts.
8. Play mode shows a story-so-far timeline and future cards.

## Troubleshooting

If the transcript list is empty, confirm the app is running from the repository root and `transcripts/` contains `.md` files.

If graphs are empty but transcripts appear, check Neo4j environment variables and run `npm run db:migrate`.

If extraction fails immediately, check `OPENAI_API_KEY`.

If extraction fails after a long wait, inspect the browser activity log for the extraction request id and match it to the Next.js terminal logs.

If insertion fails, validate that the review textarea contains valid JSON and that links use supported labels and relationship types.
