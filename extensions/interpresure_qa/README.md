# `interpresure_qa` — InterPresure Q&A

**Category:** `quality`  
**Current version:** `1.0`

## What this type does

Each observation is a single pragmatic-goal question asked of an AI model about a specific passage in a translation. The model answers the question, provides optional reasoning, and assigns a `pass`/`fail`/`na` verdict along with a severity score and a confidence score.

This type is designed to be produced at scale — one item per question per passage — and consumed by human reviewers who triage by severity, filter by result, and drill into the model's reasoning when needed.

## Anchor level guidance

| Anchor level | When to use |
|---|---|
| `verse` | Questions about a specific verse's pragmatic effect |
| `chapter` | Questions about chapter-level pragmatic structure or goals |
| `book` | Broad questions about an entire book's register or tone |

A single analysis run may mix anchor levels — e.g. verse-level questions for most items and a few chapter-level questions about discourse structure.

## Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `"interpresure_qa"` | ✓ | Observation type identifier |
| `version` | `"1.0"` | ✓ | Schema version |
| `question` | string | ✓ | The pragmatic-goal question posed to the model |
| `answer` | string | ✓ | The model's answer |
| `model` | string | ✓ | Model identifier, e.g. `"gpt-4o"`, `"claude-3-7-sonnet"` |
| `reasoning` | string | — | Chain-of-thought or explanation before the answer |
| `result` | `"pass"` \| `"fail"` \| `"na"` | ✓ | Verdict: achieved / not achieved / needs human judgment |
| `severity` | integer 0–10 | ✓ | Severity of the issue (fail), importance for review (na), or 0 (pass) |
| `confidence` | integer 0–100 | ✓ | Model's self-reported confidence in its answer |

### `result` semantics

- **`pass`** — The model determined the pragmatic goal is achieved by the translation. `severity` should be `0`.
- **`fail`** — The model determined the pragmatic goal is not achieved. `severity` indicates how critical the issue is (10 = blocks comprehension or causes theological error; 1 = minor stylistic concern).
- **`na`** — The question is not the kind that has a clean pass/fail answer (e.g. an open-ended inventory question). A human reviewer must judge. `severity` indicates priority for that review.

## Example

```json
{
  "book": "PSA",
  "chapter": 145,
  "anchor": "PSA 145:3",
  "anchor_level": "verse",
  "type": "interpresure_qa",
  "version": "1.0",
  "observation": {
    "type": "interpresure_qa",
    "version": "1.0",
    "question": "Does the translation of verse 3 preserve the scalar implicature of incomparable greatness ('his greatness is unsearchable') without weakening it to a mere statement of large quantity?",
    "answer": "The translation 'his greatness cannot be measured' preserves the incomparability implicature but slightly weakens the epistemic dimension — 'unsearchable' implies active inquiry that falls short, whereas 'cannot be measured' only implies a limit. The pragmatic goal is substantially but not fully achieved.",
    "model": "claude-3-7-sonnet",
    "reasoning": "The Hebrew 'ein cheqer' (no searching/inquiry) implies that one could look and still not find the bottom. 'Cannot be measured' is a static limit. The difference is subtle but affects the pragmatic force of the praise.",
    "result": "fail",
    "severity": 3,
    "confidence": 72
  }
}
```

## Consumer rendering guidance

- Show `question` as a prominent prompt, `answer` as the main body text.
- Use a coloured badge for `result`: green (pass), red (fail), amber (na).
- Show `severity` as a small bar or chip — only emphasise it visually for `fail` and `na`.
- Show `confidence` as a secondary indicator (e.g. `72% confidence`).
- Put `reasoning` behind a "Show reasoning" toggle — it can be long.
- Show `model` as a small tag near the answer.
