import type { Repo, AnalysisType, Analysis } from './types';

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json() as Promise<T>;
}

// ── Gitea ─────────────────────────────────────────────────────────────────────

interface GiteaCommitInfo {
  /** ISO 8601 commit author date */
  created: string;
}

/** Parse a git_url into the pieces needed to call the Gitea REST API. */
export function parseGiteaUrl(
  gitUrl: string,
): { apiBase: string; owner: string; repo: string } | null {
  try {
    const url = new URL(gitUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[parts.length - 2]!;
    const repo = parts[parts.length - 1]!.replace(/\.git$/, '');
    return { apiBase: `${url.protocol}//${url.host}/api/v1`, owner, repo };
  } catch {
    return null;
  }
}

/** Fetch the author date for a single commit. Returns null on any failure. */
export async function fetchGiteaCommitDate(
  apiBase: string,
  owner: string,
  repo: string,
  sha: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${apiBase}/repos/${owner}/${repo}/git/commits/${sha}`);
    if (!res.ok) return null;
    const data = (await res.json()) as GiteaCommitInfo;
    return data.created ?? null;
  } catch {
    return null;
  }
}

export function fetchRepos(apiUrl: string): Promise<{ repos: Repo[] }> {
  return get(`${apiUrl}/repos`);
}

export function fetchAnalysisTypes(apiUrl: string): Promise<{ analysis_types: AnalysisType[] }> {
  return get(`${apiUrl}/analysis_types`);
}

export function fetchAnalyses(
  apiUrl: string,
  repoId: string,
): Promise<{ analyses: Analysis[]; total: number }> {
  return get(`${apiUrl}/analyses?repo_id=${encodeURIComponent(repoId)}&limit=100`);
}
