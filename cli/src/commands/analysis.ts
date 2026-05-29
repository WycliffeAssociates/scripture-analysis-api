import { api, type ClientConfig } from '../client.js';

export async function createAnalysis(repoId: string, commitSha: string, config: ClientConfig) {
  const result = await api.createAnalysis(config, { repo_id: repoId, commit_sha: commitSha });
  console.log(JSON.stringify(result, null, 2));
}

export async function patchAnalysis(analysisId: string, status: string, config: ClientConfig) {
  const validStatuses = ['pending', 'in_progress', 'completed', 'partial', 'failed'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`);
  }
  const result = await api.patchAnalysis(config, analysisId, { status });
  console.log(JSON.stringify(result, null, 2));
}
