import { useState, useEffect } from 'react';
import { fetchProjectSummary } from '../api';
import type { ProjectSummary } from '../types';

export function useProjectSummary(
  apiUrl: string,
  repoId: string | null,
  commit?: string | null,
) {
  const [summary, setSummary] = useState<ProjectSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoId) {
      setSummary(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchProjectSummary(apiUrl, repoId, commit)
      .then(setSummary)
      .catch((err: unknown) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [apiUrl, repoId, commit]);

  return { summary, loading, error };
}
