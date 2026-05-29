-- Scripture Analysis API — initial schema

CREATE TABLE IF NOT EXISTS repo (
  repo_id    TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  git_url    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analysis (
  analysis_id  TEXT PRIMARY KEY,
  repo_id      TEXT NOT NULL REFERENCES repo(repo_id),
  commit_sha   TEXT NOT NULL,
  status       TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed', 'partial', 'failed')),
  triggered_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS analysis_type (
  type        TEXT NOT NULL,
  version     TEXT NOT NULL,
  category    TEXT NOT NULL,
  json_schema TEXT NOT NULL,
  PRIMARY KEY (type, version)
);

CREATE TABLE IF NOT EXISTS analysis_item (
  id           TEXT PRIMARY KEY,
  analysis_id  TEXT NOT NULL REFERENCES analysis(analysis_id),
  book         TEXT,
  chapter      INTEGER,
  anchor       TEXT,
  anchor_level TEXT NOT NULL CHECK(anchor_level IN ('repo', 'book', 'chapter', 'verse', 'word', 'character', 'non_verse')),
  type         TEXT NOT NULL,
  version      TEXT NOT NULL,
  observation  TEXT NOT NULL,   -- self-describing JSON: includes type + version inside
  FOREIGN KEY (type, version) REFERENCES analysis_type(type, version)
);

-- Constraints enforced by application layer:
--   chapter must be null when book is null
--   anchor_level = 'repo' implies book IS NULL AND chapter IS NULL
--   anchor_level = 'book' implies chapter IS NULL

CREATE INDEX IF NOT EXISTS idx_analysis_repo      ON analysis(repo_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_commit     ON analysis(repo_id, commit_sha);
CREATE INDEX IF NOT EXISTS idx_item_analysis       ON analysis_item(analysis_id);
CREATE INDEX IF NOT EXISTS idx_item_scope          ON analysis_item(analysis_id, book, chapter);
CREATE INDEX IF NOT EXISTS idx_item_book           ON analysis_item(book);
CREATE INDEX IF NOT EXISTS idx_item_type           ON analysis_item(type);
CREATE INDEX IF NOT EXISTS idx_item_anchor_level   ON analysis_item(anchor_level);
