import { Hono } from 'hono';
import type { Env, AnalysisTypeRow } from '../types';
import { requireApiKey } from '../middleware/auth';

const analysisTypes = new Hono<{ Bindings: Env }>();

// POST /analysis_types
analysisTypes.post('/', requireApiKey, async (c) => {
  const body = await c.req.json<{
    type?: string;
    version?: string;
    category?: string;
    json_schema?: Record<string, unknown>;
  }>();

  const { type, version, category, json_schema } = body;

  if (!type || !version || !category || !json_schema) {
    return c.json({ error: 'type, version, category, and json_schema are required' }, 400);
  }

  const existing = await c.env.DB.prepare(
    'SELECT type FROM analysis_type WHERE type = ? AND version = ?'
  ).bind(type, version).first();

  if (existing) {
    return c.json({ error: `Analysis type '${type}' version '${version}' already exists` }, 409);
  }

  await c.env.DB.prepare(
    'INSERT INTO analysis_type (type, version, category, json_schema) VALUES (?, ?, ?, ?)'
  ).bind(type, version, category, JSON.stringify(json_schema)).run();

  const created = await c.env.DB.prepare(
    'SELECT * FROM analysis_type WHERE type = ? AND version = ?'
  ).bind(type, version).first<AnalysisTypeRow>();

  return c.json({
    ...created,
    json_schema: JSON.parse(created!.json_schema) as Record<string, unknown>,
  }, 201);
});

// GET /analysis_types
analysisTypes.get('/', async (c) => {
  const rows = await c.env.DB.prepare(`
    SELECT type, version, category FROM analysis_type ORDER BY type, version
  `).all<{ type: string; version: string; category: string }>();

  return c.json({ analysis_types: rows.results });
});

// GET /analysis_types/:type/:version
analysisTypes.get('/:type/:version', async (c) => {
  const { type, version } = c.req.param();

  const row = await c.env.DB.prepare(
    'SELECT * FROM analysis_type WHERE type = ? AND version = ?'
  ).bind(type, version).first<AnalysisTypeRow>();

  if (!row) return c.json({ error: 'Analysis type not found' }, 404);

  return c.json({
    ...row,
    json_schema: JSON.parse(row.json_schema) as Record<string, unknown>,
  });
});

export default analysisTypes;
