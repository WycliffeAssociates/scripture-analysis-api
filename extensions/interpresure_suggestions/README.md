# interpresure_suggestions

**Category:** `quality`  
**Versions:** `1.0`, `2.0`

Provides a structured qualitative review of a translation scope using the InterPresure pragmatic annotation system. The observation surfaces three parallel lists — strengths, weaknesses, and suggestions — each as individual markdown strings. Well-suited for verse-level or chapter-level review where a consultant or AI reviewer wants to give actionable narrative feedback grounded in pragmatic analysis.

---

## Anchor level guidance

| Scope | `anchor_level` | Example `anchor` |
|---|---|---|
| Single verse | `verse` | `PSA 145:1` |
| Verse range | `verse` | `MAT 2:1-3` |
| Whole chapter | `chapter` | `MAT 2` |
| Whole book | `book` | `MAT` |

---

## Version 1.0

Minimal format. Three required arrays, no metadata.

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | ✓ | Always `"interpresure_suggestions"` |
| `version` | string | ✓ | Always `"1.0"` |
| `strengths` | string[] | ✓ | What the translation does well pragmatically; may be empty |
| `weaknesses` | string[] | ✓ | Areas where pragmatic meaning is lost or distorted; may be empty |
| `suggestions` | string[] | ✓ | Concrete improvement actions; may be empty |

All three arrays are required but may be empty — an observation with no weaknesses or suggestions is a valid all-clear signal.

Each string is expected to be a single self-contained observation or suggestion, suitable for rendering directly as a bullet point.

### Example

```json
{
  "anchor": "MAT 2",
  "anchor_level": "chapter",
  "type": "interpresure_suggestions",
  "version": "1.0",
  "observation": {
    "type": "interpresure_suggestions",
    "version": "1.0",
    "strengths": [
      "The fulfillment citations (vv. 6, 15, 18, 23) are rendered in a noticeably elevated register, signaling their scriptural weight to the reader.",
      "Herod's deceptive intent in v. 8 is conveyed with appropriate pragmatic force — the irony reads naturally without being over-explained."
    ],
    "weaknesses": [
      "The phrase 'wise men from the East' lacks a culturally equivalent expression; the target audience may not associate it with learned scholars.",
      "Verse 18 ('Rachel weeping for her children') may be opaque without a footnote — the allusion to Jeremiah is unlikely to land for a first-generation reader."
    ],
    "suggestions": [
      "Consider a brief translator's note on 'wise men' identifying them as royal court scholars.",
      "Add a marginal note on v. 18 cross-referencing Jer 31:15 so the quotation is traceable."
    ]
  }
}
```

---

## Version 2.0

Extended format. Adds pipeline metadata (`model`, `resources`), optional numeric scores, structured reasoning, consulted cross-references, and a chapter-level verse triage list. The core `strengths`/`weaknesses`/`suggestions` arrays are unchanged.

### What changed from v1.0

- **Added required:** `model`, `resources`
- **Added optional:** `score`, `confidence`, `reasoning`, `cross_references`, `verses_to_review`

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | ✓ | Always `"interpresure_suggestions"` |
| `version` | string | ✓ | Always `"2.0"` |
| `model` | string | ✓ | Model ID that produced this observation — set by the pipeline after generation, not by the LLM itself |
| `resources` | string[] | ✓ | Resources used, e.g. `["interpresure", "macula", "bart_displays"]`; empty list for zero-shot |
| `strengths` | string[] | ✓ | What the translation does well pragmatically; may be empty |
| `weaknesses` | string[] | ✓ | Where pragmatic meaning is lost, distorted, or over-explicated; may be empty |
| `suggestions` | string[] | ✓ | Concrete actionable improvements; may be empty |
| `score` | integer | — | Overall pragmatic fidelity 1–10 (1 = substantial meaning loss, 10 = fully preserved) |
| `confidence` | integer | — | Model confidence in this analysis, 0–100 |
| `reasoning` | string | — | Markdown-formatted technical reasoning behind the analysis |
| `cross_references` | string[] | — | U23003 scripture references consulted during analysis; empty if none |
| `verses_to_review` | integer[] | — | **Chapter-level items only.** Verse numbers needing the most translator attention |

### Example (verse-level)

```json
{
  "anchor": "PSA 145:1",
  "anchor_level": "verse",
  "type": "interpresure_suggestions",
  "version": "2.0",
  "observation": {
    "type": "interpresure_suggestions",
    "version": "2.0",
    "model": "claude-opus-4-5",
    "resources": ["interpresure", "macula"],
    "strengths": [
      "Direct address form preserved; the illocutionary force of the praise vow is clear and unambiguous."
    ],
    "weaknesses": [
      "'Bless your name' uses a Hebrew idiom whose target-language rendering may not convey active honor without background knowledge of 'name' as a divine attribute."
    ],
    "suggestions": [
      "Use a target-language praise idiom that conveys honor and reverence without requiring metalinguistic knowledge of the 'divine name' concept."
    ],
    "score": 7,
    "confidence": 85,
    "reasoning": "The verse opens a psalm of declarative praise. The Hebrew אֲרוֹמִמְךָ ('I will exalt you') is a performative vow; its illocutionary force is preserved wherever the target language uses a first-person future vow form. The challenge is וַאֲבָרְכָה שִׁמְךָ ('I will bless your name') — 'name' here stands metonymically for the full person and reputation of God, a convention not present in many target languages.",
    "cross_references": ["PSA 145:21", "PSA 103:1"]
  }
}
```

### Example (chapter-level with verse triage)

```json
{
  "anchor": "PSA 145",
  "anchor_level": "chapter",
  "type": "interpresure_suggestions",
  "version": "2.0",
  "observation": {
    "type": "interpresure_suggestions",
    "version": "2.0",
    "model": "claude-opus-4-5",
    "resources": ["interpresure"],
    "strengths": [
      "Acrostic structure is marked through formatting; the praise-escalation arc across the psalm is preserved.",
      "The shift from individual to communal voice at v. 10 is handled cleanly."
    ],
    "weaknesses": [
      "Several verses lose the scalar implicature of כֹּל ('all/every') by rendering it as a generic 'many', weakening the exhaustive scope claims."
    ],
    "suggestions": [
      "Review vv. 2, 9, 13 for weakened scalar terms and test whether target-language universals convey the same exhaustive scope as the Hebrew כֹּל."
    ],
    "score": 6,
    "confidence": 78,
    "reasoning": "Psalm 145 is a Davidic acrostic of declarative praise...",
    "cross_references": [],
    "verses_to_review": [2, 9, 13]
  }
}
```

---

## Consumer guidance

Render the three arrays as separate labelled sections — **Strengths**, **Weakths**, **Suggestions** — with each item as a bullet point. Empty arrays should render as "None identified" rather than being hidden, so reviewers can distinguish a passing observation from a missing one.

For v2.0, additionally:
- Display `score` as a badge or bar (1–10 scale); use `confidence` as a secondary indicator of reliability
- Show `model` and `resources` as metadata tags so reviewers can compare RAG vs. zero-shot runs
- Render `reasoning` in a collapsible "Show reasoning" section to avoid overwhelming the primary view
- For chapter-level items, highlight `verses_to_review` verse numbers in the verse list
- Use `weaknesses` count as a severity signal when sorting or filtering observations
