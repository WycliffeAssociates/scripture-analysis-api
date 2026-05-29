# interpresure_suggestions

**Category:** `quality`  
**Version:** `1.0`

## What this observation type does

Provides a structured qualitative review of a translation scope using the InterPresure pragmatic annotation system. The observation surfaces three parallel lists — strengths, weaknesses, and suggestions — each as bullet-pointed markdown strings. This is well-suited for chapter-level or verse-level review where a human consultant or AI reviewer wants to give actionable narrative feedback.

## Anchor level guidance

| Scope | `anchor_level` | Example `anchor` |
|---|---|---|
| Whole chapter | `chapter` | `MAT 2` |
| Single verse | `verse` | `MAT 2:11` |
| Verse range | `verse` | `MAT 2:1-3` |
| Whole book | `book` | `MAT` |

## Observation fields

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | string | ✓ | Always `"interpresure_suggestions"` |
| `version` | string | ✓ | Always `"1.0"` |
| `strengths` | string[] | ✓ | What the translation does well; may be empty |
| `weaknesses` | string[] | ✓ | Areas that fall short; may be empty |
| `suggestions` | string[] | ✓ | Concrete improvement actions; may be empty |

All three arrays are required but may be empty — an observation with no weaknesses and no suggestions is a valid all-clear signal.

Each string in the arrays is expected to be a single bullet-pointed markdown item (e.g. starting with a verb or noun phrase), suitable for rendering directly in a list.

## Example

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
      "The phrase 'wise men from the East' lacks a culturally equivalent expression; the target audience may not associate it with learned scholars or royal court astronomers.",
      "Verse 18 ('Rachel weeping for her children') may be opaque without a footnote — the allusion to Jeremiah is unlikely to land for a first-generation reader."
    ],
    "suggestions": [
      "Consider a brief translator's note on 'wise men' identifying them as royal court scholars; alternatively adapt to a locally understood equivalent for 'learned travellers'.",
      "Add a marginal note on v. 18 cross-referencing Jer 31:15 so the quotation is traceable.",
      "Review v. 23 — 'He shall be called a Nazarene' has no direct OT source; a note acknowledging the allusive nature of the citation would help consultants assess the rendering."
    ]
  }
}
```

## Consumer guidance

Render the three arrays as separate labelled sections: **Strengths**, **Weaknesses**, **Suggestions**. Each item maps directly to a bullet point. Empty arrays should render as "None identified" rather than being hidden, so reviewers can distinguish a passing observation from a missing one. Use `weaknesses` count as a severity signal when sorting or filtering observations.
