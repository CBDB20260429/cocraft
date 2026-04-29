# Transcript Pipeline

The transcript pipeline moves local Markdown transcript files through parsing, LLM extraction, manual review, and Neo4j insertion.

## Source Files

Transcript source files live in `transcripts/` and are read by `lib/transcripts.ts`. Only `.md` files are listed by the application. Files are sorted with numeric-aware filename ordering so episode codes like `1x02` and `1x10` appear in the expected sequence.

The parser expects transcript dialogue lines in this form:

```markdown
**[00:12:34] SPEAKER: text**
```

Metadata is inferred from Markdown headers and list items:

- `# ...` provides the title.
- `- Source:` provides the source URL.
- `- Episode:` is parsed for campaign and episode number.
- The filename prefix, such as `1x01`, becomes the human episode code.

The stable transcript id is derived from campaign and episode number, for example `c1e001`.

## Parsed Transcript Shape

`parseTranscriptById` returns a `ParsedTranscript` with:

- File metadata such as `id`, `fileName`, `localPath`, `title`, `campaign`, `episodeNumber`, and `code`.
- `rawMarkdown`, preserving the original file contents.
- `lines`, an ordered list of timestamped parsed dialogue lines.
- `transcriptText`, a compact line-oriented text form used in prompts.

The parsed line ids are stable within an episode and use the pattern:

```text
{transcriptId}-line-00001
```

## Theory Of Operation

The pipeline keeps evidence, interpretation, and persistence as separate phases. The transcript parser is deterministic and local. The extraction agent performs interpretation and returns structured JSON. The user reviews that JSON before it becomes database state. The repository layer then validates and normalizes database writes.

This separation matters because the LLM can infer useful story structure but should not directly mutate the durable graph without a review step.

## Lifecycle

1. `GET /api/transcripts` calls `listTranscriptFiles` and joins Neo4j load status.
2. The user selects a transcript in data mode.
3. `POST /api/transcripts/extract` calls `parseTranscriptById`.
4. `createTranscriptGraphDraft` sends the parsed transcript text to OpenAI.
5. The response is normalized, validated with `transcriptGraphDraftSchema`, and returned to the browser.
6. The user reviews or edits the JSON draft.
7. `POST /api/transcripts/insert` validates the edited draft again.
8. `insertTranscriptGraph` upserts typed graph nodes, structural links, accepted model links, and the load-status record.

## Extraction Limits

The extraction prompt includes at most `120000` transcript characters. If the transcript is longer, the prompt is truncated and an extraction note is appended to the draft. The debug payload reports both full transcript character count and prompt character count.

## Review Gate

The review textarea is not a cosmetic display. It is the payload used for insertion. This lets an operator fix IDs, remove weak claims, repair relationships, or trim noisy output before persistence.

Insertion requires the edited JSON to parse and satisfy `transcriptGraphDraftSchema`.
