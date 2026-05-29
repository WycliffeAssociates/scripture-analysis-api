-- Seed the analysis_type table with bundled observation types.
-- Safe to re-run: INSERT OR IGNORE skips existing rows.
--
-- Usage:
--   wrangler d1 execute scripture-analysis --local --file=extensions/seed.sql
--   wrangler d1 execute scripture-analysis --file=extensions/seed.sql   (production)

INSERT OR IGNORE INTO analysis_type (type, version, category, json_schema) VALUES (
  'back_translation_consistency', '1.0', 'quality',
  '{"type":"object","required":["type","version","source_text","back_translation"],"additionalProperties":false,"properties":{"type":{"type":"string","const":"back_translation_consistency"},"version":{"type":"string","const":"1.0"},"source_text":{"type":"string"},"back_translation":{"type":"string"},"note":{"type":"string"},"similarity_score":{"type":"number","minimum":0,"maximum":1}}}'
);

INSERT OR IGNORE INTO analysis_type (type, version, category, json_schema) VALUES (
  'divine_name_inventory', '1.0', 'data',
  '{"type":"object","required":["type","version","names_found","occurrences"],"additionalProperties":false,"properties":{"type":{"type":"string","const":"divine_name_inventory"},"version":{"type":"string","const":"1.0"},"names_found":{"type":"array","items":{"type":"string"},"uniqueItems":true},"occurrences":{"type":"object","additionalProperties":{"type":"integer","minimum":1}},"notes":{"type":"string"}}}'
);

INSERT OR IGNORE INTO analysis_type (type, version, category, json_schema) VALUES (
  'key_term_accuracy', '1.0', 'quality',
  '{"type":"object","required":["type","version","source_term","translation_used"],"additionalProperties":false,"properties":{"type":{"type":"string","const":"key_term_accuracy"},"version":{"type":"string","const":"1.0"},"source_term":{"type":"string"},"translation_used":{"type":"string"},"approved_renderings":{"type":"array","items":{"type":"string"}},"is_approved":{"type":"boolean"},"note":{"type":"string"}}}'
);

INSERT OR IGNORE INTO analysis_type (type, version, category, json_schema) VALUES (
  'project_completeness', '1.0', 'completeness',
  '{"type":"object","required":["type","version","books_present","books_expected","missing"],"additionalProperties":false,"properties":{"type":{"type":"string","const":"project_completeness"},"version":{"type":"string","const":"1.0"},"books_present":{"type":"integer","minimum":0},"books_expected":{"type":"integer","minimum":1},"missing":{"type":"array","items":{"type":"string","pattern":"^[A-Z0-9]{3}$"},"uniqueItems":true},"extra":{"type":"array","items":{"type":"string","pattern":"^[A-Z0-9]{3}$"},"uniqueItems":true}}}'
);

INSERT OR IGNORE INTO analysis_type (type, version, category, json_schema) VALUES (
  'verse_coverage', '1.0', 'completeness',
  '{"type":"object","required":["type","version","verses_expected","verses_present","missing"],"additionalProperties":false,"properties":{"type":{"type":"string","const":"verse_coverage"},"version":{"type":"string","const":"1.0"},"verses_expected":{"type":"integer","minimum":1},"verses_present":{"type":"integer","minimum":0},"missing":{"type":"array","items":{"type":"string"}},"empty":{"type":"array","items":{"type":"string"}},"bridged":{"type":"array","items":{"type":"string"}}}}'
);

INSERT OR IGNORE INTO analysis_type (type, version, category, json_schema) VALUES (
  'question', '1.0', 'quality',
  '{"type":"object","required":["type","version","questions","rag_sources"],"additionalProperties":false,"properties":{"type":{"type":"string","const":"question"},"version":{"type":"string","const":"1.0"},"questions":{"type":"array","minItems":1,"items":{"type":"string","minLength":1}},"rag_sources":{"type":"array","uniqueItems":true,"items":{"type":"string","enum":["macula_greek","macula_hebrew","bart_greek","interpresure"]}}}}'
);

INSERT OR IGNORE INTO analysis_type (type, version, category, json_schema) VALUES (
  'interpresure_suggestions', '1.0', 'quality',
  '{"type":"object","required":["type","version","strengths","weaknesses","suggestions"],"additionalProperties":false,"properties":{"type":{"type":"string","const":"interpresure_suggestions"},"version":{"type":"string","const":"1.0"},"strengths":{"type":"array","items":{"type":"string","minLength":1}},"weaknesses":{"type":"array","items":{"type":"string","minLength":1}},"suggestions":{"type":"array","items":{"type":"string","minLength":1}}}}'
);
