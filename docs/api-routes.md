# API Routes

The API layer is implemented with Next.js route handlers under `app/api`. These routes keep filesystem access, OpenAI calls, and Neo4j credentials on the server side.

## `GET /api/transcripts`

Lists local transcript Markdown files and joins each one with its Neo4j load status.

Response shape:

```json
{
  "transcripts": [
    {
      "id": "c1e001",
      "fileName": "1x01 Arrival at Kraghammer.md",
      "title": "Arrival at Kraghammer",
      "lineCount": 1234,
      "loadStatus": {
        "status": "loaded",
        "nodeCount": 42,
        "linkCount": 84
      }
    }
  ]
}
```

## `POST /api/transcripts/extract`

Starts a draft graph extraction for one transcript.

Request:

```json
{ "transcriptId": "c1e001" }
```

The route validates the request, parses the transcript, calls `createTranscriptGraphDraft`, and returns the draft plus debug metadata. `maxDuration` is set to `300` seconds because extraction can be a long LLM call.

Errors include a generated request id so the browser activity log can be matched with server logs.

## `POST /api/transcripts/insert`

Validates and inserts an approved transcript graph draft.

Request:

```json
{
  "transcriptId": "c1e001",
  "draft": {}
}
```

The `draft` field must satisfy `transcriptGraphDraftSchema`. The route reparses the transcript by id and calls `insertTranscriptGraph`, returning the inserted node and link counts.

## `GET /api/graph`

Returns a compact graph for data-mode display. With `transcriptId`, the route starts from the selected episode and returns nearby visible relationships. Without it, the route returns a capped global graph.

The response is React Flow friendly:

```json
{
  "nodes": [
    {
      "id": "char-vex",
      "position": { "x": 80, "y": 80 },
      "data": {
        "label": "Vex'ahlia",
        "kind": "character",
        "detail": "..."
      }
    }
  ],
  "edges": [
    {
      "id": "123",
      "source": "char-vex",
      "target": "scene-1",
      "label": "appears in"
    }
  ]
}
```

If Neo4j is not configured, it returns an empty graph instead of failing.

## `GET /api/graph/play`

Returns the play-mode timeline graph. It accepts an optional `transcriptId`; without one, it returns the story-so-far projection across all loaded episodes.

If no loaded graph exists, it returns `404` with:

```json
{ "error": "No loaded story graph found." }
```

## `GET /api/graph/future`

Generates future prediction cards for a selected transcript.

Query:

```text
/api/graph/future?transcriptId=c1e001
```

The route requires `transcriptId`, builds a graph context through the repository, calls `createFuturePredictions`, and returns prediction cards plus debug metadata.

## Theory Of Operation

The route handlers are intentionally thin. They validate input, call the relevant library module, translate errors into JSON responses, and avoid embedding business logic directly in the API layer. This makes the core behavior testable through `lib/**` and keeps route responsibilities easy to audit.
