-- Seed the analysis_type table with bundled observation types.
-- Safe to re-run: INSERT OR IGNORE skips existing rows.
--
-- Usage:
--   wrangler d1 execute scripture-analysis --local --file=extensions/seed.sql
--   wrangler d1 execute scripture-analysis --file=extensions/seed.sql   (production)

INSERT OR IGNORE INTO analysis_type (type, version, category, json_schema) VALUES (
  'interpresure_suggestions', '1.0', 'quality',
  '{"type":"object","required":["type","version","strengths","weaknesses","suggestions"],"additionalProperties":false,"properties":{"type":{"type":"string","const":"interpresure_suggestions"},"version":{"type":"string","const":"1.0"},"strengths":{"type":"array","items":{"type":"string","minLength":1}},"weaknesses":{"type":"array","items":{"type":"string","minLength":1}},"suggestions":{"type":"array","items":{"type":"string","minLength":1}}}}'
);

INSERT OR IGNORE INTO analysis_type (type, version, category, json_schema) VALUES (
  'interpresure_suggestions', '2.0', 'quality',
  '{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"interpresure_suggestions/v2.0","title":"InterpreSure Suggestions","type":"object","required":["type","version","model","resources","strengths","weaknesses","suggestions"],"additionalProperties":false,"properties":{"type":{"const":"interpresure_suggestions"},"version":{"const":"2.0"},"model":{"type":"string"},"resources":{"type":"array","items":{"type":"string","minLength":1}},"strengths":{"type":"array","items":{"type":"string","minLength":1}},"weaknesses":{"type":"array","items":{"type":"string","minLength":1}},"suggestions":{"type":"array","items":{"type":"string","minLength":1}},"score":{"type":"integer","minimum":1,"maximum":10},"confidence":{"type":"integer","minimum":0,"maximum":100},"reasoning":{"type":"string"},"cross_references":{"type":"array","items":{"type":"string","minLength":1}},"verses_to_review":{"type":"array","items":{"type":"integer","minimum":1}}}}'
);

INSERT OR IGNORE INTO analysis_type (type, version, category, json_schema) VALUES (
  'analysis_run_metadata', '1.0', 'data',
  '{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"scripture-analysis/analysis_run_metadata/1.0","title":"Analysis Run Metadata","description":"Pipeline provenance record for an analysis run.","type":"object","required":["type","version","model","analysis_mode","analysis_type","timestamp","translation","biblical_language","resources"],"additionalProperties":false,"properties":{"type":{"type":"string","const":"analysis_run_metadata"},"version":{"type":"string","const":"1.0"},"model":{"type":"string","minLength":1},"critic_model":{"type":"string","minLength":1},"analysis_mode":{"type":"string","minLength":1},"analysis_type":{"type":"string","minLength":1},"timestamp":{"type":"string","format":"date-time"},"translation":{"type":"object","required":["language","title"],"additionalProperties":false,"properties":{"language":{"type":"string"},"title":{"type":"string"}}},"biblical_language":{"type":"string"},"resources":{"type":"object","additionalProperties":{"type":"boolean"}}}}'
);

INSERT OR IGNORE INTO analysis_type (type, version, category, json_schema) VALUES (
  'discourse_map', '1.0', 'data',
  '{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"discourse_map/v1.0","title":"Discourse Map","type":"object","required":["type","version","model","resources","argument_structure","genre_notes"],"additionalProperties":false,"properties":{"type":{"const":"discourse_map"},"version":{"const":"1.0"},"model":{"type":"string"},"resources":{"type":"array","items":{"type":"string","minLength":1}},"dominant_quds":{"type":"array","items":{"type":"string","minLength":1}},"argument_structure":{"type":"string","minLength":1},"discourse_boundaries":{"type":"array","items":{"type":"object","required":["verse_start","verse_end","description"],"additionalProperties":false,"properties":{"verse_start":{"type":"integer","minimum":1},"verse_end":{"type":"integer","minimum":1},"description":{"type":"string","minLength":1}}}},"relational_dynamics":{"type":"string"},"active_scales":{"type":"array","items":{"type":"string","minLength":1}},"key_presuppositions":{"type":"array","items":{"type":"string","minLength":1}},"genre_notes":{"type":"string","minLength":1}}}'
);

INSERT OR IGNORE INTO analysis_type (type, version, category, json_schema) VALUES (
  'interpresure_qa', '1.0', 'quality',
  '{"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"scripture-analysis/interpresure_qa/1.0","title":"InterPresure Q&A","description":"A single pragmatic-goal question posed to an AI model, its answer, and a pass/fail/na verdict with severity and confidence scores.","type":"object","required":["type","version","question","answer","model","result","severity","confidence"],"additionalProperties":false,"properties":{"type":{"type":"string","const":"interpresure_qa","description":"Observation type identifier."},"version":{"type":"string","const":"1.0","description":"Schema version."},"question":{"type":"string","minLength":1,"description":"The pragmatic-goal question posed to the model."},"answer":{"type":"string","minLength":1,"description":"The model''s answer to the question."},"model":{"type":"string","minLength":1,"description":"Identifier of the AI model that produced the answer."},"reasoning":{"type":"string","description":"Optional chain-of-thought or explanation produced by the model before reaching its answer."},"result":{"type":"string","enum":["pass","fail","na"],"description":"Whether the pragmatic goal was achieved (pass), not achieved (fail), or requires human judgment (na)."},"severity":{"type":"integer","minimum":0,"maximum":10,"description":"Severity of issue (fail), importance for review (na), or 0 (pass)."},"confidence":{"type":"integer","minimum":0,"maximum":100,"description":"Model''s self-reported confidence in its answer, 0-100."}}}'
);
