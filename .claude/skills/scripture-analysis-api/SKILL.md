---
name: scripture-analysis-api
description: >
  Expert guide for the Scripture Analysis API — a Hono + Cloudflare D1/Workers service for
  storing and querying Bible translation analysis results. Use this skill whenever the user
  asks about: the API endpoints or data model, how analysis items or observations are
  structured, how the extensions/observation-type system works, how to create a new extension
  type (new analysis type), how the CLI upload format works (repo.json / run.json / item arrays),
  JSON Schema authoring for observation types, how to register a type in the analysis_type
  table, how the viewer or component library reads from the API, or anything else touching
  this codebase. Trigger even for casual questions like "how do I add a new analysis type?",
  "what does anchor_level mean?", "how do I upload results?", or "what endpoints does the API have?"
---

# Scripture Analysis API — Expert Guide

The project root is the current repository. Key sub-projects:

| Path | What it is |
|---|---|
| `api/` | Hono + Cloudflare Workers + D1 (SQLite) REST API |
| `cli/` | Node.js upload tool — pushes analysis runs to the API |
| `extensions/` | Source-of-truth for all observation type schemas + seed SQL |
| `components/` | React component library (AnalysisBar, hooks for API data) |
| `viewer/` | React analysis viewer app that consumes the components |

---

## Data model in one paragraph

A **repo** is a translation project (identified by `repo_id`). An **analysis** is one run of some tool against a specific git commit of a repo. An analysis contains many **analysis items** — each item is one discrete observation anchored to a specific passage (a verse, chapter, book, or whole repo). The `observation` field on each item is a self-describing JSON object whose shape is governed by a registered **analysis type**.

---

## API endpoints

**All read endpoints are public. Write endpoints require `Authorization: Bearer <API_KEY>`.**

| Method | Path | Description |
|---|---|---|
| `GET` | `/repos` | List all repos |
| `POST` | `/repos` | Create or upsert a repo |
| `GET` | `/repos/:repo_id` | Project summary — books that have analyses, item counts by category |
| `GET` | `/repos/:repo_id?commit=SHA` | Same, filtered to a specific commit |
| `GET` | `/repos/:repo_id/books/:book` | Book summary — chapters that have analyses |
| `GET` | `/repos/:repo_id/books/:book?commit=SHA` | Same, filtered to a commit |
| `GET` | `/repos/:repo_id/chapters/:book/:chapter` | Chapter detail — all analysis items for that chapter |
| `GET` | `/repos/:repo_id/chapters/:book/:chapter?commit=SHA` | Same, filtered to a commit |
| `GET` | `/analyses` | List analyses (supports `?repo_id=` filter) |
| `POST` | `/analyses` | Create a new analysis run |
| `PUT` | `/analyses/:analysis_id/scope` | Upload a batch of items for a (book, chapter) scope |
| `PATCH` | `/analyses/:analysis_id` | Update analysis status |
| `GET` | `/analysis_types` | List all registered observation types |
| `POST` | `/analysis_types` | Register a new observation type |

The `commit` query param filters all summary/detail endpoints to a specific git SHA. Without it, the latest analysis for each `(type, anchor)` pair is returned.

---

## Analysis item envelope

Every item follows this shape (defined in `cli/schemas/analysis_item.schema.json`):

```json
{
  "book":         "MAT",        // 3-letter USFM book code; null for repo-level items
  "chapter":      2,            // integer; null for book-level or repo-level items
  "anchor":       "MAT 2:11",   // U23003 scripture reference; null for scope-level items
  "anchor_level": "verse",      // granularity — see table below
  "type":         "question",   // must be registered in analysis_type table
  "version":      "1.0",        // must match a registered version
  "observation":  { ... }       // self-describing object — shape defined by the type
}
```

### Anchor levels

| `anchor_level` | Meaning | Typical `anchor` |
|---|---|---|
| `repo` | Entire repo | `null` |
| `book` | One book | `null` or book code |
| `chapter` | One chapter | `"MAT 2"` |
| `verse` | A verse or range | `"MAT 2:11"` or `"MAT 2:1-3"` |
| `word` | A specific word | word reference string |
| `character` | A character | character reference |
| `non_verse` | Non-verse content | context-dependent |

---

## The observation format — self-describing objects

The `observation` field always contains **`type` and `version` fields inside it** that mirror the envelope. This makes each observation independently interpretable without any outer context (a deserializer can identify the schema without looking at the enclosing item).

```json
{
  "anchor": "MAT 2:11",
  "anchor_level": "verse",
  "type": "question",
  "version": "1.0",
  "observation": {
    "type": "question",      // ← always mirrors envelope type
    "version": "1.0",        // ← always mirrors envelope version
    "questions": ["Does 'wakamuabudu' convey physical prostration as well as worship?"],
    "rag_sources": ["macula_greek"]
  }
}
```

The API validates the `observation` object against the JSON Schema stored in the `analysis_type` table for that `(type, version)` pair.

---

## Extensions — observation type system

`extensions/` is the source of truth for all registered observation types. Reading `extensions/EXTENSIONS.md` gives the full authoring guide; what follows is a summary.

### Directory layout

```
extensions/
├── EXTENSIONS.md              # full authoring guide
├── seed.sql                   # INSERT OR IGNORE for every bundled type
└── <type_name>/
    ├── v1.0.schema.json       # JSON Schema (Draft 2020-12) for the observation
    └── README.md              # documentation, examples, consumer guidance
```

### The `analysis_type` table

Each registered type has one row per version:

| Column | Type | Notes |
|---|---|---|
| `type` | TEXT (PK) | Lowercase underscore, immutable once live |
| `version` | TEXT (PK) | `MAJOR.MINOR` string |
| `category` | TEXT | `quality` · `data` · `consistency` · `completeness` |
| `json_schema` | TEXT | Full JSON Schema stored as a minified JSON string |

### Bundled types

| Type | Version | Category | Summary |
|---|---|---|---|
| `interpresure_suggestions` | 1.0 | quality | Strengths, weaknesses, suggestions from InterPresure |
| `interpresure_suggestions` | 2.0 | quality | Extended pragmatic analysis — adds `model`, `resources`, optional `score`, `confidence`, `reasoning`, `cross_references`, `verses_to_review` |
| `discourse_map` | 1.0 | data | Chapter-level discourse framework: QUDs, argument structure, boundaries, relational dynamics, genre notes |

For full annotated schemas, see `references/schemas.md` in this skill.

---

## Creating a new extension type — step by step

### 1. Pick name, version, category

- **Name**: lowercase with underscores, noun-first, permanent once observations exist.  
  Good: `rhetorical_question_density`, `discourse_boundary`  
  Bad: `checkRhetoricalQuestions`, `TranslationIssue`
- **Version**: start at `1.0`
- **Category**: `quality` (makes a judgment), `data` (factual inventory), `consistency` (cross-scope check), `completeness` (gap detection)

### 2. Write the JSON Schema

Create `extensions/<type_name>/v1.0.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "scripture-analysis/<type_name>/1.0",
  "title": "Human Readable Title",
  "description": "One sentence about what this observation captures.",
  "type": "object",
  "required": ["type", "version", "...your required fields..."],
  "additionalProperties": false,
  "properties": {
    "type":    { "type": "string", "const": "<type_name>", "description": "..." },
    "version": { "type": "string", "const": "1.0",        "description": "..." },
    "your_field": { "type": "string", "description": "..." }
  }
}
```

Rules that must not be skipped:
- `type` and `version` **must** be in `required` with `const` values matching the type name and version
- `"additionalProperties": false` is mandatory
- Every property needs a `"description"`
- Only list truly mandatory fields in `required` — optional fields have a schema entry but no required listing

### 3. Write the README

Create `extensions/<type_name>/README.md` covering:
1. What this type does and why it exists
2. Anchor level guidance (which scopes make sense)
3. Field table (name, type, required, description)
4. At least one complete JSON example (full envelope + observation)
5. Consumer rendering guidance

### 4. Add to `seed.sql`

Append to `extensions/seed.sql`:

```sql
INSERT OR IGNORE INTO analysis_type (type, version, category, json_schema) VALUES (
  '<type_name>', '1.0', '<category>',
  '{ ...minified JSON Schema... }'
);
```

Minify the schema onto one line — the DB stores it as a JSON string.

### 5. Register in the running API

```bash
# Local dev (re-run seed file):
wrangler d1 execute scripture-analysis --local --file=extensions/seed.sql

# Production:
wrangler d1 execute scripture-analysis --file=extensions/seed.sql

# Or via HTTP if the API is already running:
curl -X POST http://localhost:8787/analysis_types \
  -H "Authorization: Bearer $SCRIPTURE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"<type_name>","version":"1.0","category":"<category>","json_schema":{...}}'
```

---

## Versioning existing types

**Backwards-compatible change** (new optional field, extended enum):
1. Copy `v1.0.schema.json` → `v1.1.schema.json`; update the `const` version field to `"1.1"` and make your change
2. Add a new `INSERT OR IGNORE` for `v1.1` in `seed.sql`
3. Tools that want the new feature emit `version: "1.1"`; everything else stays on `1.0`

**Breaking change** (remove or rename a required field):
1. Create `v2.0.schema.json` with the new shape
2. Add a `v2.0` seed entry
3. Old `v1.0` observations remain valid in the registry — never edit an existing schema file in place once observations reference it

---

## CLI upload format

The CLI reads a **run directory** with this structure:

```
my-run/
├── repo.json        # identifies the translation project
├── run.json         # identifies the git commit
└── *.json           # one or more flat arrays of analysis items
```

**`repo.json`**
```json
{ "repo_id": "1707", "name": "en_ulb", "git_url": "https://gitea.example.org/org/repo" }
```

**`run.json`**
```json
{ "commit_sha": "af23abeffb678d9e9454c9f537c09bc5cd7c6cfc" }
```

**Item files** — each file is a flat JSON array (not nested, not wrapped):
```json
[
  {
    "book": "MAT", "chapter": 2, "anchor": "MAT 2:11", "anchor_level": "verse",
    "type": "question", "version": "1.0",
    "observation": {
      "type": "question", "version": "1.0",
      "questions": ["Does 'wakamuabudu' convey physical prostration as well as worship?"],
      "rag_sources": ["macula_greek"]
    }
  }
]
```

Non-array JSON files (other than `repo.json` / `run.json`) are skipped with a warning.

### Running the CLI

```bash
cd cli && npm run build     # compile TypeScript once

# Upload:
SCRIPTURE_API_URL=https://... SCRIPTURE_API_KEY=... node dist/index.js upload <run-dir>

# Validate schemas only (no credentials needed):
node dist/index.js upload --dry-run <run-dir>
```

Wrapper scripts `cli/upload.sh` and `cli/upload-dry.sh` wrap these commands.

---

## Running the API locally

```bash
cd api
pnpm dev    # starts wrangler dev with a local D1 database

# First-time setup (apply schema + seed observation types):
wrangler d1 execute scripture-analysis --local --file=migrations/0001_init.sql
wrangler d1 execute scripture-analysis --local --file=extensions/seed.sql
```

The API key for local dev is set in `api/.dev.vars`:
```
API_KEY=your-local-key
```

If wrangler complains "no such table", delete `api/.wrangler/state/` and re-run the migration.

---

## Reference files in this skill

- **`references/schemas.md`** — full annotated schemas for every bundled observation type, plus the CLI manifest schemas. Read this when you need exact field-level detail for a specific type, or when authoring a new schema and want a concrete pattern to follow.
