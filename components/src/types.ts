export interface Repo {
  repo_id: string;
  name: string;
  git_url: string;
  created_at: string;
}

export interface AnalysisType {
  type: string;
  version: string;
  category: string;
}

export interface Analysis {
  analysis_id: string;
  repo_id: string;
  commit_sha: string;
  status: 'pending' | 'in_progress' | 'completed' | 'partial' | 'failed';
  triggered_at: string;
}

export interface AnalysisBarSelection {
  /** Derived org slug from git_url, e.g. "WycliffeAssociates" */
  org: string | null;
  repoId: string | null;
  commitSha: string | null;
  analysisType: string | null;
  analysisId: string | null;
}

// ── Project / Book / Chapter shapes (mirrors API responses) ──────────────────

export interface BookEntry {
  book: string;
  item_counts: Record<string, number>;
  analysis_id: string;
  commit_sha: string;
  stale: boolean;
}

export interface ProjectSummary {
  repo_id: string;
  name: string;
  git_url: string;
  created_at: string;
  most_recent_analysis: { analysis_id: string; commit_sha: string } | null;
  books: BookEntry[];
}

export interface ChapterEntry {
  chapter: number | null;
  item_count: number;
  types: string[];
  analysis_id: string;
  commit_sha: string;
  stale: boolean;
}

export interface BookSummary {
  repo_id: string;
  book: string;
  most_recent_analysis: { analysis_id: string; commit_sha: string } | null;
  chapters: ChapterEntry[];
}

export interface AnalysisItem {
  id: number;
  analysis_id: string;
  book: string;
  chapter: number | null;
  anchor: string;
  anchor_level: string;
  type: string;
  version: string;
  observation: Record<string, unknown>;
}

export interface ChapterDetail {
  repo_id: string;
  book: string;
  chapter: number;
  stale: boolean;
  items: AnalysisItem[];
}
