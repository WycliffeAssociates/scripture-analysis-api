import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env, AnalysisRow } from '../types';
import { requireApiKey } from '../middleware/auth';

const analyses = new Hono<{ Bindings: Env }>();

// POST /analyses
analyses.post('/', requireApiKey, async (c) => {
  const body = await c.req.json<{ repo_id?: string; commit_sha?: string }>();
  const { repo_id, commit_sha } = body;

  if (!repo_id || !commit_sha) {
    return c.json({ error: 'repo_id and commit_sha are required' }, 400);
  }

  const repo = await c.env.DB.prepare(
    'SELECT repo_id FROM repo WHERE repo_id = ?'
  ).bind(repo_id).first<{ repo_id: string }>();

  if (!repo) return c.json({ error: 'Repo not found' }, 404);

  const analysis_id = crypto.randomUUID();

  await c.env.DB.prepare(
    'INSERT INTO analysis (analysis_id, repo_id, commit_sha, status) VALUES (?, ?, ?, ?)'
  ).bind(analysis_id, repo_id, commit_sha, 'pending').run();

  return c.json(await c.env.DB.prepare(
    'SELECT * FROM analysis WHERE analysis_id = ?'
  ).bind(analysis_id).first<AnalysisRow>(), 201);
});

// GET /analyses
analyses.get('/', async (c) => {
  const { repo_id, status, commit_sha, from, to, page = '1', limit = '50' } = c.req.query();

  if (!repo_id) return c.json({ error: 'repo_id query parameter is required' }, 400);

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const offset = (pageNum - 1) * limitNum;

  const conditions: string[] = ['repo_id = ?'];
  const bindings: (string | number)[] = [repo_id];

  if (status)     { conditions.push('status = ?');        bindings.push(status); }
  if (commit_sha) { conditions.push('commit_sha = ?');    bindings.push(commit_sha); }
  if (from)       { conditions.push('triggered_at >= ?'); bindings.push(from); }
  if (to)         { conditions.push('triggered_at <= ?'); bindings.push(to); }

  const where = conditions.join(' AND ');

  const [countResult, rows] = await c.env.DB.batch([
    c.env.DB.prepare(`SELECT COUNT(*) AS total FROM analysis WHERE ${where}`).bind(...bindings),
    c.env.DB.prepare(`
      SELECT * FROM analysis WHERE ${where}
      ORDER BY triggered_at DESC LIMIT ? OFFSET ?
    `).bind(...bindings, limitNum, offset),
  ]);

  const total = (countResult!.results[0] as { total: number } | undefined)?.total ?? 0;
  return c.json({ total, page: pageNum, limit: limitNum, analyses: rows!.results });
});

// GET /analyses/:analysis_id
analyses.get('/:analysis_id', async (c) => {
  const { analysis_id } = c.req.param();

  const analysis = await c.env.DB.prepare(
    'SELECT * FROM analysis WHERE analysis_id = ?'
  ).bind(analysis_id).first<AnalysisRow>();

  if (!analysis) return c.json({ error: 'Analysis not found' }, 404);

  const scopeRows = await c.env.DB.prepare(`
    SELECT book, chapter, COUNT(*) AS item_count
    FROM analysis_item WHERE analysis_id = ?
    GROUP BY book, chapter ORDER BY book, chapter
  `).bind(analysis_id).all<{ book: string | null; chapter: number | null; item_count: number }>();

  return c.json({ ...analysis, scopes_submitted: scopeRows.results });
});

// PATCH /analyses/:analysis_id
analyses.patch('/:analysis_id', requireApiKey, async (c) => {
  const { analysis_id } = c.req.param();
  const body = await c.req.json<{ status?: string }>();

  const validStatuses = ['pending', 'in_progress', 'completed', 'partial', 'failed'];
  if (!body.status || !validStatuses.includes(body.status)) {
    return c.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, 400);
  }

  const analysis = await c.env.DB.prepare(
    'SELECT analysis_id FROM analysis WHERE analysis_id = ?'
  ).bind(analysis_id).first<{ analysis_id: string }>();

  if (!analysis) return c.json({ error: 'Analysis not found' }, 404);

  await c.env.DB.prepare(
    'UPDATE analysis SET status = ? WHERE analysis_id = ?'
  ).bind(body.status, analysis_id).run();

  return c.json(await c.env.DB.prepare(
    'SELECT * FROM analysis WHERE analysis_id = ?'
  ).bind(analysis_id).first<AnalysisRow>());
});

// PUT /analyses/:analysis_id/scope/:book — book-level
analyses.put('/:analysis_id/scope/:book', requireApiKey, async (c) => {
  const { analysis_id, book } = c.req.param();
  return submitScope(c, analysis_id, book, null);
});

// PUT /analyses/:analysis_id/scope/:book/:chapter — chapter-level
analyses.put('/:analysis_id/scope/:book/:chapter', requireApiKey, async (c) => {
  const { analysis_id, book, chapter: chapterStr } = c.req.param();
  const chapter = parseInt(chapterStr, 10);
  if (isNaN(chapter)) return c.json({ error: 'Invalid chapter number' }, 400);
  return submitScope(c, analysis_id, book, chapter);
});

// ── shared scope write handler ────────────────────────────────────────────

async function submitScope(
  c: Context<{ Bindings: Env }>,
  analysis_id: string,
  book: string,
  chapter: number | null,
) {
  const analysis = await c.env.DB.prepare(
    'SELECT analysis_id, status FROM analysis WHERE analysis_id = ?'
  ).bind(analysis_id).first<{ analysis_id: string; status: string }>();

  if (!analysis) return c.json({ error: 'Analysis not found' }, 404);
  if (analysis.status === 'completed' || analysis.status === 'failed') {
    return c.json({ error: `Cannot write to an analysis with status '${analysis.status}'` }, 409);
  }

  const body = await c.req.json<{
    items?: Array<{
      anchor?: string | null;
      anchor_level: string;
      type: string;
      version: string;
      observation: Record<string, unknown>;
    }>;
  }>();

  if (!Array.isArray(body.items)) {
    return c.json({ error: 'items must be an array' }, 400);
  }

  const validLevels = new Set(['repo', 'book', 'chapter', 'verse', 'word', 'character', 'non_verse']);
  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i];
    if (!item) return c.json({ error: `items[${i}] is undefined` }, 400);
    if (!validLevels.has(item.anchor_level)) {
      return c.json({ error: `items[${i}].anchor_level '${item.anchor_level}' is not valid` }, 400);
    }
    if (!item.type || !item.version) {
      return c.json({ error: `items[${i}] missing type or version` }, 400);
    }
  }

  const chapterClause = chapter === null ? 'chapter IS NULL' : 'chapter = ?';
  const deleteBindings: (string | number)[] = chapter === null
    ? [analysis_id, book]
    : [analysis_id, book, chapter];

  const deleteStmt = c.env.DB.prepare(
    `DELETE FROM analysis_item WHERE analysis_id = ? AND book = ? AND ${chapterClause}`
  ).bind(...deleteBindings);

  const insertStmts = body.items.map((item) =>
    c.env.DB.prepare(`
      INSERT INTO analysis_item
        (id, analysis_id, book, chapter, anchor, anchor_level, type, version, observation)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      analysis_id,
      book,
      chapter,
      item.anchor ?? null,
      item.anchor_level,
      item.type,
      item.version,
      JSON.stringify(item.observation),
    )
  );

  const statusStmt = analysis.status === 'pending'
    ? c.env.DB.prepare('UPDATE analysis SET status = ? WHERE analysis_id = ?').bind('in_progress', analysis_id)
    : null;

  await c.env.DB.batch([deleteStmt, ...insertStmts, ...(statusStmt ? [statusStmt] : [])]);

  return c.json({ analysis_id, book, chapter, items_written: body.items.length }, 200);
}

export default analyses;
