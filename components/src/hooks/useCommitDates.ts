import { useState, useEffect } from 'react';
import { parseGiteaUrl, fetchGiteaCommitDate } from '../api';

/**
 * Fetches commit author dates from a Gitea instance for a list of SHAs.
 * Returns a map of { sha → ISO date string }.
 * Silently ignores failures (CORS, 404, network) — callers should fall back
 * to showing just the SHA when a date is absent.
 */
export function useCommitDates(
  gitUrl: string | null,
  commitShas: string[],
): Record<string, string> {
  const [dates, setDates] = useState<Record<string, string>>({});

  // Stable dep: sorted SHA list as a string
  const shaKey = [...commitShas].sort().join(',');

  useEffect(() => {
    if (!gitUrl || commitShas.length === 0) return;

    const info = parseGiteaUrl(gitUrl);
    if (!info) return;

    let cancelled = false;

    Promise.all(
      commitShas.map(async (sha) => {
        const date = await fetchGiteaCommitDate(info.apiBase, info.owner, info.repo, sha);
        return [sha, date] as const;
      }),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [sha, date] of results) {
        if (date) next[sha] = date;
      }
      setDates(next);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gitUrl, shaKey]);

  return dates;
}
