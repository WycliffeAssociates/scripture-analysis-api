# Scripture Analysis API — design reference

## Overview

This API stores and serves AI-generated analysis of Bible translation projects. A translation project lives in a git repository as a collection of USFM files (one per book). Analysis runs against a specific commit and produces typed feedback items anchored to precise locations in the text, from the whole project down to individual characters. Multiple consumers — WYSIWYG editors, CI pipelines, reporting dashboards, scripture editors — query the same API.

---

## Terminology and definitions

### Repo
A single git repository representing one translation project. May contain up to 66 books, each as an individual USFM file. The unit of scope for the entire API.

> Example: a Swahili New Testament project at `git@example.com:swahili-nt.git`

---

### Book
An individual USFM file within a repo, identified by a 3-letter code from the USFM/U23003 standard.

> Examples: `GEN` (Genesis), `MAT` (Matthew), `REV` (Revelation)

A full list of book codes is defined in U23003 Appendix 1 and includes deuterocanonical books and peripheral material (`FRT`, `GLO`, etc.).

---

### Chapter
An integer identifying a chapter within a book. Stored as a nullable integer on analysis items — `null` means the item pertains to the whole book rather than a specific chapter.

> Example: `chapter = 2` for Matthew 2; `chapter = null` for a book-level observation about Matthew

---

### USFM (Unified Standard Format Markers)
The markup language used for Bible translation files. Content is stored in `.usfm` files, one per book. Markers such as `\v`, `\p`, `\s1`, `\f` structure the text.

> Example fragment:
> ```
> \c 2
> \p
> \v 1 Now after Jesus was born in Bethlehem of Judea
> \v 2 in the days of Herod the king...
> ```

---

### Bridged verse
A USFM verse marker spanning a range of verse numbers, treated as a single unit. Per the U23003 standard, bridged verses are handled as normal verse ranges with no special casing.

> Example: `\v 1-2` in USFM is referenced as `LUK 1:1-2` in the U23003 format

---

### Scripture reference (U23003)
The anchor format used throughout this API, following the U23003 Biblical References standard. Supports references from project level down to individual characters, including non-scriptural content such as footnotes and section headings.

| Reference string | Meaning |
|---|---|
| `MAT` | Whole book of Matthew |
| `MAT 2` | Matthew chapter 2 |
| `MAT 2:1` | Matthew 2:1 |
| `LUK 1:1-2` | Luke 1:1–2 (including bridged verses) |
| `MAT 2:1!3` | Third word of Matthew 2:1 |
| `MAT 2:1!3-4` | Words 3–4 of Matthew 2:1 |
| `GEN 7:8!2-12!3` | Genesis 7:8 word 2 to 7:12 word 3 |
| `MAT 2:1!f!3` | Third word of the first footnote in Matthew 2:1 |
| `MAT 1:14!s1!2` | Second word of the section heading before Matthew 1:14 |

---

### Anchor
The scripture reference string stored on an analysis item identifying exactly where in the text the feedback applies. Stored as a raw U23003-format string. `null` for repo-level items that do not correspond to any specific text location.

---

### Anchor level
A denormalized field on analysis items indicating the granularity of the anchor. Stored as an indexed column for fast filtering without requiring scripture reference parsing.

| Value | Meaning |
|---|---|
| `repo` | Applies to the whole project; `book` and `chapter` are null |
| `book` | Applies to a whole book; `chapter` is null |
| `chapter` | Applies to a whole chapter |
| `verse` | Applies to a verse or verse range |
| `word` | Applies to a word or word range |
| `character` | Applies to a character or character range |
| `non_verse` | Anchored to non-scriptural content (footnote, section heading, etc.) |

---

### Analysis
A manually triggered analysis session against a specific commit of a repo. Identified by an `analysis_id` and associated with a `commit_sha`. May cover one or more books or chapters. An analysis transitions through states:

```
pending → in_progress → completed
                     ↘ partial    (closed with some scopes missing)
                     ↘ failed     (analysis-level error)
```

Analysis items are written per scope (book or chapter) via idempotent PUT calls — resubmitting a scope replaces all items for that scope within the analysis.

---

### Analysis item
A single piece of typed feedback produced by a tool, belonging to an analysis and anchored to a specific scope. The core data type of the API.

Fields:
- `id` — unique identifier
- `analysis_id` — the analysis that produced this item
- `book` — nullable book code
- `chapter` — nullable chapter integer
- `anchor` — nullable U23003 reference string
- `anchor_level` — denormalized granularity hint
- `type` — foreign key into the analysis type registry
- `version` — the version of the analysis type's observation schema
- `observation` — structured JSON, shape defined by the analysis type's JSON Schema

> Example (verse-level):
> ```json
> {
>   "id": "...",
>   "analysis_id": "...",
>   "book": "MAT",
>   "chapter": 2,
>   "anchor": "MAT 2:1",
>   "anchor_level": "verse",
>   "type": "back_translation_consistency",
>   "version": "1.0",
>   "observation": {
>     "type": "back_translation_consistency",
>     "version": "1.0",
>     "source_text": "Now after Jesus was born",
>     "back_translation": "After Jesus his birth happened",
>     "note": "Passive construction may obscure agency"
>   }
> }
> ```

> Example (book-level, no anchor):
> ```json
> {
>   "id": "...",
>   "analysis_id": "...",
>   "book": "MAT",
>   "chapter": null,
>   "anchor": "MAT",
>   "anchor_level": "book",
>   "type": "divine_name_inventory",
>   "version": "1.0",
>   "observation": {
>     "type": "divine_name_inventory",
>     "version": "1.0",
>     "names_found": ["Yesu", "Mungu", "Roho Mtakatifu"],
>     "occurrences": { "Yesu": 142, "Mungu": 38, "Roho Mtakatifu": 11 }
>   }
> }
> ```

> Example (repo-level):
> ```json
> {
>   "id": "...",
>   "analysis_id": "...",
>   "book": null,
>   "chapter": null,
>   "anchor": null,
>   "anchor_level": "repo",
>   "type": "project_completeness",
>   "version": "1.0",
>   "observation": {
>     "type": "project_completeness",
>     "version": "1.0",
>     "books_present": 27,
>     "books_expected": 27,
>     "missing": []
>   }
> }
> ```

---

### Analysis type
A named, versioned category of analysis. Defined in the analysis type registry with a JSON Schema that governs the shape of its `observation`. The `type` field acts as a discriminator — consumers switch on it to decide how to render or process an item.

Fields:
- `type` — stable string identifier (e.g., `back_translation_consistency`)
- `version` — schema version string (e.g., `1.0`)
- `category` — classification of what kind of analysis this is
- `json_schema` — the JSON Schema defining the `observation` structure for this type and version

> Example registry entry:
> ```json
> {
>   "type": "back_translation_consistency",
>   "version": "1.0",
>   "category": "quality",
>   "json_schema": { ... }
> }
> ```

---

### Analysis type category
A classification on an analysis type indicating the nature of its analysis. Categories are not fixed — new ones can be introduced with new types. Initial examples:

| Category | Description | Example types |
|---|---|---|
| `quality` | Makes a judgment about translation quality | `back_translation_consistency`, `key_term_accuracy` |
| `data` | Surfaces structured information without judgment | `divine_name_inventory` |
| `consistency` | Checks for internal consistency across the project | `punctuation_pattern`, `spelling_consistency` |
| `completeness` | Checks for missing or incomplete content | `project_completeness`, `verse_coverage` |

---

### Analysis type registry
The collection of all known analysis types, versioned and queryable via the API. Consumers fetch registry entries to understand how to render or interpret observations. Adding a new type requires no API changes.

---

### Observation
The type-specific structured JSON on an analysis item. Its schema is defined by the corresponding analysis type registry entry. The observation is self-describing — it always includes `type` and `version` fields mirroring the item envelope, making it independently interpretable without outer context. Consumers that do not recognise a type can degrade gracefully by displaying the raw observation JSON.

---

### Latest mode
The default read behaviour. The API assembles the most recent completed analysis items per type for the requested scope, potentially drawn from multiple analyses if different types were run at different times.

> Example: `GET /repos/{repo_id}/chapters/MAT/2`

---

### Commit-pinned mode
An optional read behaviour activated by the `?commit={sha}` query parameter. Returns only analysis items from analyses associated with that specific commit. Used for audit, CI validation, and diff views.

> Example: `GET /repos/{repo_id}/chapters/MAT/2?commit=abc123f`

---

### Staleness
The condition where the most recent analysis items for a scope were produced against an older commit than the repo's most recent completed analysis. Surfaced as a boolean flag in API responses so consumers (e.g., a WYSIWYG editor) can show a "review may be outdated" signal.

---

## Data model

```
REPO
  repo_id        string  PK
  name           string
  git_url        string
  created_at     timestamp

ANALYSIS
  analysis_id    string  PK
  repo_id        string  FK → REPO
  commit_sha     string
  status         enum    pending | in_progress | completed | partial | failed
  triggered_at   timestamp

ANALYSIS_TYPE
  type           string  PK
  version        string  PK
  category       string
  json_schema    json    (stored as TEXT)

ANALYSIS_ITEM
  id             string  PK
  analysis_id    string  FK → ANALYSIS
  book           string  nullable  — null = repo-level
  chapter        int     nullable  — null = book-level or repo-level
  anchor         string  nullable  — U23003 reference string
  anchor_level   enum    repo | book | chapter | verse | word | character | non_verse
  type           string  FK → ANALYSIS_TYPE.type
  version        string  FK → ANALYSIS_TYPE.version
  observation    json    (stored as TEXT, self-describing)
```

**Constraints:**
- `chapter` must be null when `book` is null
- `anchor_level = repo` implies `book = null` and `chapter = null`
- `anchor_level = book` implies `chapter = null`

---

## API surface

All repo read endpoints support `?commit={sha}` for commit-pinned mode and `?analysis_id={id}` to pin to a specific analysis. Without either, latest mode applies.

### Repos

```
POST /repos
```
Register or upsert a repo. Accepts `repo_id`, `name`, `git_url`. Idempotent — returns existing record if `repo_id` already exists.

```
GET /repos/{repo_id}
```
Project-level summary. Per-book item counts broken down by analysis type category, staleness indicators, and most recent completed analysis metadata.

```
GET /repos/{repo_id}/books/{book}
```
Book-level summary. Per-chapter item counts, types present, staleness per chapter.

```
GET /repos/{repo_id}/chapters/{book}/{chapter}
```
Full chapter detail. All analysis items for that chapter and its sub-chapter content (verses, words, footnotes, section headings).

```
GET /repos/{repo_id}/analysis
```
Flat paginated query across all analysis items for the project. Supports filtering by `book`, `chapter`, `type`, `anchor_level`, `analysis_id`, and `commit`.

### Analyses

```
POST /analyses
```
Create a new analysis. Accepts `repo_id` and `commit_sha`. Returns `analysis_id`.

```
GET /analyses?repo_id={id}
```
List analyses for a repo, filterable by `status`, `commit_sha`, and date range (`from`, `to`). Paginated.

```
GET /analyses/{analysis_id}
```
Analysis detail including per-scope submission summary.

```
PATCH /analyses/{analysis_id}
```
Update analysis status (e.g., mark as `completed` or `partial`).

```
PUT /analyses/{analysis_id}/scope/{book}
```
Submit all analysis items for a book scope (book-level items, `chapter = null`). Idempotent replace.

```
PUT /analyses/{analysis_id}/scope/{book}/{chapter}
```
Submit all analysis items for a chapter scope. Idempotent replace.

### Analysis type registry

```
POST /analysis_types
```
Register a new analysis type. Accepts `type`, `version`, `category`, `json_schema`.

```
GET /analysis_types
```
List all registered types with `type`, `version`, and `category`.

```
GET /analysis_types/{type}/{version}
```
Full registry entry including `json_schema`.

---

## Key design decisions

**Analysis items carry scope directly.** `book` and `chapter` are nullable columns on `ANALYSIS_ITEM`. No intermediate scope entity — an item's scope is fully self-describing. Null values indicate progressively broader scope: `chapter = null` means book-level, `book = null` means repo-level.

**Anchors follow U23003.** Scripture references are stored as opaque strings per the U23003 standard. This handles bridged verses, word and character references, and non-scriptural content (footnotes, section headings) without custom encoding. `anchor_level` is a denormalized index hint — it does not need to be parsed from the anchor string at query time.

**Observations are self-describing.** Every `observation` object includes `type` and `version` fields mirroring the item envelope. This makes observations independently interpretable — a consumer (e.g. a Gson deserializer) can identify the schema without any outer context.

**Analysis types are discriminated unions.** The `type` field is the discriminator. Each type's `observation` schema is versioned independently in the registry. Consumers that do not recognise a type degrade gracefully. New types require no API changes — just a registry entry and a schema.

**Write path is atomic per scope.** `PUT /analyses/{analysis_id}/scope/{book}/{chapter}` is an idempotent replace of all items for that scope in an analysis. Partial scope writes are not supported.

**Read path has two modes.** Latest mode (default) assembles the freshest results per type across analyses. Commit-pinned mode (`?commit={sha}`) locks the view to a specific reviewed state. The `?analysis_id=` parameter pins to a single analysis.

**No severity.** Severity is not a universal concept across analysis types. Consumers interpret items based on `category` and the typed `observation`.

**No human response or resolution workflow in v1.** Analyses are read-only from a consumer perspective. Resolution state, if needed, lives in external project management tooling.
