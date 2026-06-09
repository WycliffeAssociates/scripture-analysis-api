# Full Schema Reference

Annotated schemas for every bundled observation type and the three CLI manifest files.

---

## CLI manifest schemas

### `repo.json` (`cli/schemas/repo.schema.json`)

```json
{
  "repo_id": "1707",
  "name":    "en_ulb",
  "git_url": "https://content.bibletranslationtools.org/WycliffeAssociates/en_ulb"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `repo_id` | string | ✓ | Stable unique key — never change after first upload |
| `name` | string | ✓ | Human-readable display name |
| `git_url` | string | ✓ | HTTPS or SSH git remote URL |

### `run.json` (`cli/schemas/run.schema.json`)

```json
{ "commit_sha": "af23abeffb678d9e9454c9f537c09bc5cd7c6cfc" }
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `commit_sha` | string | ✓ | Full SHA recommended; 7-char short SHA accepted (min length 7) |

### Analysis item envelope (`cli/schemas/analysis_item.schema.json`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `book` | string\|null | — | 3-letter USFM code (`MAT`, `GEN`, `PSA`). Null for repo-level |
| `chapter` | integer\|null | — | Null for book-level or repo-level |
| `anchor` | string\|null | — | U23003 reference (`"MAT 2:11"`, `"MAT 2:1-3"`, `"PSA 145"`). Null for scope-level |
| `anchor_level` | enum | ✓ | `repo` `book` `chapter` `verse` `word` `character` `non_verse` |
| `type` | string | ✓ | Must be registered in `analysis_type` |
| `version` | string | ✓ | Must match a registered version for this type |
| `observation` | object | ✓ | Self-describing — must include `type` and `version` inside |

---

## Bundled observation type schemas

---

### `interpresure_suggestions` v1.0

**Category:** `quality`  
**File:** `extensions/interpresure_suggestions/v1.0.schema.json`

Original format. Strengths, weaknesses, and suggestions from the InterPresure pragmatic annotation system. Each list item is a markdown string.

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | ✓ | Always `"interpresure_suggestions"` |
| `version` | string | ✓ | Always `"1.0"` |
| `strengths` | string[] | ✓ | What the translation does well (may be empty) |
| `weaknesses` | string[] | ✓ | Where pragmatic meaning is lost or distorted (may be empty) |
| `suggestions` | string[] | ✓ | Concrete improvement suggestions (may be empty) |

**Example:**
```json
{
  "book": "PSA", "chapter": 145, "anchor": "PSA 145:1", "anchor_level": "verse",
  "type": "interpresure_suggestions", "version": "1.0",
  "observation": {
    "type": "interpresure_suggestions", "version": "1.0",
    "strengths": ["The praise address 'I will exalt you' preserves the direct speech register of the Hebrew."],
    "weaknesses": ["The phrase 'bless your name' may feel opaque to readers unfamiliar with Hebrew blessing idiom."],
    "suggestions": ["Consider a dynamic equivalent for 'bless your name' that conveys honor and praise without requiring cultural background knowledge."]
  }
}
```

---

### `interpresure_suggestions` v2.0

**Category:** `quality`  
**File:** `extensions/interpresure_suggestions/v2.0.schema.json`

Extended pragmatic analysis. Adds pipeline metadata (`model`, `resources`), optional numeric scores, full reasoning, cross-references, and a chapter-level verse-triage list. The core `strengths`/`weaknesses`/`suggestions` arrays are unchanged.

**What changed from v1.0:**
- Added required: `model`, `resources`
- Added optional: `score`, `confidence`, `reasoning`, `cross_references`, `verses_to_review`

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | ✓ | Always `"interpresure_suggestions"` |
| `version` | string | ✓ | Always `"2.0"` |
| `model` | string | ✓ | Model ID that produced this observation (set by pipeline, not the LLM) |
| `resources` | string[] | ✓ | Resources used, e.g. `["interpresure", "macula", "bart_displays"]`. Empty = zero-shot |
| `strengths` | string[] | ✓ | What the translation does well pragmatically (may be empty) |
| `weaknesses` | string[] | ✓ | Where pragmatic meaning is lost, distorted, or over-explicated (may be empty) |
| `suggestions` | string[] | ✓ | Concrete actionable improvements (may be empty) |
| `score` | integer | — | Overall pragmatic fidelity 1–10 (1 = substantial meaning loss, 10 = fully preserved) |
| `confidence` | integer | — | Model confidence 0–100 |
| `reasoning` | string | — | Markdown-formatted technical reasoning |
| `cross_references` | string[] | — | U23003 references consulted during analysis |
| `verses_to_review` | integer[] | — | **Chapter-level only.** Verse numbers needing most translator attention |

**Example (verse-level):**
```json
{
  "book": "PSA", "chapter": 145, "anchor": "PSA 145:1", "anchor_level": "verse",
  "type": "interpresure_suggestions", "version": "2.0",
  "observation": {
    "type": "interpresure_suggestions", "version": "2.0",
    "model": "claude-opus-4-5",
    "resources": ["interpresure", "macula"],
    "strengths": ["Direct address form preserved; illocutionary force of praise is clear."],
    "weaknesses": ["'Bless your name' is an idiom whose target-language rendering may not convey honor."],
    "suggestions": ["Use a target-language praise idiom that does not require metalinguistic knowledge of 'name' as a divine attribute."],
    "score": 7,
    "confidence": 85,
    "reasoning": "The verse opens a psalm of declarative praise...",
    "cross_references": ["PSA 145:21", "PSA 103:1"]
  }
}
```

**Example (chapter-level):**
```json
{
  "book": "PSA", "chapter": 145, "anchor": "PSA 145", "anchor_level": "chapter",
  "type": "interpresure_suggestions", "version": "2.0",
  "observation": {
    "type": "interpresure_suggestions", "version": "2.0",
    "model": "claude-opus-4-5",
    "resources": ["interpresure"],
    "strengths": ["Acrostic structure is marked through formatting; the praise-escalation arc is preserved."],
    "weaknesses": ["Several verses lose the scalar implicature of 'all' (כֹּל) by rendering it as generic 'many'."],
    "suggestions": ["Review vv. 2, 9, 13 for weakened scalar terms and test whether target-language universals convey the same exhaustive scope."],
    "score": 6,
    "confidence": 78,
    "reasoning": "Psalm 145 is a Davidic acrostic of declarative praise...",
    "cross_references": [],
    "verses_to_review": [2, 9, 13]
  }
}
```

---

### `discourse_map` v1.0

**Category:** `data`  
**File:** `extensions/discourse_map/v1.0.schema.json`

Chapter-level discourse framework that grounds verse-level analysis. Establishes the dominant Questions Under Discussion (QUDs), argument/narrative structure, discourse unit boundaries, relational dynamics, active scalar dimensions, key presuppositions, and genre notes. Intended to be produced in a global discourse pass before verse-level `interpresure_suggestions` items.

**Always anchored at `chapter` level.**

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | ✓ | Always `"discourse_map"` |
| `version` | string | ✓ | Always `"1.0"` |
| `model` | string | ✓ | Model ID that produced this observation |
| `resources` | string[] | ✓ | Resources used; empty = zero-shot |
| `argument_structure` | string | ✓ | Prose description of the argumentative, narrative, or poetic arc |
| `genre_notes` | string | ✓ | Genre and register observations affecting interpretation |
| `dominant_quds` | string[] | — | Dominant Questions Under Discussion active across the chapter |
| `discourse_boundaries` | object[] | — | Discourse units with verse ranges and functional descriptions |
| `relational_dynamics` | string | — | Social and relational context operative across the chapter |
| `active_scales` | string[] | — | Scalar dimensions active in this chapter |
| `key_presuppositions` | string[] | — | Background assumptions the chapter takes for granted |

`discourse_boundaries` item shape:

| Field | Type | Required | Description |
|---|---|---|---|
| `verse_start` | integer | ✓ | First verse of the unit (≥ 1) |
| `verse_end` | integer | ✓ | Last verse of the unit (≥ 1) |
| `description` | string | ✓ | Functional role of this unit in the chapter's argument or narrative |

**Example:**
```json
{
  "book": "PSA", "chapter": 145, "anchor": "PSA 145", "anchor_level": "chapter",
  "type": "discourse_map", "version": "1.0",
  "observation": {
    "type": "discourse_map", "version": "1.0",
    "model": "claude-opus-4-5",
    "resources": ["interpresure", "macula"],
    "dominant_quds": [
      "Why is God worthy of praise?",
      "Who benefits from God's kingship?"
    ],
    "argument_structure": "An acrostic declaration of praise that moves from personal vow (v.1–2) through catalogued divine attributes (v.3–13a) to universal scope of beneficiaries (v.13b–21), culminating in a pledge that all flesh will praise forever.",
    "discourse_boundaries": [
      { "verse_start": 1,  "verse_end": 2,  "description": "Personal vow of praise: speaker commits to perpetual blessing" },
      { "verse_start": 3,  "verse_end": 9,  "description": "Divine attributes catalogue: greatness, power, grace, compassion" },
      { "verse_start": 10, "verse_end": 13, "description": "Kingdom proclamation: all creation and saints declare God's reign" },
      { "verse_start": 14, "verse_end": 20, "description": "Covenant faithfulness: God's care for those who call on him" },
      { "verse_start": 21, "verse_end": 21, "description": "Universal doxological close: all flesh praised forever" }
    ],
    "relational_dynamics": "David as covenant partner addressing a royal divine superior; the psalm positions the speaker as representative of all who fear God.",
    "active_scales": ["greatness (v.3)", "universality of praise (v.21)", "scope of beneficiaries (v.9,13b)"],
    "key_presuppositions": [
      "God is king over an eternal kingdom",
      "God's character attributes (grace, compassion) are known to the audience",
      "Praise is an appropriate and expected response to these attributes"
    ],
    "genre_notes": "Acrostic praise psalm. The alphabetic structure signals completeness — praise covers everything from A to Z. Register is elevated, liturgical, and communal despite first-person opening."
  }
}
```
