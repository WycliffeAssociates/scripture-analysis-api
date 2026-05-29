import type { Context } from 'hono';
import type { Env, RepoRow, AnalysisItemRow } from '../types';

// GET /repos — list all repos
export async function listRepos(c: Context<{ Bindings: Env }>) {
  const rows = await c.env.DB.prepare(
    'SELECT * FROM repo ORDER BY name ASC'
  ).all<RepoRow>();

  return c.json({ repos: rows.results });
}

// POST /repos
export async function createRepo(c: Context<{ Bindings: Env }>) {
  const body = await c.req.json<{ repo_id?: string; name?: string; git_url?: string }>();
  const { repo_id, name, git_url } = body;

  if (!repo_id || !name || !git_url) {
    return c.json({ error: 'repo_id, name, and git_url are required' }, 400);
  }

  const existing = await c.env.DB.prepare(
    'SELECT * FROM repo WHERE repo_id = ?'
  ).bind(repo_id).first<RepoRow>();

  if (existing) return c.json(existing, 200);

  await c.env.DB.prepare(
    'INSERT INTO repo (repo_id, name, git_url) VALUES (?, ?, ?)'
  ).bind(repo_id, name, git_url).run();

  return c.json(await c.env.DB.prepare(
    'SELECT * FROM repo WHERE repo_id = ?'
  ).bind(repo_id).first<RepoRow>(), 201);
}

// GET /repos/:repo_id — project summary
export async function getProjectSummary(c: Context<{ Bindings: Env }>) {
  const { repo_id } = c.req.param();
  const { commit, analysis_id } = c.req.query();

  const repo = await c.env.DB.prepare(
    'SELECT * FROM repo WHERE repo_id = ?'
  ).bind(repo_id).first<RepoRow>();

  if (!repo) return c.json({ error: 'Repo not found' }, 404);

  const mostRecentAnalysis = await c.env.DB.prepare(`
    SELECT analysis_id, commit_sha FROM analysis
    WHERE repo_id = ? AND status IN ('completed', 'partial')
    ORDER BY triggered_at DESC LIMIT 1
  `).bind(repo_id).first<{ analysis_id: string; commit_sha: string }>();

  const filter = buildAnalysisFilter(commit, analysis_id);

  const countRows = await c.env.DB.prepare(`
    WITH latest AS (
      SELECT i.book, i.type, i.version,
             a.triggered_at, a.analysis_id, a.commit_sha,
             ROW_NUMBER() OVER (
               PARTITION BY i.book, i.type
               ORDER BY a.triggered_at DESC
             ) AS rn
      FROM analysis_item i
      JOIN analysis a ON i.analysis_id = a.analysis_id
      WHERE a.repo_id = ?
        AND a.status IN ('completed', 'partial')
        ${filter.sql}
    )
    SELECT l.book, at.category, COUNT(*) AS count, l.analysis_id, l.commit_sha
    FROM latest l
    JOIN analysis_type at ON l.type = at.type AND l.version = at.version
    WHERE l.rn = 1
    GROUP BY l.book, at.category, l.analysis_id, l.commit_sha
  `).bind(repo_id, ...filter.bindings).all<{
    book: string; category: string; count: number;
    analysis_id: string; commit_sha: string;
  }>();

  const bookMap = new Map<string, {
    book: string; item_counts: Record<string, number>;
    analysis_id: string; commit_sha: string;
  }>();

  for (const row of countRows.results) {
    if (!bookMap.has(row.book)) {
      bookMap.set(row.book, {
        book: row.book, item_counts: {},
        analysis_id: row.analysis_id, commit_sha: row.commit_sha,
      });
    }
    bookMap.get(row.book)!.item_counts[row.category] = row.count;
  }

  const books = Array.from(bookMap.values()).map((b) => ({
    ...b,
    stale: mostRecentAnalysis ? b.commit_sha !== mostRecentAnalysis.commit_sha : false,
  }));

  return c.json({ ...repo, most_recent_analysis: mostRecentAnalysis ?? null, books });
}

// GET /repos/:repo_id/books/:book — book summary
export async function getBookSummary(c: Context<{ Bindings: Env }>) {
  const { repo_id, book } = c.req.param();
  const { commit, analysis_id } = c.req.query();

  const repo = await c.env.DB.prepare(
    'SELECT repo_id FROM repo WHERE repo_id = ?'
  ).bind(repo_id).first<{ repo_id: string }>();

  if (!repo) return c.json({ error: 'Repo not found' }, 404);

  const mostRecentAnalysis = await c.env.DB.prepare(`
    SELECT analysis_id, commit_sha FROM analysis
    WHERE repo_id = ? AND status IN ('completed', 'partial')
    ORDER BY triggered_at DESC LIMIT 1
  `).bind(repo_id).first<{ analysis_id: string; commit_sha: string }>();

  const filter = buildAnalysisFilter(commit, analysis_id);

  const chapterRows = await c.env.DB.prepare(`
    WITH latest AS (
      SELECT i.chapter, i.type,
             a.triggered_at, a.analysis_id, a.commit_sha,
             ROW_NUMBER() OVER (
               PARTITION BY i.chapter, i.type
               ORDER BY a.triggered_at DESC
             ) AS rn
      FROM analysis_item i
      JOIN analysis a ON i.analysis_id = a.analysis_id
      WHERE a.repo_id = ? AND i.book = ?
        AND a.status IN ('completed', 'partial')
        ${filter.sql}
    )
    SELECT chapter, type, COUNT(*) AS count, analysis_id, commit_sha
    FROM latest WHERE rn = 1
    GROUP BY chapter, type, analysis_id, commit_sha
    ORDER BY chapter ASC
  `).bind(repo_id, book, ...filter.bindings).all<{
    chapter: number | null; type: string; count: number;
    analysis_id: string; commit_sha: string;
  }>();

  const chapterMap = new Map<number | null, {
    chapter: number | null; item_count: number; types: string[];
    analysis_id: string; commit_sha: string;
  }>();

  for (const row of chapterRows.results) {
    if (!chapterMap.has(row.chapter)) {
      chapterMap.set(row.chapter, {
        chapter: row.chapter, item_count: 0, types: [],
        analysis_id: row.analysis_id, commit_sha: row.commit_sha,
      });
    }
    const entry = chapterMap.get(row.chapter)!;
    entry.item_count += row.count;
    if (!entry.types.includes(row.type)) entry.types.push(row.type);
  }

  const chapters = Array.from(chapterMap.values()).map((ch) => ({
    ...ch,
    stale: mostRecentAnalysis ? ch.commit_sha !== mostRecentAnalysis.commit_sha : false,
  }));

  return c.json({ repo_id, book, most_recent_analysis: mostRecentAnalysis ?? null, chapters });
}

// GET /repos/:repo_id/chapters/:book/:chapter — chapter detail
export async function getChapterDetail(c: Context<{ Bindings: Env }>) {
  const repo_id = c.req.param('repo_id');
  const book = c.req.param('book');
  const chapterStr = c.req.param('chapter');
  const chapter = parseInt(chapterStr ?? '', 10);
  const { commit, analysis_id } = c.req.query();

  if (isNaN(chapter)) return c.json({ error: 'Invalid chapter number' }, 400);

  const repo = await c.env.DB.prepare(
    'SELECT repo_id FROM repo WHERE repo_id = ?'
  ).bind(repo_id).first<{ repo_id: string }>();

  if (!repo) return c.json({ error: 'Repo not found' }, 404);

  const mostRecentAnalysis = await c.env.DB.prepare(`
    SELECT analysis_id, commit_sha FROM analysis
    WHERE repo_id = ? AND status IN ('completed', 'partial')
    ORDER BY triggered_at DESC LIMIT 1
  `).bind(repo_id).first<{ analysis_id: string; commit_sha: string }>();

  const filter = buildAnalysisFilter(commit, analysis_id);

  const itemRows = await c.env.DB.prepare(`
    WITH latest AS (
      SELECT i.*,
             a.triggered_at, a.commit_sha,
             ROW_NUMBER() OVER (
               PARTITION BY i.type
               ORDER BY a.triggered_at DESC
             ) AS rn
      FROM analysis_item i
      JOIN analysis a ON i.analysis_id = a.analysis_id
      WHERE a.repo_id = ? AND i.book = ? AND i.chapter = ?
        AND a.status IN ('completed', 'partial')
        ${filter.sql}
    )
    SELECT id, analysis_id, book, chapter, anchor, anchor_level,
           type, version, observation, commit_sha
    FROM latest WHERE rn = 1
    ORDER BY anchor_level, anchor
  `).bind(repo_id, book, chapter, ...filter.bindings)
    .all<AnalysisItemRow & { commit_sha: string }>();

  const commitShasUsed = [...new Set(itemRows.results.map((r) => r.commit_sha))];
  const stale = mostRecentAnalysis
    ? commitShasUsed.some((sha) => sha !== mostRecentAnalysis.commit_sha)
    : false;

  const items = itemRows.results.map(({ commit_sha: _sha, ...item }) => ({
    ...item,
    observation: JSON.parse(item.observation) as Record<string, unknown>,
  }));

  return c.json({ repo_id, book, chapter, stale, items });
}

// GET /repos/:repo_id/analysis — paginated flat query of analysis items
export async function getAnalysisItems(c: Context<{ Bindings: Env }>) {
  const { repo_id } = c.req.param();
  const {
    book, chapter, type, anchor_level, analysis_id,
    commit, page = '1', limit = '50',
  } = c.req.query();

  const repo = await c.env.DB.prepare(
    'SELECT repo_id FROM repo WHERE repo_id = ?'
  ).bind(repo_id).first<{ repo_id: string }>();

  if (!repo) return c.json({ error: 'Repo not found' }, 404);

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions: string[] = ['a.repo_id = ?'];
  const bindings: (string | number)[] = [repo_id ?? ''];

  if (analysis_id) { conditions.push('i.analysis_id = ?'); bindings.push(analysis_id); }
  if (book)        { conditions.push('i.book = ?');         bindings.push(book); }
  if (chapter)     { conditions.push('i.chapter = ?');      bindings.push(parseInt(chapter, 10)); }
  if (type)        { conditions.push('i.type = ?');         bindings.push(type); }
  if (anchor_level){ conditions.push('i.anchor_level = ?'); bindings.push(anchor_level); }
  if (commit)      { conditions.push('a.commit_sha = ?');   bindings.push(commit); }

  const where = conditions.join(' AND ');

  const [countResult, rows] = await c.env.DB.batch([
    c.env.DB.prepare(`
      SELECT COUNT(*) AS total
      FROM analysis_item i JOIN analysis a ON i.analysis_id = a.analysis_id
      WHERE ${where}
    `).bind(...bindings),
    c.env.DB.prepare(`
      SELECT i.*
      FROM analysis_item i JOIN analysis a ON i.analysis_id = a.analysis_id
      WHERE ${where}
      ORDER BY i.book, i.chapter, i.anchor_level
      LIMIT ? OFFSET ?
    `).bind(...bindings, limitNum, offset),
  ]);

  const total = (countResult!.results[0] as { total: number } | undefined)?.total ?? 0;
  const items = (rows!.results as AnalysisItemRow[]).map((item) => ({
    ...item,
    observation: JSON.parse(item.observation) as Record<string, unknown>,
  }));

  return c.json({ total, page: pageNum, limit: limitNum, items });
}

// ── helpers ───────────────────────────────────────────────────────────────

function buildAnalysisFilter(
  commit?: string,
  analysis_id?: string,
): { sql: string; bindings: (string | number)[] } {
  if (analysis_id) return { sql: 'AND a.analysis_id = ?', bindings: [analysis_id] };
  if (commit)      return { sql: 'AND a.commit_sha = ?',  bindings: [commit] };
  return { sql: '', bindings: [] };
}
