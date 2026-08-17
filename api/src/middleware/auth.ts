import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types';

export const requireApiKey: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing Authorization header' }, 401);
  }
  if (header.slice(7) !== c.env.AI_SCRIPTURE_ANALYSIS_API_KEY) {
    return c.json({ error: 'Invalid API key' }, 403);
  }
  return next();
};
