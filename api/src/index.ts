import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';
import { requireApiKey } from './middleware/auth';
import {
  listRepos,
  createRepo,
  getProjectSummary,
  getBookSummary,
  getChapterDetail,
  getAnalysisItems,
} from './routes/repos';
import analysesRouter from './routes/analyses';
import analysisTypesRouter from './routes/analysis_types';

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

app.get('/health', (c) => c.json({ status: 'ok' }));

// ── Repos ──────────────────────────────────────────────────────────────────
app.get('/repos', listRepos);
app.post('/repos', requireApiKey, createRepo);
app.get('/repos/:repo_id/books/:book', getBookSummary);
app.get('/repos/:repo_id/chapters/:book/:chapter', getChapterDetail);
app.get('/repos/:repo_id/analysis', getAnalysisItems);
app.get('/repos/:repo_id', getProjectSummary);

// ── Analyses ───────────────────────────────────────────────────────────────
app.route('/analyses', analysesRouter);

// ── Analysis types ─────────────────────────────────────────────────────────
app.route('/analysis_types', analysisTypesRouter);

export default app;
