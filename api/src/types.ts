export type AnchorLevel = 'repo' | 'book' | 'chapter' | 'verse' | 'word' | 'character' | 'non_verse';
export type AnalysisStatus = 'pending' | 'in_progress' | 'completed' | 'partial' | 'failed';

export interface Env {
  DB: D1Database;
  AI_SCRIPTURE_ANALYSIS_API_KEY: string;
}

// ── Database row shapes ───────────────────────────────────────────────────

export interface RepoRow {
  repo_id: string;
  name: string;
  git_url: string;
  created_at: string;
}

export interface AnalysisRow {
  analysis_id: string;
  repo_id: string;
  commit_sha: string;
  status: AnalysisStatus;
  triggered_at: string;
}

export interface AnalysisTypeRow {
  type: string;
  version: string;
  category: string;
  json_schema: string; // stored as JSON string
}

export interface AnalysisItemRow {
  id: string;
  analysis_id: string;
  book: string | null;
  chapter: number | null;
  anchor: string | null;
  anchor_level: AnchorLevel;
  type: string;
  version: string;
  observation: string; // stored as JSON string — self-describing (includes type + version inside)
}

// ── API response shapes (observation / json_schema parsed) ────────────────

export interface AnalysisItem extends Omit<AnalysisItemRow, 'observation'> {
  observation: Record<string, unknown>;
}

export interface AnalysisType extends Omit<AnalysisTypeRow, 'json_schema'> {
  json_schema: Record<string, unknown>;
}
