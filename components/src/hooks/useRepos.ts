import { useState, useEffect } from 'react';
import { fetchRepos } from '../api';
import type { Repo } from '../types';

export function useRepos(apiUrl: string) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchRepos(apiUrl)
      .then((data) => setRepos(data.repos))
      .catch((err: unknown) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  return { repos, loading, error };
}

/** Extract org/user slug from a git URL, e.g. "WycliffeAssociates" from
 *  https://content.bibletranslationtools.org/WycliffeAssociates/en_ulb */
export function orgFromGitUrl(gitUrl: string): string {
  try {
    const parts = new URL(gitUrl).pathname.split('/').filter(Boolean);
    return parts.length >= 2 ? (parts[parts.length - 2] ?? 'Unknown') : 'Unknown';
  } catch {
    return 'Unknown';
  }
}
