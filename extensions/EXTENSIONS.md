# Extensions — Observation Type Authoring Guide

This directory is the source-of-truth for all observation types registered in the Scripture Analysis API. Every piece of analysis data produced by any tool must conform to a registered observation type.

---

## What is an observation type?

An observation type defines the shape of the `observation` field on an analysis item. All observations are self-describing — the `observation` object always includes `type` and `version` fields that identify exactly which schema governs it.

```json
{
  "anchor": "MAT 2:11",
  "anchor_level": "verse",
  "type": "question",
  "version": "1.0",
  "observation": {
    "type": "question",
    "version": "1.0",
    "questions": ["Does 'wakamuabudu' convey the physical act of prostration as well as worship?"],
    "rag_sources": ["macula_greek"]
  }
}
```

The `type` and `version` inside `observation` mirror the envelope fields. This makes observations independently interpretable — a consumer (e.g. a Gson deserializer) can identify the type without any outer context.

---

## Directory structure

```
extensions/
├── EXTENSIONS.md          ← this guide
├── seed.sql               ← registers all bundled types into analysis_type
└── <type_name>/
    ├── v<version>.schema.json   ← JSON Schema for the payload
    └── README.md                ← documentation
```

One directory per observation type at the root of `extensions/`. Multiple versions of the same type are separate schema files within the same directory.

---

## The extension contract

### 1. Pick a stable type name

The `type` string is the primary key in the registry and is stored on every observation. **It must never change.** Use lowercase with underscores. Be specific but concise.

```
question                   ✓
back_translation_consistency ✓
translation_question         ✗  (too verbose — prefer a noun)
ConsistencyCheck             ✗  (wrong casing)
```

### 2. Pick a version

Version strings are `MAJOR.MINOR` (e.g. `1.0`, `1.1`, `2.0`).

- **Minor bump** (`1.0` → `1.1`): backwards-compatible additions (new optional fields, new enum values)
- **Major bump** (`1.0` → `2.0`): breaking changes (removing or renaming required fields)

Old observations remain valid under their original version. Consumers must handle unknown versions gracefully.

### 3. Choose a category

| Category | Use when the payload… |
|---|---|
| `quality` | Makes a judgment or raises a question about translation quality |
| `data` | Surfaces structured information without judgment |
| `consistency` | Checks internal consistency across scope |
| `completeness` | Checks for missing or incomplete content |

Categories are open — new ones can be introduced with new types.

### 4. Write the observation JSON Schema

Requirements:

- `"$schema": "https://json-schema.org/draft/2020-12/schema"`
- `"type": "object"` at the root
- `"additionalProperties": false`
- **`type` and `version` must be required fields with `const` values matching the type name and version:**
  ```json
  "type":    { "type": "string", "const": "your_type_name" },
  "version": { "type": "string", "const": "1.0" }
  ```
- Mark only truly mandatory fields as `"required"`
- Add `"description"` strings to every property

### 5. Write the README

Cover:
- What this observation type does
- Anchor level guidance (what scopes it applies to)
- Observation field table
- A complete example analysis item (envelope + observation)
- Consumer rendering guidance

---

## Adding a new observation type

```
# 1. Create the directory
mkdir extensions/<your_type>

# 2. Write the schema
# extensions/<your_type>/v1.0.schema.json

# 3. Write the README
# extensions/<your_type>/README.md

# 4. Add to seed.sql

# 5. Register in the API
wrangler d1 execute scripture-analysis --local --file=extensions/seed.sql
# or via the API:
# POST /analysis_types  { type, version, category, json_schema }
```

---

## Versioning an existing type

**Backwards-compatible change (new optional field or new enum value):**
1. Copy `v1.0.schema.json` → `v1.1.schema.json`, update the `const` version value and add the change
2. Add a new seed entry for version `1.1`
3. Producing tools opt in by setting `version: "1.1"` on new observations

**Breaking change:**
1. Create `v2.0.schema.json` with the new shape
2. Add a new seed entry for version `2.0`
3. Old `v1.0` observations remain valid in the registry

Never modify an existing schema file in place once observations reference it.

---

## Bundled observation types

| Type | Version | Category | Description |
|---|---|---|---|
| [`interpresure_suggestions`](interpresure_suggestions/README.md) | 1.0 | quality | Strengths, weaknesses, and suggestions from the InterPresure pragmatic annotation system |
| [`interpresure_suggestions`](interpresure_suggestions/README.md) | 2.0 | quality | Extended pragmatic analysis with model/resources tracking, score, confidence, reasoning, and chapter-level verse flags |
| [`discourse_map`](discourse_map/README.md) | 1.0 | data | Chapter-level discourse framework: QUDs, argument structure, boundaries, relational dynamics |
