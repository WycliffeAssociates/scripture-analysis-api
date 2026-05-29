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
