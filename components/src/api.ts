import type { Repo, AnalysisType, Analysis, ProjectSummary, BookSummary, ChapterDetail } from './types';

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
  type?: string | null,
  book?: string | null,
  chapter?: number | null,
): Promise<{ analyses: Analysis[]; total: number }> {
  const params = new URLSearchParams({ repo_id: repoId, limit: '100' });
  if (type)           params.set('type', type);
  if (book)           params.set('book', book);
  if (chapter != null) params.set('chapter', String(chapter));
  return get(`${apiUrl}/analyses?${params}`);
}

export function fetchProjectSummary(
  apiUrl: string,
  repoId: string,
  commit?: string | null,
): Promise<ProjectSummary> {
  const q = commit ? `?commit=${encodeURIComponent(commit)}` : '';
  return get(`${apiUrl}/repos/${encodeURIComponent(repoId)}${q}`);
}

export function fetchBookSummary(
  apiUrl: string,
  repoId: string,
  book: string,
  commit?: string | null,
): Promise<BookSummary> {
  const q = commit ? `?commit=${encodeURIComponent(commit)}` : '';
  return get(`${apiUrl}/repos/${encodeURIComponent(repoId)}/books/${encodeURIComponent(book)}${q}`);
}

export function fetchChapterDetail(
  apiUrl: string,
  repoId: string,
  book: string,
  chapter: number,
  commit?: string | null,
): Promise<ChapterDetail> {
  const q = commit ? `?commit=${encodeURIComponent(commit)}` : '';
  return get(
    `${apiUrl}/repos/${encodeURIComponent(repoId)}/chapters/${encodeURIComponent(book)}/${chapter}${q}`,
  );
}

// ── Gitea USFM helpers ────────────────────────────────────────────────────────

interface GiteaContentEntry {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'symlink';
  download_url: string | null;
}

/**
 * List the root directory of a Gitea repo at a given commit SHA.
 * Returns null on any failure.
 */
export async function fetchGiteaRootContents(
  apiBase: string,
  owner: string,
  repo: string,
  sha: string,
): Promise<GiteaContentEntry[] | null> {
  try {
    const res = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/?ref=${sha}`);
    if (!res.ok) return null;
    return (await res.json()) as GiteaContentEntry[];
  } catch {
    return null;
  }
}

/**
 * Fetch the text content of a file via the Gitea contents API.
 * Uses the API endpoint (CORS-safe) rather than the raw download URL
 * (which typically lacks CORS headers). Returns null on any failure.
 */
export async function fetchGiteaFileContent(
  apiBase: string,
  owner: string,
  repo: string,
  path: string,
  sha: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `${apiBase}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${sha}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { encoding?: string; content?: string };
    if (data.encoding === 'base64' && data.content) {
      const binary = atob(data.content.replace(/\n/g, ''));
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      return new TextDecoder('utf-8').decode(bytes);
    }
    return null;
  } catch {
    return null;
  }
}
