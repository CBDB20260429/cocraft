# AI Agents

Cocraft currently uses direct OpenAI Responses API calls rather than a multi-agent runtime. The two model-backed modules are:

- `lib/transcript-graph-agent.ts`
- `lib/future-prediction-agent.ts`

## Transcript Graph Extraction

`createTranscriptGraphDraft` turns a parsed transcript into a `TranscriptGraphDraft`.

Inputs:

- Parsed transcript metadata.
- Parsed timestamped transcript text.
- Allowed graph labels.
- Allowed relationship types.
- Required JSON shape.

Outputs:

- Validated `TranscriptGraphDraft`.
- Debug metadata: provider, model, transcript length, prompt length, truncation flag, duration, response id, and output character count.

The model defaults to `OPENAI_MODEL` or `gpt-5.5`.

## Extraction Theory Of Operation

The extraction prompt asks the model to separate transcript evidence, table/show context, fictional story world, narrative theory objects, and D&D mechanics. It asks for concise summaries, stable ids, and links whose endpoints exist in the payload.

After the model responds, the agent:

1. Extracts text from the Responses API payload.
2. Finds the JSON object, including inside markdown fences if necessary.
3. Parses JSON.
4. Normalizes relationship names through an alias table.
5. Drops unsupported relationship types and records extraction notes.
6. Validates the result with `transcriptGraphDraftSchema`.
7. Normalizes transcript source and episode identity against local transcript metadata.

This gives the model room to interpret the transcript while keeping the application contract strict.

## Future Prediction

`createFuturePredictions` generates speculative future cards for a selected transcript.

Inputs:

- Focus episode id.
- Recent anchors, pressure nodes, and pressure relationships from Neo4j.

Outputs:

- Up to 12 normalized future cards.
- Debug metadata: provider, model, context node count, context relationship count, duration, response id, and output character count.

The model defaults to `OPENAI_FUTURE_MODEL`, then `OPENAI_MODEL`, then `gpt-5.5`.

## Future Prediction Theory Of Operation

Future cards are not canonical story facts. They are playable possibilities grounded in existing graph nodes. The prompt requires every card to cite existing node ids in `involvedNodeIds` and `evidence`, and it asks for a balanced set across likely continuations, complications, character futures, quest futures, world/faction/place futures, a twist, and a quiet emotional possibility.

The agent limits context to `22000` JSON characters, validates the model response with `futurePredictionResponseSchema`, then normalizes each card:

- Caps cards at 12.
- Ensures each id, title, and summary are trimmed.
- Deduplicates and caps involved node ids.
- Caps evidence to 4 items.
- Deduplicates and caps player levers to 3.
- Converts empty risks to `null`.

## Failure Modes

Both model-backed modules fail fast when `OPENAI_API_KEY` is missing or looks like a placeholder.

Common operational failures:

- OpenAI returns a non-2xx response.
- The response contains no text.
- The response text does not contain valid JSON.
- The parsed JSON fails Zod validation.
- The transcript context or graph context is too sparse for useful output.
