# discourse_map

**Category:** `data`  
**Version:** `1.0`

Captures the discourse-level framework for a chapter — the QUDs, argument structure, unit boundaries, relational dynamics, scalar dimensions, presuppositions, and genre observations that ground verse-level analysis. Intended to be produced in a global discourse pass *before* verse-level `interpresure_suggestions` items, so that verse analysis can reason within an established discourse context.

---

## Anchor level guidance

`discourse_map` is always anchored at chapter level.

| Scope | `anchor_level` | Example `anchor` |
|---|---|---|
| Whole chapter | `chapter` | `PSA 145` |

---

## Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | ✓ | Always `"discourse_map"` |
| `version` | string | ✓ | Always `"1.0"` |
| `model` | string | ✓ | Model ID that produced this observation — set by the pipeline after generation, not by the LLM itself |
| `resources` | string[] | ✓ | Resources used, e.g. `["interpresure", "macula", "bart_displays"]`; empty list for zero-shot |
| `argument_structure` | string | ✓ | Prose description of the argumentative, narrative, or poetic arc of the chapter |
| `genre_notes` | string | ✓ | Genre and register observations that affect interpretation |
| `dominant_quds` | string[] | — | Dominant Questions Under Discussion active across the chapter |
| `discourse_boundaries` | object[] | — | Discourse units with verse ranges and functional descriptions (see below) |
| `relational_dynamics` | string | — | Social and relational context operative across the chapter |
| `active_scales` | string[] | — | Scalar dimensions active in this chapter (e.g. "greatness (v.3)", "universality of praise (v.21)") |
| `key_presuppositions` | string[] | — | Background assumptions the chapter takes for granted |

### `discourse_boundaries` items

Each item in the array describes one coherent discourse unit:

| Field | Type | Required | Description |
|---|---|---|---|
| `verse_start` | integer | ✓ | First verse of the unit (≥ 1) |
| `verse_end` | integer | ✓ | Last verse of the unit (≥ 1) |
| `description` | string | ✓ | The functional role of this unit in the chapter's argument, narrative, or poetic structure |

---

## Example

```json
{
  "anchor": "PSA 145",
  "anchor_level": "chapter",
  "type": "discourse_map",
  "version": "1.0",
  "observation": {
    "type": "discourse_map",
    "version": "1.0",
    "model": "claude-opus-4-5",
    "resources": ["interpresure", "macula"],
    "dominant_quds": [
      "Why is God worthy of praise?",
      "Who benefits from God's kingship?"
    ],
    "argument_structure": "An acrostic declaration of praise that moves from a personal vow (vv. 1–2) through catalogued divine attributes (vv. 3–13a) to a universal scope of beneficiaries (vv. 13b–21), culminating in a pledge that all flesh will praise forever.",
    "discourse_boundaries": [
      {
        "verse_start": 1, "verse_end": 2,
        "description": "Personal vow of praise — speaker commits to perpetual blessing"
      },
      {
        "verse_start": 3, "verse_end": 9,
        "description": "Divine attributes catalogue — greatness, power, grace, compassion"
      },
      {
        "verse_start": 10, "verse_end": 13,
        "description": "Kingdom proclamation — all creation and the saints declare God's eternal reign"
      },
      {
        "verse_start": 14, "verse_end": 20,
        "description": "Covenant faithfulness — God's care for those who call on him in truth"
      },
      {
        "verse_start": 21, "verse_end": 21,
        "description": "Universal doxological close — all flesh will praise forever"
      }
    ],
    "relational_dynamics": "David as covenant partner addressing a royal divine superior; the psalm positions the speaker as representative of all who fear God.",
    "active_scales": [
      "greatness — 'unsearchable' (v. 3) sets the upper bound as beyond measure",
      "universality of beneficiaries — כֹּל ('all') recurs ~15× building toward v. 21's universal doxology",
      "temporal scope — 'for ever and ever' (vv. 1–2, 21) frames the psalm with eternal extent"
    ],
    "key_presuppositions": [
      "God is king over an eternal kingdom",
      "God's character attributes (grace, compassion, faithfulness) are known to the audience",
      "Praise is an appropriate and expected response to these attributes",
      "The speaker has standing to speak on behalf of all humanity"
    ],
    "genre_notes": "Acrostic praise psalm. The alphabetic structure signals completeness — praise covers everything from aleph to tav. Register is elevated, liturgical, and communal despite the first-person opening. The genre creates an expectation of comprehensive, universal claims rather than specific historical narrative."
  }
}
```

---

## Relationship to `interpresure_suggestions`

A `discourse_map` item for a chapter should be produced before the verse-level `interpresure_suggestions` items for that chapter. The discourse map provides:

- The QUDs that verse-level analysis can reference to determine whether implicatures are at-issue or off-topic
- Discourse unit boundaries that explain why certain pragmatic effects span multiple verses
- The relational and scalar context that calibrates how strong a claimed pragmatic loss actually is

Consumers displaying `interpresure_suggestions` items for a chapter may wish to surface the chapter's `discourse_map` as a collapsible context panel alongside the verse-level observations.

---

## Consumer guidance

- Render `argument_structure` and `genre_notes` as a narrative header when displaying chapter-level analysis
- Display `discourse_boundaries` as a visual timeline or segmented bar over the chapter's verse range, with `description` as a tooltip or label
- List `dominant_quds` as a prominent header — they frame the interpretive question the whole chapter is answering
- `active_scales`, `key_presuppositions`, and `relational_dynamics` are reference context rather than primary findings; render them in a secondary or collapsible section
- Show `model` and `resources` as metadata tags for provenance tracking
