export interface ClientConfig {
  baseUrl: string;
  apiKey: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  config: ClientConfig,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${config.baseUrl.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ApiError(res.status, `Non-JSON response: ${text}`);
  }

  if (!res.ok) {
    const msg = (data as { error?: string })?.error ?? res.statusText;
    throw new ApiError(res.status, msg);
  }

  return data as T;
}

export const api = {
  upsertRepo: (config: ClientConfig, body: { repo_id: string; name: string; git_url: string }) =>
    request<{ repo_id: string }>(config, 'POST', '/repos', body),

  createAnalysis: (config: ClientConfig, body: { repo_id: string; commit_sha: string }) =>
    request<{ analysis_id: string }>(config, 'POST', '/analyses', body),

  patchAnalysis: (config: ClientConfig, analysis_id: string, body: { status: string }) =>
    request<{ analysis_id: string; status: string }>(config, 'PATCH', `/analyses/${analysis_id}`, body),

  putScope: (
    config: ClientConfig,
    analysis_id: string,
    book: string | null,
    chapter: number | null,
    items: unknown[],
  ) => {
    const bookSegment = book ?? 'null';
    const scopePath = chapter !== null
      ? `/analyses/${analysis_id}/scope/${bookSegment}/${chapter}`
      : `/analyses/${analysis_id}/scope/${bookSegment}`;
    return request<{ items_written: number }>(config, 'PUT', scopePath, { items });
  },
};
